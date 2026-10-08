from fastapi import APIRouter, Depends, Query

from src.core.trade_service import TradeExecutionService
from src.api.dependencies import get_trade_service
from src.api.schemas.ledger import (
    CustomerCashEntryResponse,
    LedgerSummaryResponse,
)

router = APIRouter(prefix="/ledger", tags=["Ledger"])


@router.get("", response_model=LedgerSummaryResponse)
def get_ledger(
    account_id: str = Query(default="DEFAULT"),
    trade_service: TradeExecutionService = Depends(get_trade_service),
):
    """
    Returns the immutable chronological double-entry customer cash journal
    with exact paisa running balance.
    """
    entries = trade_service.ledger.get_entries(account_id)
    running_bal = trade_service.ledger.get_running_balance(account_id)

    response_entries = [
        CustomerCashEntryResponse(
            entry_id=e.entry_id,
            account_id=e.account_id,
            category=e.category,
            debit=e.debit,
            credit=e.credit,
            running_balance=e.running_balance,
            reference_id=e.reference_id,
            description=e.description,
            timestamp=e.timestamp,
        )
        for e in entries
    ]

    return LedgerSummaryResponse(
        account_id=account_id,
        running_balance=running_bal,
        entries_count=len(response_entries),
        entries=response_entries,
    )
