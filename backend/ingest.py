import argparse
import time
from typing import Any, Dict, Iterable, Iterator, List, Optional, Tuple

import ijson
from neo4j import GraphDatabase


def _first_non_ws_byte(path: str, peek_bytes: int = 4096) -> Optional[int]:
    with open(path, "rb") as f:
        chunk = f.read(peek_bytes)
    for b in chunk:
        if b in (9, 10, 13, 32):
            continue
        return b
    return None


def iter_entities(path: str) -> Iterator[Dict[str, Any]]:
    """Stream entities one-by-one using ijson.

    Supports both:
    - a single top-level JSON array: [ {...}, {...}, ... ]
    - multiple top-level objects (JSON lines / concatenated objects)

    Never loads the full file into RAM.
    """
    first = _first_non_ws_byte(path)
    if first is None:
        return

    with open(path, "rb") as f:
        if first == ord("["):
            # Top-level array
            for entity in ijson.items(f, "item"):
                if isinstance(entity, dict):
                    yield entity
        else:
            # Multiple top-level values (commonly JSON lines)
            for entity in ijson.items(f, "", multiple_values=True):
                if isinstance(entity, dict):
                    yield entity


def prop_first(entity: Dict[str, Any], key: str) -> Optional[Any]:
    props = entity.get("properties") or {}
    value = props.get(key)
    if isinstance(value, list) and value:
        return value[0]
    return None


def to_node_row(entity: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": entity.get("id"),
        "schema": entity.get("schema"),
        "name": prop_first(entity, "name"),
        "datasets": entity.get("datasets") or [],
        "modified_at": entity.get("modifiedAt") or entity.get("modified_at"),
    }


def to_rel_row(entity: Dict[str, Any]) -> Optional[Tuple[str, Dict[str, Any]]]:
    schema = entity.get("schema")
    if schema == "Directorship":
        source_id = prop_first(entity, "director")
        target_id = prop_first(entity, "organization")
        rel_type = "DIRECTORSHIP"
    elif schema == "Ownership":
        source_id = prop_first(entity, "owner")
        target_id = prop_first(entity, "asset")
        rel_type = "OWNERSHIP"
    else:
        return None

    if not source_id or not target_id:
        return None

    return rel_type, {
        "id": entity.get("id"),
        "schema": schema,
        "source_id": source_id,
        "target_id": target_id,
        "datasets": entity.get("datasets") or [],
        "modified_at": entity.get("modifiedAt") or entity.get("modified_at"),
    }


NODE_CYPHER = {
    "Company": """
UNWIND $batch AS row
MERGE (n:Company {ftm_id: row.id})
SET n.schema = row.schema,
    n.name = row.name,
    n.datasets = row.datasets,
    n.modified_at = row.modified_at
""",
    "Person": """
UNWIND $batch AS row
MERGE (n:Person {ftm_id: row.id})
SET n.schema = row.schema,
    n.name = row.name,
    n.datasets = row.datasets,
    n.modified_at = row.modified_at
""",
}

REL_CYPHER = {
    "DIRECTORSHIP": """
UNWIND $batch AS row
OPTIONAL MATCH (srcP:Person {ftm_id: row.source_id})
OPTIONAL MATCH (srcC:Company {ftm_id: row.source_id})
WITH row, coalesce(srcP, srcC) AS src
OPTIONAL MATCH (tgtP:Person {ftm_id: row.target_id})
OPTIONAL MATCH (tgtC:Company {ftm_id: row.target_id})
WITH row, src, coalesce(tgtP, tgtC) AS tgt
WHERE src IS NOT NULL AND tgt IS NOT NULL
MERGE (src)-[r:DIRECTORSHIP {ftm_id: row.id}]->(tgt)
SET r.schema = row.schema,
    r.datasets = row.datasets,
    r.modified_at = row.modified_at
""",
    "OWNERSHIP": """
UNWIND $batch AS row
OPTIONAL MATCH (srcP:Person {ftm_id: row.source_id})
OPTIONAL MATCH (srcC:Company {ftm_id: row.source_id})
WITH row, coalesce(srcP, srcC) AS src
OPTIONAL MATCH (tgtP:Person {ftm_id: row.target_id})
OPTIONAL MATCH (tgtC:Company {ftm_id: row.target_id})
WITH row, src, coalesce(tgtP, tgtC) AS tgt
WHERE src IS NOT NULL AND tgt IS NOT NULL
MERGE (src)-[r:OWNERSHIP {ftm_id: row.id}]->(tgt)
SET r.schema = row.schema,
    r.datasets = row.datasets,
    r.modified_at = row.modified_at
""",
}


