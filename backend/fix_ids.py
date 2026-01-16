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

def wipe_database(driver):
    print("Lösche Daten in Batches (schont den Arbeitsspeicher)...")
    with driver.session() as session:
        # Wir löschen zuerst alle Beziehungen in Batches
        print("Lösche Beziehungen...")
        session.run("""
            MATCH ()-[r]->()
            CALL {
                WITH r
                DELETE r
            } IN TRANSACTIONS OF 10000 ROWS
        """)
        
        # Dann löschen wir alle Knoten in Batches
        print("Lösche Knoten...")
        session.run("""
            MATCH (n)
            CALL {
                WITH n
                DELETE n
            } IN TRANSACTIONS OF 10000 ROWS
        """)
    print("Datenbank erfolgreich geleert.")

    
def ensure_indexes(driver):
    print("Erstelle Indizes...")
    with driver.session() as session:
        # Standard Indizes für Performance
        session.run("CREATE INDEX company_id IF NOT EXISTS FOR (c:Company) ON (c.ftm_id)")
        session.run("CREATE INDEX person_name IF NOT EXISTS FOR (p:Person) ON (p.name)")
        session.run("CREATE INDEX person_ftm_id IF NOT EXISTS FOR (p:Person) ON (p.ftm_id)")
        
        # Der wichtige Fulltext-Index für deine Suche
        session.run("""
            CREATE FULLTEXT INDEX companyNameIndex IF NOT EXISTS 
            FOR (n:Company) ON EACH [n.name]
        """)
        
        session.run("CALL db.awaitIndexes()")

def flush_all(session, batch: List[Dict[str, Any]]):
    # Dieses Query erledigt alles in einem Rutsch pro Firma
    query = """
    UNWIND $batch AS data
    // 1. Firma erstellen/aktualisieren
    MERGE (c:Company {ftm_id: data.id})
    SET c.name = data.name,
        c.address = data.address,
        c.status = data.status

    WITH c, data
    UNWIND data.officers AS off
    // 2. Person erstellen und ID setzen
    MERGE (p:Person {name: off.name})
    SET p.ftm_id = off.name
    
    // 3. Beziehung herstellen
    MERGE (p)-[r:DIRECTORSHIP]->(c)
    SET r.role = off.role,
        r.start_date = off.start_date
    """
    session.run(query, batch=batch)

def import_data(path: str, driver, batch_size=1000):
    batch = []
    count = 0
    start_time = time.time()

    with driver.session() as session:
        for entry in iter_jsonl(path):
            company_id = entry.get("company_number")
            if not company_id:
                continue

            # Wir bereiten ein Objekt vor, das die Firma UND ihre Officers enthält
            officers = []
            for off in entry.get("officers", []):
                if off.get("name"):
                    officers.append({
                        "name": off.get("name"),
                        "role": off.get("position"),
                        "start_date": off.get("start_date")
                    })

            batch.append({
                "id": company_id,
                "name": entry.get("name"),
                "address": entry.get("registered_address"),
                "status": entry.get("current_status"),
                "officers": officers
            })

            count += 1

            if len(batch) >= batch_size:
                flush_all(session, batch)
                batch = []
                elapsed = time.time() - start_time
                print(f"Verarbeitet: {count} Firmen inkl. Netzwerke... ({elapsed:.1f}s)")

        if batch:
            flush_all(session, batch)

    print(f"Import von {count} Firmen und deren Verknüpfungen abgeschlossen!")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", default="data/de_companies_ocdata.jsonl")
    parser.add_argument("--password", required=True)
    args = parser.parse_args()

    # Verbindung mit +ssc für Aura (SSL-Fix)
    uri = "neo4j+ssc://3de08def.databases.neo4j.io"
    driver = GraphDatabase.driver(uri, auth=("neo4j", args.password))

    try:
        wipe_database(driver)
        ensure_indexes(driver)
        import_data(args.file, driver)
    finally:
        driver.close()