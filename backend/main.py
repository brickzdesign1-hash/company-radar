from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers.companies import router as companies_router

app = FastAPI(title="Construction Radar")

# CORS Konfiguration hinzufügen
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Im Produktivbetrieb auf die Frontend-URL einschränken
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(companies_router)

@app.get("/health")
def health() -> dict:
    return {"status": "ok"}