def ensure_indexes(driver, database: Optional[str]) -> None:
    index_statements = [
        "CREATE INDEX person_ftm_id IF NOT EXISTS FOR (p:Person) ON (p.ftm_id)",
        "CREATE INDEX company_ftm_id IF NOT EXISTS FOR (c:Company) ON (c.ftm_id)",
    ]

    def _create(tx):
        for stmt in index_statements:
            tx.run(stmt)
        tx.run("CALL db.awaitIndexes()")

    with driver.session(database=database) as session:
        session.execute_write(_create)


def flush_nodes(session, label: str, batch: List[Dict[str, Any]]) -> None:
    if not batch:
        return

    cypher = NODE_CYPHER[label]

    def _write(tx):
        tx.run(cypher, batch=batch).consume()

    session.execute_write(_write)
    batch.clear()


def flush_rels(session, rel_type: str, batch: List[Dict[str, Any]]) -> None:
    if not batch:
        return

    cypher = REL_CYPHER[rel_type]

    def _write(tx):
        tx.run(cypher, batch=batch).consume()

    session.execute_write(_write)
    batch.clear()


def import_nodes(path: str, driver, database: Optional[str], batch_size: int) -> Tuple[int, int]:
    company_batch: List[Dict[str, Any]] = []
    person_batch: List[Dict[str, Any]] = []

    companies = 0
    persons = 0

    with driver.session(database=database) as session:
        for entity in iter_entities(path):
            schema = entity.get("schema")
            if schema not in ("Company", "Person"):
                continue

            row = to_node_row(entity)
            if not row.get("id"):
                continue

            if schema == "Company":
                company_batch.append(row)
                companies += 1
                if len(company_batch) >= batch_size:
                    flush_nodes(session, "Company", company_batch)
            else:
                person_batch.append(row)
                persons += 1
                if len(person_batch) >= batch_size:
                    flush_nodes(session, "Person", person_batch)

        flush_nodes(session, "Company", company_batch)
        flush_nodes(session, "Person", person_batch)

    return companies, persons


def import_relationships(path: str, driver, database: Optional[str], batch_size: int) -> Tuple[int, int]:
    directorship_batch: List[Dict[str, Any]] = []
    ownership_batch: List[Dict[str, Any]] = []

    directorships = 0
    ownerships = 0

    with driver.session(database=database) as session:
        for entity in iter_entities(path):
            schema = entity.get("schema")
            if schema not in ("Directorship", "Ownership"):
                continue

            parsed = to_rel_row(entity)
            if parsed is None:
                continue

            rel_type, row = parsed
            if not row.get("id"):
                continue

            if rel_type == "DIRECTORSHIP":
                directorship_batch.append(row)
                directorships += 1
                if len(directorship_batch) >= batch_size:
                    flush_rels(session, "DIRECTORSHIP", directorship_batch)
            else:
                ownership_batch.append(row)
                ownerships += 1
                if len(ownership_batch) >= batch_size:
                    flush_rels(session, "OWNERSHIP", ownership_batch)

        flush_rels(session, "DIRECTORSHIP", directorship_batch)
        flush_rels(session, "OWNERSHIP", ownership_batch)

    return directorships, ownerships


def main() -> None:
    parser = argparse.ArgumentParser(description="Stream entities.ftm.json into Neo4j (RAM-safe).")
    parser.add_argument("--file", default="/data/entities.ftm.json", help="Path to entities.ftm.json")
    parser.add_argument("--uri", default="bolt://neo4j:7687", help="Neo4j Bolt URI")
    parser.add_argument("--user", default="neo4j", help="Neo4j username")
    parser.add_argument("--password", default="testpassword", help="Neo4j password")
    parser.add_argument("--database", default=None, help="Neo4j database (optional)")
    parser.add_argument("--batch-size", type=int, default=5000, help="Rows per batch")

    args = parser.parse_args()

    start = time.time()
    driver = GraphDatabase.driver(args.uri, auth=(args.user, args.password))

    try:
        print("[1/3] Creating indexes (critical for performance)...")
        ensure_indexes(driver, args.database)

        print("[2/3] Importing nodes (Company, Person) in streaming mode...")
        t0 = time.time()
        companies, persons = import_nodes(args.file, driver, args.database, args.batch_size)
        dt = time.time() - t0
        print(f"  Nodes: Company={companies:,} Person={persons:,} in {dt:.1f}s")

        print("[3/3] Importing relationships (Directorship, Ownership) in streaming mode...")
        t0 = time.time()
        directorships, ownerships = import_relationships(args.file, driver, args.database, args.batch_size)
        dt = time.time() - t0
        print(f"  Rels: Directorship={directorships:,} Ownership={ownerships:,} in {dt:.1f}s")

    finally:
        driver.close()

    total = time.time() - start
    print(f"Done in {total:.1f}s")


if __name__ == "__main__":
    main()
