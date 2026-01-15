from __future__ import annotations

import asyncio
from typing import Protocol

from app.models.company import CompanyStatus


class CompanyStatusProvider(Protocol):
    async def check_status(self, company_id: str, name: str) -> CompanyStatus:
        ...


class MockStatusProvider:
    async def check_status(self, company_id: str, name: str) -> CompanyStatus:
        await asyncio.sleep(0.5)

        normalized_name = (name or "").casefold()

        if "insolvenz" in normalized_name:
            return CompanyStatus.INSOLVENT

        if "liquidation" in normalized_name or "abwicklung" in normalized_name:
            return CompanyStatus.LIQUIDATION

        if "löschung" in normalized_name or "loeschung" in normalized_name:
            return CompanyStatus.DELETED

        if (company_id or "").endswith("9"):
            return CompanyStatus.WARNING

        return CompanyStatus.ACTIVE


class NorthDataStatusProvider:
    """Placeholder for a future real integration.

    For now it simulates network latency and returns UNKNOWN.
    """

    async def check_status(self, company_id: str, name: str) -> CompanyStatus:
        await asyncio.sleep(0.5)
        return CompanyStatus.UNKNOWN
