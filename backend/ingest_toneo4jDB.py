import argparse
import json
import time
from typing import List, Dict, Any
from neo4j import GraphDatabase


def iter_jsonl(path: str):
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                yield json.loads(line)


def ensure_indexes(driver):
    with driver.session() as session:
        session.run("CREATE INDEX company_id IF NOT EXISTS FOR (c:Company) ON (c.ftm_id)")
        session.run("CREATE INDEX person_name IF NOT EXISTS FOR (p:Person) ON (p.name)")
        session.run("CALL db.awaitIndexes()")


def flush_companies(session, batch: List[Dict[str, Any]]):
    query = """
    UNWIND $batch AS data
    MERGE (c:Company {ftm_id: data.id})
    SET c.name = data.name,
        c.address = data.address,
        c.status = data.status
    """
    session.run(query, batch=batch)


def flush_officers(session, batch: List[Dict[str, Any]]):
    query = """
    UNWIND $batch AS data
    MERGE (p:Person {name: data.name})
    WITH p, data
    MATCH (c:Company {ftm_id: data.company_id})
    MERGE (p)-[r:DIRECTORSHIP]->(c)
    SET r.role = data.role,
        r.start_date = data.start_date
    """
    session.run(query, batch=batch)


def import_data(path: str, driver, batch_size=5000):
    company_batch = []
    officer_batch = []
    count = 0
    start_time = time.time()

    with driver.session() as session:
        for entry in iter_jsonl(path):
            company_id = entry.get("company_number")
            if not company_id:
                continue

            company_batch.append({
                "id": company_id,
                "name": entry.get("name"),
                "address": entry.get("registered_address"),
                "status": entry.get("current_status"),
            })

            for off in entry.get("officers", []):
                name = off.get("name")
                if name:
                    officer_batch.append({
                        "company_id": company_id,
                        "name": name,
                        "role": off.get("position"),
                        "start_date": off.get("start_date"),
                    })

            count += 1

            if len(company_batch) >= batch_size:
                flush_companies(session, company_batch)
                company_batch = []

            if len(officer_batch) >= batch_size:
                flush_officers(session, officer_batch)
                officer_batch = []

            if count % 10000 == 0:
                elapsed = time.time() - start_time
                print(f"Verarbeitet: {count} Zeilen... ({elapsed:.1f}s)")

        if company_batch:
            flush_companies(session, company_batch)
        if officer_batch:
            flush_officers(session, officer_batch)

    print(f"Import von {count} Firmen abgeschlossen!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", default="data/de_companies_ocdata.jsonl")
    parser.add_argument("--password", required=True)
    parser.add_argument("--batch", type=int, default=5000)
    args = parser.parse_args()

    uri = "neo4j+ssc://3de08def.databases.neo4j.io"
    driver = GraphDatabase.driver(uri, auth=("neo4j", args.password))

    try:
        print("Prüfe Indizes...")
        ensure_indexes(driver)
        print(f"Starte Batch-Import von {args.file}...")
        import_data(args.file, driver, batch_size=args.batch)
    finally:
        driver.close()
