from datetime import datetime, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, Query

from src.core.trade_service import TradeExecutionService
from src.api.dependencies import get_trade_service
from src.common.types import LedgerCategory
from src.api.schemas.ledger import (
    CustomerCashEntryResponse,
    LedgerSummaryResponse,
    TAccountItemResponse,
    TAccountsOverviewResponse,
    ContractNoteSummaryResponse,
)

router = APIRouter(prefix="/ledger", tags=["Ledger"])


@router.get("", response_model=LedgerSummaryResponse)
@router.get("/entries", response_model=LedgerSummaryResponse)
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


@router.get("/t-accounts", response_model=TAccountsOverviewResponse)
def get_t_accounts(
    account_id: str = Query(default="DEFAULT"),
    trade_service: TradeExecutionService = Depends(get_trade_service),
):
    """
    Returns summarized Double-Entry T-Accounts balancing Total Debits == Total Credits.
    Fulfills PS-05 Section 12 and plan.txt Sections 24 & 45.
    """
    t_accounts = trade_service.ledger.get_all_t_accounts()
    items = []
    total_debits = Decimal("0.00")
    total_credits = Decimal("0.00")

    for cat_name, acc in t_accounts.items():
        total_debits += acc.total_debits
        total_credits += acc.total_credits
        items.append(
            TAccountItemResponse(
                category=cat_name,
                total_debits=acc.total_debits,
                total_credits=acc.total_credits,
                net_balance=acc.total_debits - acc.total_credits,
            )
        )

    discrepancy = abs(total_debits - total_credits)
    is_balanced = (discrepancy == Decimal("0.00"))

    return TAccountsOverviewResponse(
        total_debits=total_debits,
        total_credits=total_credits,
        discrepancy=discrepancy,
        is_balanced=is_balanced,
        accounts=sorted(items, key=lambda x: x.category),
        timestamp=datetime.now(timezone.utc),
    )


@router.get("/contract-notes", response_model=ContractNoteSummaryResponse)
def get_contract_notes_summary(
    account_id: str = Query(default="DEFAULT"),
    trade_service: TradeExecutionService = Depends(get_trade_service),
):
    """
    Returns aggregated statutory tax and regulatory charges breakdown per settlement.
    """
    entries = trade_service.ledger.get_entries(account_id)
    trades = trade_service.get_trades(account_id)

    total_brokerage = Decimal("0.00")
    total_stt = Decimal("0.00")
    total_turnover = Decimal("0.00")
    total_sebi = Decimal("0.00")
    total_stamp = Decimal("0.00")
    total_gst = Decimal("0.00")

    for e in entries:
        if e.category == LedgerCategory.BROKERAGE_CHARGE:
            total_brokerage += e.debit
        elif e.category == LedgerCategory.STT_CHARGE:
            total_stt += e.debit
        elif e.category == LedgerCategory.EXCHANGE_TURNOVER_CHARGE:
            total_turnover += e.debit
        elif e.category == LedgerCategory.SEBI_TURNOVER_CHARGE:
            total_sebi += e.debit
        elif e.category == LedgerCategory.STAMP_DUTY_CHARGE:
            total_stamp += e.debit
        elif e.category == LedgerCategory.GST_CHARGE:
            total_gst += e.debit

    total_charges = total_brokerage + total_stt + total_turnover + total_sebi + total_stamp + total_gst

    return ContractNoteSummaryResponse(
        account_id=account_id,
        total_brokerage=total_brokerage,
        total_stt=total_stt,
        total_exchange_turnover=total_turnover,
        total_sebi_fees=total_sebi,
        total_stamp_duty=total_stamp,
        total_gst=total_gst,
        total_charges=total_charges,
        trades_count=len(trades),
    )

