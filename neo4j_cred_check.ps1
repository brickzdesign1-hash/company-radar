python - <<'PY'
from neo4j import GraphDatabase

uri = "neo4j+ssc://53f48d83.databases.neo4j.io"
user = "neo4j"
pwd = input("_aypO8i80iWnuFmJOxmogLNkZVruc5aGwX04iP8O0Zc")

driver = GraphDatabase.driver(uri, auth=(user, pwd))
driver.verify_connectivity()
with driver.session() as s:
    print(s.run("RETURN 1 AS ok").single()["ok"])
driver.close()
print("OK: login works")
PY
