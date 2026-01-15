from __future__ import annotations

import os

from app.repositories.graph_repository import GraphRepository, get_graph_repository
from app.services.status_provider import (
    CompanyStatusProvider,
    MockStatusProvider,
    NorthDataStatusProvider,
)


def _env_truthy(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "y", "on"}


def get_status_provider() -> CompanyStatusProvider:
    if _env_truthy("USE_MOCK_DATA", default=True):
        return MockStatusProvider()
    return NorthDataStatusProvider()


def get_repo() -> GraphRepository:
    return get_graph_repository()
