from __future__ import annotations

import itertools
import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_repo, get_status_provider
from app.models.company import CompanyCheckResponse
from app.repositories.graph_repository import GraphRepository
from app.services.status_provider import CompanyStatusProvider

router = APIRouter(prefix="/companies", tags=["companies"])

# Load mock datasets
hochtief_data_path = Path(__file__).parent.parent.parent / "hochtiefag.json"
with open(hochtief_data_path, "r", encoding="utf-8") as f:
    hochtief_data = json.load(f)


@router.get("/{id}/live-check", response_model=CompanyCheckResponse)
async def live_check_company(
    id: str,
    repo: GraphRepository = Depends(get_repo),
    status_provider: CompanyStatusProvider = Depends(get_status_provider),
) -> CompanyCheckResponse:
    details = await repo.get_company_details(id)
    if details is None:
        raise HTTPException(status_code=404, detail="Company not found")

    status = await status_provider.check_status(company_id=id, name=details.name)

    return CompanyCheckResponse(
        company_id=id,
        name=details.name,
        address=details.address,
        status=status,
    )


@router.get("/{id}/network")
async def get_company_network(
    id: str,
    repo: GraphRepository = Depends(get_repo),
):
    network = await repo.get_company_network(id)
    return {"company_id": id, "officers": network}


@router.get("/{id}/graph")
async def get_company_graph(
    id: str,
    repo: GraphRepository = Depends(get_repo),
):
    graph = await repo.get_company_graph(id)
    return graph


@router.get("/search")
async def search(q: str, repo: GraphRepository = Depends(get_repo)):
    results = await repo.search_companies(q)
    return results

