from decimal import Decimal
from fastapi import APIRouter, Depends, Query, status

from src.common.money import to_money
from src.core.trade_service import TradeExecutionService
from src.market_data.gateway import MarketDataGateway
from src.api.dependencies import get_trade_service, get_market_gateway
from src.api.schemas.margin import (
    AccountRiskResponse,
    MarginCheckRequest,
    MarginCheckResponse,
    ChargesBreakdownSchema,
)
from src.ledger.charges import IndianRegulatoryChargesCalculator
from src.risk.margin import MarginCalculator

router = APIRouter(prefix="/margin", tags=["Margin"])

_charges_calculator = IndianRegulatoryChargesCalculator()
_margin_calculator = MarginCalculator(charges_calculator=_charges_calculator)


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


@router.post("/check", response_model=MarginCheckResponse, status_code=status.HTTP_200_OK)
def check_margin_and_charges(
    req: MarginCheckRequest,
    trade_service: TradeExecutionService = Depends(get_trade_service),
    gateway: MarketDataGateway = Depends(get_market_gateway),
):
    """
    Validates pre-trade margin sufficiency and returns itemized Indian regulatory
    charges breakdown down to exact paise for the order ticket preview.
    """
    acc = trade_service.get_account(req.account_id)
    available_margin = acc.available_margin

    # Determine effective price for preview
    if req.price is not None and req.price > Decimal("0.00"):
        price = req.price
    elif req.trigger_price is not None and req.trigger_price > Decimal("0.00"):
        price = req.trigger_price
    else:
        # Fallback to current market LTP or baseline
        latest = gateway.get_latest_depth(req.symbol)
        price = latest.ltp if (latest and latest.ltp > Decimal("0.00")) else Decimal("2500.00")

    # Compute margin requirement and trade charges
    margin_req = _margin_calculator.calculate_margin(
        side=req.side,
        product_type=req.product_type,
        price=price,
        quantity=req.quantity,
    )
    trade_charges = _charges_calculator.calculate_trade_charges(
        side=req.side,
        product_type=req.product_type,
        price=price,
        quantity=req.quantity,
    )

    required_margin = margin_req.total_required_margin
    sufficient = available_margin >= required_margin
    shortfall = Decimal("0.00") if sufficient else to_money(required_margin - available_margin)

    return MarginCheckResponse(
        sufficient=sufficient,
        required_margin=required_margin,
        available_margin=available_margin,
        shortfall=shortfall,
        charges=ChargesBreakdownSchema(
            turnover=trade_charges.turnover,
            brokerage=trade_charges.brokerage,
            stt=trade_charges.stt,
            exchange_turnover=trade_charges.exchange_turnover_charge,
            sebi_fees=trade_charges.sebi_turnover_charge,
            stamp_duty=trade_charges.stamp_duty,
            gst=trade_charges.gst,
            total_charges=trade_charges.total_charges,
        ),
    )
