from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field

from src.common.types import ProductType
from src.common.money import to_money


class Position(BaseModel):
    """Real-time active or closed position for a symbol and product type."""
    account_id: str
    symbol: str
    product_type: ProductType
    quantity: int = 0                       # Positive = Long, Negative = Short, 0 = Flat/Closed
    average_price: Decimal = Decimal("0.00")# Volume Weighted Average Price (VWAP)
    realized_pnl: Decimal = Decimal("0.00") # Cumulative realized profit/loss
    unrealized_pnl: Decimal = Decimal("0.00")# Mark-to-Market (MTM) P&L based on LTP
    total_charges: Decimal = Decimal("0.00")# Total incurred regulatory charges & brokerage

    @property
    def average_entry_price(self) -> Decimal:
        return self.average_price

    @property
    def is_open(self) -> bool:
        return self.quantity != 0

    @property
    def is_long(self) -> bool:
        return self.quantity > 0

    @property
    def is_short(self) -> bool:
        return self.quantity < 0

    @property
    def gross_pnl(self) -> Decimal:
        """Gross P&L = Realized P&L + Unrealized MTM P&L."""
        return to_money(self.realized_pnl + self.unrealized_pnl)

    @property
    def net_pnl(self) -> Decimal:
        """Net P&L = Gross P&L - Incurred Charges."""
        return to_money(self.gross_pnl - self.total_charges)


class Holding(BaseModel):
    """Delivery (CNC) holding residing in the user's account portfolio."""
    account_id: str
    symbol: str
    quantity: int = Field(ge=0)
    average_buy_price: Decimal = Decimal("0.00")
    current_price: Optional[Decimal] = None


class PortfolioSummary(BaseModel):
    """Comprehensive portfolio summary for an account."""
    account_id: str
    total_realized_pnl: Decimal = Decimal("0.00")
    total_unrealized_pnl: Decimal = Decimal("0.00")
    total_charges: Decimal = Decimal("0.00")
    gross_pnl: Decimal = Decimal("0.00")
    net_pnl: Decimal = Decimal("0.00")
    open_positions_count: int = 0
    positions: List[Position] = Field(default_factory=list)
    holdings: List[Holding] = Field(default_factory=list)