# OroraTech mock dataset
ororatech_data = {
        "entity_id": "82a68ab9f7151fa0af9bf189c1caa753",
        "name": "OroraTech GmbH",
        "status": "ACTIVE",
        "legal_form": "GmbH",
        "address": {
            "house_number": "112",
            "street": "Sankt-Martin-Straße",
            "postal_code": "81669",
            "city": "München",
            "county": "München (Stadt)",
            "state": "Bayern",
            "country": "DEU",
            "coordinates": {"latitude": 48.11983, "longitude": 11.60264}
        },
        "registration": {
            "court": "München",
            "register_type": "HRB",
            "register_number": "243843"
        },
        "purpose": "Aufbau und Betrieb einer Nanosatellitenkonstellation, Erhebung und Verarbeitung von Fernerkundungsdaten sowie Verkauf von Daten, cloud-basierten Diensten und Software zur globalen Überwachung thermischer Veränderungen (z. B. Waldbrände) und Bereitstellung von Echtzeit-Wildfire-Intelligence",
        "keywords": ["Satellitensensorik", "Fernerkundung", "Waldbrand-Früherkennung", "Echtzeit-Analyse", "SaaS-Datenservices"],
        "products_and_services": [
            "Wildfire Solution (Plattform für Früherkennung und Überwachung von Waldbränden)",
            "Fire Spread (prognostische Feuerausbreitungs-Insights)",
            "Burnt Area (Analyse verbrannter Flächen)",
            "Land Surface Temperature (thermische Oberflächendaten)",
            "Verkauf von Satellitendaten und cloud-basierten Analyse-APIs"
        ],
        "contact_data": {
            "website": "https://www.ororatech.com",
            "phone_number": "+49 89 46139487",
            "email": "info@ororatech.com"
        },
        "industry_classification": {
            "WZ2008": [
                {"code": "62.01.9", "label": "Sonstige Softwareentwicklung"},
                {"code": "64.20.0", "label": "Dienstleistungen der Informationstechnologie"},
                {"code": "30.00.0", "label": "Herstellung von Luft- und Raumfahrzeugen"}
            ],
            "WZ2025": [
                {"code": "61.10.2", "label": "Drahtlose Telekommunikation und Satellitentelekommunikation"},
                {"code": "63.10.9", "label": "Datenverarbeitung, Hosting und damit verbundene Tätigkeiten"},
                {"code": "30.31.0", "label": "Luft- und Raumfahrzeugbau für zivile Zwecke"}
            ]
        },
        "registration_date": "2018-09-28T00:00:00+00:00",
        
        # ============ MULTI-YEAR BALANCE SHEET DATA ============
        "balance_sheet_accounts": [
            # 2024 - Post Series B
            {
                "year": 2024,
                "balance_sheet_accounts": [
                    {
                        "name": {"de": "Aktivseite", "en": "Assets"},
                        "value": 36658870.14,
                        "children": [
                            {
                                "name": {"de": "Anlagevermögen", "en": "Fixed Assets"},
                                "value": 8194065.82,
                                "children": [
                                    {"name": {"de": "Immaterielle Vermögensgegenstände", "en": "Intangible Assets"}, "value": 6354723.14},
                                    {"name": {"de": "Sachanlagen", "en": "Tangible Assets"}, "value": 1766662.45},
                                    {"name": {"de": "Finanzanlagen", "en": "Financial Assets"}, "value": 72680.23}
                                ]
                            },
                            {
                                "name": {"de": "Umlaufvermögen", "en": "Current Assets"},
                                "value": 28385687.29,
                                "children": [
                                    {"name": {"de": "Vorräte", "en": "Inventories"}, "value": 2759295.80},
                                    {"name": {"de": "Forderungen", "en": "Receivables"}, "value": 1147474.19},
                                    {"name": {"de": "Liquide Mittel", "en": "Cash"}, "value": 24478917.30}
                                ]
                            },
                            {"name": {"de": "Rechnungsabgrenzungsposten", "en": "Prepaid Expenses"}, "value": 79117.03}
                        ]
                    },
                    {
                        "name": {"de": "Passivseite", "en": "Liabilities and Equity"},
                        "value": 36658870.14,
                        "children": [
                            {"name": {"de": "Eigenkapital", "en": "Equity"}, "value": 29338866.03},
                            {"name": {"de": "Rückstellungen", "en": "Provisions"}, "value": 702801.53},
                            {"name": {"de": "Verbindlichkeiten", "en": "Liabilities"}, "value": 6314038.50},
                            {"name": {"de": "Passive RAP", "en": "Accrued Expenses"}, "value": 303164.08}
                        ]
                    }
                ]
            },
            # 2023 - Pre Series B
            {
                "year": 2023,
                "balance_sheet_accounts": [
                    {
                        "name": {"de": "Aktivseite", "en": "Assets"},
                        "value": 14832456.00,
                        "children": [
                            {
                                "name": {"de": "Anlagevermögen", "en": "Fixed Assets"},
                                "value": 5234567.00,
                                "children": [
                                    {"name": {"de": "Immaterielle Vermögensgegenstände", "en": "Intangible Assets"}, "value": 3845123.00},
                                    {"name": {"de": "Sachanlagen", "en": "Tangible Assets"}, "value": 1324444.00},
                                    {"name": {"de": "Finanzanlagen", "en": "Financial Assets"}, "value": 65000.00}
                                ]
                            },
                            {
                                "name": {"de": "Umlaufvermögen", "en": "Current Assets"},
                                "value": 9547889.00,
                                "children": [
                                    {"name": {"de": "Vorräte", "en": "Inventories"}, "value": 1876543.00},
                                    {"name": {"de": "Forderungen", "en": "Receivables"}, "value": 892346.00},
                                    {"name": {"de": "Liquide Mittel", "en": "Cash"}, "value": 6779000.00}
                                ]
                            },
                            {"name": {"de": "Rechnungsabgrenzungsposten", "en": "Prepaid Expenses"}, "value": 50000.00}
                        ]
                    },
                    {
                        "name": {"de": "Passivseite", "en": "Liabilities and Equity"},
                        "value": 14832456.00,
                        "children": [
                            {"name": {"de": "Eigenkapital", "en": "Equity"}, "value": 8234567.00},
                            {"name": {"de": "Rückstellungen", "en": "Provisions"}, "value": 456789.00},
                            {"name": {"de": "Verbindlichkeiten", "en": "Liabilities"}, "value": 5891100.00},
                            {"name": {"de": "Passive RAP", "en": "Accrued Expenses"}, "value": 250000.00}
                        ]
                    }
                ]
            },
            # 2022 - Series A Growth
            {
                "year": 2022,
                "balance_sheet_accounts": [
                    {
                        "name": {"de": "Aktivseite", "en": "Assets"},
                        "value": 9876543.00,
                        "children": [
                            {
                                "name": {"de": "Anlagevermögen", "en": "Fixed Assets"},
                                "value": 3456789.00,
                                "children": [
                                    {"name": {"de": "Immaterielle Vermögensgegenstände", "en": "Intangible Assets"}, "value": 2345678.00},
                                    {"name": {"de": "Sachanlagen", "en": "Tangible Assets"}, "value": 1056111.00},
                                    {"name": {"de": "Finanzanlagen", "en": "Financial Assets"}, "value": 55000.00}
                                ]
                            },
                            {
                                "name": {"de": "Umlaufvermögen", "en": "Current Assets"},
                                "value": 6369754.00,
                                "children": [
                                    {"name": {"de": "Vorräte", "en": "Inventories"}, "value": 987654.00},
                                    {"name": {"de": "Forderungen", "en": "Receivables"}, "value": 654321.00},
                                    {"name": {"de": "Liquide Mittel", "en": "Cash"}, "value": 4727779.00}
                                ]
                            },
                            {"name": {"de": "Rechnungsabgrenzungsposten", "en": "Prepaid Expenses"}, "value": 50000.00}
                        ]
                    },
                    {
                        "name": {"de": "Passivseite", "en": "Liabilities and Equity"},
                        "value": 9876543.00,
                        "children": [
                            {"name": {"de": "Eigenkapital", "en": "Equity"}, "value": 5432198.00},
                            {"name": {"de": "Rückstellungen", "en": "Provisions"}, "value": 345678.00},
                            {"name": {"de": "Verbindlichkeiten", "en": "Liabilities"}, "value": 3898667.00},
                            {"name": {"de": "Passive RAP", "en": "Accrued Expenses"}, "value": 200000.00}
                        ]
                    }
                ]
            },
            # 2021 - Early Stage
            {
                "year": 2021,
                "balance_sheet_accounts": [
                    {
                        "name": {"de": "Aktivseite", "en": "Assets"},
                        "value": 5432109.00,
                        "children": [
                            {
                                "name": {"de": "Anlagevermögen", "en": "Fixed Assets"},
                                "value": 1987654.00,
                                "children": [
                                    {"name": {"de": "Immaterielle Vermögensgegenstände", "en": "Intangible Assets"}, "value": 1234567.00},
                                    {"name": {"de": "Sachanlagen", "en": "Tangible Assets"}, "value": 703087.00},
                                    {"name": {"de": "Finanzanlagen", "en": "Financial Assets"}, "value": 50000.00}
                                ]
                            },
                            {
                                "name": {"de": "Umlaufvermögen", "en": "Current Assets"},
                                "value": 3414455.00,
                                "children": [
                                    {"name": {"de": "Vorräte", "en": "Inventories"}, "value": 543210.00},
                                    {"name": {"de": "Forderungen", "en": "Receivables"}, "value": 432198.00},
                                    {"name": {"de": "Liquide Mittel", "en": "Cash"}, "value": 2439047.00}
                                ]
                            },
                            {"name": {"de": "Rechnungsabgrenzungsposten", "en": "Prepaid Expenses"}, "value": 30000.00}
                        ]
                    },
                    {
                        "name": {"de": "Passivseite", "en": "Liabilities and Equity"},
                        "value": 5432109.00,
                        "children": [
                            {"name": {"de": "Eigenkapital", "en": "Equity"}, "value": 2876543.00},
                            {"name": {"de": "Rückstellungen", "en": "Provisions"}, "value": 234567.00},
                            {"name": {"de": "Verbindlichkeiten", "en": "Liabilities"}, "value": 2170999.00},
                            {"name": {"de": "Passive RAP", "en": "Accrued Expenses"}, "value": 150000.00}
                        ]
                    }
                ]
            }
        ],
        
        # ============ MULTI-YEAR KPIs ============
        "financial_kpi": [
            {"year": 2024, "active_total": 36658870.14, "net_income": -501203.58, "employees": 87, "revenue": 4200000},
            {"year": 2023, "active_total": 14832456.00, "net_income": -1234567.00, "employees": 62, "revenue": 2800000},
            {"year": 2022, "active_total": 9876543.00, "net_income": -876543.00, "employees": 45, "revenue": 1500000},
            {"year": 2021, "active_total": 5432109.00, "net_income": -543210.00, "employees": 28, "revenue": 650000}
        ],
        
        "profit_and_loss_account": [],
        "insolvency_publications": [],
        "annual_financial_statements": [
            {"year": 2024, "type": "Jahresabschluss", "available": True},
            {"year": 2023, "type": "Jahresabschluss", "available": True},
            {"year": 2022, "type": "Jahresabschluss", "available": True},
            {"year": 2021, "type": "Jahresabschluss", "available": True}
        ],
        "history": []
    }

# Create rotating iterator with both datasets
_mock_data_cycle = itertools.cycle([ororatech_data, hochtief_data])

@router.get("/{id}/hr-ai-mock")
async def get_handelsregister_ai_mock(id: str):
    """
    Enhanced mock data with rotating datasets for comprehensive analysis.
    Alternates between OroraTech GmbH and HOCHTIEF AG on each request.
    """
    return next(_mock_data_cycle)
