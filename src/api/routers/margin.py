from decimal import Decimal
from fastapi import APIRouter, Depends, Query

from src.common.money import to_money
from src.core.trade_service import TradeExecutionService
from src.api.dependencies import get_trade_service
from src.api.schemas.margin import AccountRiskResponse

router = APIRouter(prefix="/margin", tags=["Margin"])


@router.get("", response_model=AccountRiskResponse)
def get_margin(
    account_id: str = Query(default="DEFAULT"),
    trade_service: TradeExecutionService = Depends(get_trade_service),
):
    """
    Retrieves real-time pre-trade and intraday margin status, including
    available margin, blocked margin, and margin utilization percentage.
    """
    acc = trade_service.get_account(account_id)
    total_capital = acc.cash_balance + acc.realized_pnl
    used_margin = acc.blocked_margin + acc.position_margin

    if total_capital > Decimal("0.00"):
        utilization = to_money((used_margin / total_capital) * Decimal("100.00"))
    else:
        utilization = Decimal("0.00") if used_margin == Decimal("0.00") else Decimal("100.00")

    return AccountRiskResponse(
        account_id=acc.account_id,
        cash_balance=acc.cash_balance,
        realized_pnl=acc.realized_pnl,
        blocked_margin=acc.blocked_margin,
        position_margin=acc.position_margin,
        available_margin=acc.available_margin,
        free_cash=acc.free_cash,
        margin_utilization_pct=utilization,
    )
