from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel

from src.common.types import ProductType


class PositionResponse(BaseModel):
    account_id: str
    symbol: str
    product_type: ProductType
    quantity: int
    average_price: Decimal
    realized_pnl: Decimal
    unrealized_pnl: Decimal
    total_charges: Decimal
    net_pnl: Decimal
    is_open: bool
    is_long: bool


class HoldingResponse(BaseModel):
    account_id: str
    symbol: str
    quantity: int
    average_buy_price: Decimal


class PortfolioSummaryResponse(BaseModel):
    account_id: str
    total_realized_pnl: Decimal
    total_unrealized_pnl: Decimal
    total_charges: Decimal
    gross_pnl: Decimal
    net_pnl: Decimal
    open_positions_count: int
    positions: List[PositionResponse]
    holdings: List[HoldingResponse]
