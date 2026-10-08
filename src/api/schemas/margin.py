from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field

from src.common.types import Side, OrderType, ProductType


class AccountRiskResponse(BaseModel):
    account_id: str
    cash_balance: Decimal
    realized_pnl: Decimal
    blocked_margin: Decimal
    position_margin: Decimal
    available_margin: Decimal
    free_cash: Decimal
    margin_utilization_pct: Decimal


class ChargesBreakdownSchema(BaseModel):
    turnover: Decimal
    brokerage: Decimal
    stt: Decimal
    exchange_turnover: Decimal
    sebi_fees: Decimal
    stamp_duty: Decimal
    gst: Decimal
    total_charges: Decimal


class MarginCheckRequest(BaseModel):
    account_id: str = Field(default="DEFAULT")
    symbol: str
    side: Side
    order_type: OrderType
    product_type: ProductType
    quantity: int = Field(gt=0)
    price: Optional[Decimal] = None
    trigger_price: Optional[Decimal] = None


class MarginCheckResponse(BaseModel):
    sufficient: bool
    required_margin: Decimal
    available_margin: Decimal
    shortfall: Decimal = Decimal("0.00")
    charges: ChargesBreakdownSchema
