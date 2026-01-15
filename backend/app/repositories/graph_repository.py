from __future__ import annotations
import os
from dataclasses import dataclass
from functools import lru_cache
from typing import Optional, List, Dict, Any
from neo4j import Driver, GraphDatabase
from neo4j.exceptions import Neo4jError

@dataclass(frozen=True)
class CompanyStaticDetails:
    company_id: str
    name: str
    address: Optional[str] = None

def _env(name: str, default: str) -> str:
    value = os.getenv(name)
    return value if value is not None and value != "" else default

@lru_cache(maxsize=1)
def get_neo4j_driver() -> Driver:
    uri = _env("NEO4J_URI", "bolt://neo4j:7687")
    user = _env("NEO4J_USER", "neo4j")
    # Hier muss das neue Passwort stehen:
    password = _env("NEO4J_PASSWORD", "testpassword") 
    return GraphDatabase.driver(uri, auth=(user, password))

class GraphRepository:
    def __init__(self, driver: Driver, database: Optional[str] = None) -> None:
        self._driver = driver
        self._database = database

    async def get_company_details(self, company_id: str) -> Optional[CompanyStaticDetails]:
        query = """
        MATCH (c:Company {ftm_id: $id})
        RETURN c.ftm_id AS company_id, c.name AS name,
               coalesce(c.address, head(coalesce(c.addresses, []))) AS address
        LIMIT 1
        """
        def _read(tx):
            record = tx.run(query, id=company_id).single()
            return record.data() if record else None
        with self._driver.session(database=self._database) as session:
            row = session.execute_read(_read)
        if not row: return None
        return CompanyStaticDetails(company_id=row["company_id"], name=row["name"], address=row.get("address"))

    # DIESE METHODE HAT GEFEHLT:
    async def get_company_network(self, company_id: str) -> List[Dict[str, Any]]:
        query = """
        MATCH (p:Person)-[r:DIRECTORSHIP]->(c:Company {ftm_id: $id})
        RETURN p.name AS name, r.role AS role, r.start_date AS start_date
        """
        def _read(tx):
            result = tx.run(query, id=company_id)
            return [record.data() for record in result]
        with self._driver.session(database=self._database) as session:
            return session.execute_read(_read)
        
    async def search_companies(self, query: str, limit: int = 10):
        fulltext_cypher = """
        CALL db.index.fulltext.queryNodes("companyNameIndex", $q) YIELD node, score
        RETURN node.ftm_id AS id, node.name AS name, score
        LIMIT $limit
        """

        fallback_cypher = """
        MATCH (c:Company)
        WHERE toLower(c.name) CONTAINS toLower($q)
        RETURN c.ftm_id AS id, c.name AS name, 0.0 AS score
        LIMIT $limit
        """

        def _read_fulltext(tx):
            result = tx.run(fulltext_cypher, q=f"{query}*", limit=limit)
            return [record.data() for record in result]

        def _read_fallback(tx):
            result = tx.run(fallback_cypher, q=query, limit=limit)
            return [record.data() for record in result]

        with self._driver.session(database=self._database) as session:
            try:
                return session.execute_read(_read_fulltext)
            except Neo4jError:
                return session.execute_read(_read_fallback)

    async def get_company_graph(self, company_id: str) -> Dict[str, Any]:
        """Return a 2-hop graph:

        (Company)<-[:DIRECTORSHIP]-(Person)-[:DIRECTORSHIP]->(Other Company)

        Output format:
        {
          "nodes": [{"id": str, "name": str|None, "type": "company"|"person"}],
          "links": [{"source": str, "target": str, "role": str|None}]
        }
        """

        query = """
        MATCH (root:Company {ftm_id: $id})
        OPTIONAL MATCH (p:Person)-[r1:DIRECTORSHIP]->(root)
        OPTIONAL MATCH (p)-[r2:DIRECTORSHIP]->(c2:Company)
        WHERE c2 IS NULL OR c2.ftm_id <> root.ftm_id
        RETURN
          root.ftm_id AS root_id,
          root.name AS root_name,
                    coalesce(p.ftm_id, elementId(p)) AS person_id,
          p.name AS person_name,
                    coalesce(c2.ftm_id, elementId(c2)) AS other_company_id,
          c2.name AS other_company_name,
          r1.role AS role_to_root,
          r2.role AS role_to_other
        LIMIT 500
        """

        def _read(tx):
            result = tx.run(query, id=company_id)
            return [record.data() for record in result]

        with self._driver.session(database=self._database) as session:
            rows = session.execute_read(_read)

        nodes_by_id: Dict[str, Dict[str, Any]] = {}
        links_set = set()
        links: List[Dict[str, Any]] = []

        def _add_node(node_id: Optional[str], name: Optional[str], node_type: str) -> None:
            if not node_id:
                return
            if node_id in nodes_by_id:
                if (not nodes_by_id[node_id].get("name")) and name:
                    nodes_by_id[node_id]["name"] = name
                return
            nodes_by_id[node_id] = {"id": node_id, "name": name, "type": node_type}

        def _add_link(source: Optional[str], target: Optional[str], role: Optional[str]) -> None:
            if not source or not target:
                return
            key = (source, target, role or None)
            if key in links_set:
                return
            links_set.add(key)
            links.append({"source": source, "target": target, "role": role or None})

        for row in rows:
            _add_node(row.get("root_id"), row.get("root_name"), "company")
            _add_node(row.get("person_id"), row.get("person_name"), "person")
            _add_node(row.get("other_company_id"), row.get("other_company_name"), "company")

            _add_link(row.get("person_id"), row.get("root_id"), row.get("role_to_root"))
            _add_link(row.get("person_id"), row.get("other_company_id"), row.get("role_to_other"))

        return {"nodes": list(nodes_by_id.values()), "links": links}
    
def get_graph_repository() -> GraphRepository:
    database = os.getenv("NEO4J_DATABASE")
    return GraphRepository(driver=get_neo4j_driver(), database=database)