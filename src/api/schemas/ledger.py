from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel

from src.common.types import LedgerCategory


class CustomerCashEntryResponse(BaseModel):
    entry_id: str
    account_id: str
    category: LedgerCategory
    debit: Decimal
    credit: Decimal
    running_balance: Decimal
    reference_id: str
    description: str
    timestamp: datetime


class LedgerSummaryResponse(BaseModel):
    account_id: str
    running_balance: Decimal
    entries_count: int
    entries: List[CustomerCashEntryResponse]
