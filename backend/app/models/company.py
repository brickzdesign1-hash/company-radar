from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel


class CompanyStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INSOLVENT = "INSOLVENT"
    LIQUIDATION = "LIQUIDATION"
    WARNING = "WARNING"
    UNKNOWN = "UNKNOWN"
    # NOTE: The prompt requires returning DELETED for "Löschung".
    # This value is added so the API can represent that state.
    DELETED = "DELETED"


class CompanyCheckResponse(BaseModel):
    company_id: str
    name: str
    address: Optional[str] = None
    status: CompanyStatus
