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


class TAccountItemResponse(BaseModel):
    category: str
    total_debits: Decimal
    total_credits: Decimal
    net_balance: Decimal


class TAccountsOverviewResponse(BaseModel):
    total_debits: Decimal
    total_credits: Decimal
    discrepancy: Decimal
    is_balanced: bool
    accounts: List[TAccountItemResponse]
    timestamp: datetime


class ContractNoteSummaryResponse(BaseModel):
    account_id: str
    total_brokerage: Decimal
    total_stt: Decimal
    total_exchange_turnover: Decimal
    total_sebi_fees: Decimal
    total_stamp_duty: Decimal
    total_gst: Decimal
    total_charges: Decimal
    trades_count: int

