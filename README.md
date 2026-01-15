<<<<<<< HEAD
# Construction Radar

## Start
Kontext Hier ist die perfekte **`README.md`**, die als "System-Prompt" oder Kontext-Datei für deinen KI-Agenten (Cursor, Windsurf, ChatGPT) dient.

Speichere diesen Text als `README.md` im Hauptverzeichnis deines Projekts. Wenn du eine neue Session mit einer KI startest, sagst du einfach: *"Lies die README.md und hilf mir bei Schritt X"*.

---

# 🏗️ Construction Radar (MVP)

## 1. Projekt-Kontext & Vision

**Construction Radar** ist eine Business-Intelligence-Plattform für die deutsche Bauwirtschaft.
**Das Problem:** Bauherren und Generalunternehmer verlieren Geld durch Insolvenzen von Subunternehmern. Oft werden insolvente Firmen ("Bestattungen") unter neuem Namen oder über Strohmänner (Verwandte) an gleicher Adresse fortgeführt ("Phönix-Firmen").
**Die Lösung:** Eine Web-App, die historische Netzwerke visualisiert und aktuelle Bonitätsrisiken prüft.

## 2. Architektur-Strategie: "Hybrid & Mock-First"

Wir verfolgen einen **hybriden Datenansatz**, um Kosten zu sparen und dennoch tiefgehende Analysen zu ermöglichen.

### A. Der "Cold Storage" (Historischer Graph)

* **Quelle:** `OffeneRegister.de` (Historischer Dump `de_companies_ocdata.jsonl.gz`).
* **Technologie:** **Neo4j** (Graph Database).
* **Zweck:** Erkennung von Netzwerken, "Cousin"-Beziehungen und Adress-Clustern. Diese Daten sind statisch (Stand ~2019/2021), aber essenziell für die Struktur-Analyse.

### B. Der "Hot Storage" (Live-Status Check)

* **Quelle:** Später externe APIs (North Data / Creditreform).
* **Aktueller Status (MVP):** **Mock-Service**.
* **Architektur-Muster:** Hexagonale Architektur / Dependency Injection.
* **Zweck:** Simulation von Live-Abfragen ("Ist die Firma *heute* insolvent?"). Wir bauen eine Schnittstelle, die aktuell simulierte Daten liefert, aber später durch Änderung einer einzigen Zeile Code auf eine echte API umgeschaltet werden kann.

---

## 3. Tech Stack (Constraints)

* **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, **Shadcn UI** (Komponenten), **Tremor** (Dashboards), **React Flow** (Graph-Visualisierung).
* **Backend:** Python 3.11, **FastAPI**.
* **Datenbank:** **Neo4j 5.x** (Community Edition) mit **APOC Plugin**.
* **Infrastruktur:** Docker & Docker Compose.
* **Daten-Ingest:** Python Scripts mit `ijson` (für speicherschonendes Streaming der riesigen JSONL-Datei).

---

## 4. Daten-Modell & Ingestion (WICHTIG!)

### Quell-Datenformat (OffeneRegister JSONL)

Die KI muss wissen, wie die Rohdaten aussehen, um den Parser zu schreiben.
**Beispiel einer Zeile:**

```json
{
  "all_attributes": { "_registerArt": "HRB", "native_company_number": "Hamburg HRB 150148", "registered_office": "Hamburg" },
  "company_number": "K1101R_HRB150148",
  "current_status": "currently registered",
  "name": "olly UG (haftungsbeschränkt)",
  "officers": [
    {
      "name": "Oliver Keunecke",
      "position": "Geschäftsführer",
      "start_date": "2018-02-06",
      "other_attributes": { "city": "Hamburg" }
    }
  ],
  "registered_address": "Waidmannstraße 1, 22769 Hamburg."
}

```

### Ziel-Schema in Neo4j

Wir transformieren das flache JSON in einen Graphen:

1. **Nodes:**
* `(:Company {id, name, city, zip_code})`
* `(:Officer {name, city})` (Deduplizierung über Name + Stadt)
* `(:Address {full_address, zip})`


2. **Relationships:**
* `(:Officer)-->(:Company)`
* `(:Company)-->(:Address)`



---

## 5. Implementierungs-Logik (Backend)

### Der "Mock Status Provider"

Das Backend muss ein Interface `BaseStatusProvider` definieren. Die Implementierung `MockStatusProvider` muss **deterministisch** arbeiten, damit wir im Frontend testen können:

* **Logik:**
* Input: `company_name` enthält "Insolvenz" oder "Liquid" -> **Status: INSOLVENT (Rot)**.
* Input: `company_id` endet auf `9` -> **Status: WARNING (Gelb)**.
* Sonst -> **Status: ACTIVE (Grün)**.


* **Verzögerung:** Füge `time.sleep(0.5)` ein, um echte API-Latenz zu simulieren (für Lade-States im UI).

---

## 6. Development Roadmap (Für den Agenten)

Führe diese Schritte in dieser Reihenfolge aus:

1. **Setup Infrastructure:** Erstelle `docker-compose.yml` mit Neo4j (inkl. APOC Env-Vars) und Python/Node Containern.
2. **Backend Core:** Initiiere FastAPI. Erstelle das Dependency Injection System für den Status-Check (Switch via ENV Variable `USE_MOCK=True`).
3. **Ingestion Script:** Schreibe `ingest.py`. Nutze `ijson`. Erstelle VOR dem Import Indizes in Neo4j (`CREATE INDEX...`). Importiere Companies und Officers als Knoten.
4. **Backend Graph Queries:** Schreibe Cypher-Queries, die "Phönix-Muster" erkennen (z.B. "Finde alle Firmen an dieser Adresse" oder "Welche anderen Firmen hat dieser Geschäftsführer?").
5. **Frontend:** Baue das Dashboard mit Next.js. Integriere die Suche und die Detailansicht mit dem Mock-Status (Rot/Gelb/Grün Badge).

---

## 7. Wichtige Regeln für den KI-Agenten

* **Speicher-Effizienz:** Lade NIEMALS die ganze `.jsonl.gz` Datei in den RAM. Nutze immer Streaming.
* **Neo4j Performance:** Nutze `UNWIND` für Batch-Inserts (z.B. 5000 Nodes pro Transaktion).
* **Typsicherheit:** Nutze Pydantic Models für alle API Responses.
* **Keine echten API Keys:** Wir nutzen NUR den Mock-Provider in dieser Phase.
Voraussetzungen:
- Docker Desktop (oder Docker Engine) + Docker Compose

Starten:

```bash
docker-compose up
```

Services:
- Neo4j: http://localhost:7474 (Bolt: localhost:7687), Login: `neo4j` / `testpassword`
- Backend (FastAPI): http://localhost:8000 (Healthcheck: `/health`)

## Backend API

### Live Check

Endpoint:

`GET /companies/{id}/live-check`

Beispiel:

```bash
curl http://localhost:8000/companies/<FTM_ID>/live-check
```

Response (Beispiel):

```json
{
	"company_id": "...",
	"name": "...",
	"address": "...",
	"status": "ACTIVE"
}
```

Statuswerte:
- `ACTIVE`
- `INSOLVENT`
- `LIQUIDATION`
- `WARNING`
- `UNKNOWN`
- `DELETED`

### Backend Konfiguration (ENV)

- `USE_MOCK_DATA`: Wenn truthy (`true|1|yes|on`), nutzt das Backend den Mock Provider für den Live-Check (Default: `true`).
- `NEO4J_URI`: z.B. `bolt://neo4j:7687` (Default passt zu docker-compose)
- `NEO4J_USER`: Default `neo4j`
- `NEO4J_PASSWORD`: Default `test`
- `NEO4J_DATABASE`: Optional (leer lassen für Default-DB)

## Import (entities.ftm.json → Neo4j)

Lege die Datei unter `data/entities.ftm.json` ab und starte dann den Import im Backend-Container:

```bash
docker-compose run --rm backend python ingest.py
```

## Ordner

- `backend/` FastAPI + Neo4j Client
- `frontend/` Next.js 14 (App Router) UI
- `data/` JSON Dumps

## Frontend (Next.js)

### Lokal starten

```bash
cd frontend
npm install
npm run dev
```

Das Frontend erwartet standardmäßig das Backend unter `http://localhost:8000`.
Optional kannst du eine andere Base-URL setzen:

```bash
set NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

Hinweis: Wenn du Frontend (Port 3000) und Backend (Port 8000) getrennt lokal laufen lässt, kann CORS relevant sein.

=======
# company_radar
>>>>>>> 5952dde3bc04ce9c7db13046be84c076a12f020a
