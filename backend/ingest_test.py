import argparse
import json
import time
from typing import List, Dict, Any
from neo4j import GraphDatabase

def iter_jsonl(path: str):
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                yield json.loads(line)

def ensure_indexes(driver):
    with driver.session() as session:
        # Indizes sind essenziell für die Geschwindigkeit von MERGE
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
    SET p.ftm_id = data.name
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
            # Firma zum Batch hinzufügen
            company_batch.append({
                "id": entry.get("company_number"),
                "name": entry.get("name"),
                "address": entry.get("registered_address"),
                "status": entry.get("current_status")
            })

            # Officers zum Batch hinzufügen
            for off in entry.get("officers", []):
                if off.get("name"):
                    officer_batch.append({
                        "company_id": entry.get("company_number"),
                        "name": off.get("name"),
                        "role": off.get("position"),
                        "start_date": off.get("start_date")
                    })

            count += 1
            
            # Wenn Batch-Größe erreicht, in die DB schreiben
            if len(company_batch) >= batch_size:
                flush_companies(session, company_batch)
                company_batch = []
            
            if len(officer_batch) >= batch_size:
                flush_officers(session, officer_batch)
                officer_batch = []

            if count % 10000 == 0:
                elapsed = time.time() - start_time
                print(f"Verarbeitet: {count} Zeilen... ({elapsed:.1f}s)")

        # Restliche Daten schreiben
        if company_batch: flush_companies(session, company_batch)
        if officer_batch: flush_officers(session, officer_batch)

    print(f"Import von {count} Firmen abgeschlossen!")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", default="/data/de_companies_ocdata.jsonl")
    parser.add_argument("--password", default="testpassword")
    parser.add_argument("--batch", type=int, default=5000)
    args = parser.parse_args()

    driver = GraphDatabase.driver("bolt://neo4j:7687", auth=("neo4j", args.password))
    try:
        print("Prüfe Indizes...")
        ensure_indexes(driver)
        print(f"Starte Batch-Import von {args.file}...")
        import_data(args.file, driver, batch_size=args.batch)
    finally:
        driver.close()