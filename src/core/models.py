from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator, model_validator

from src.common.types import Side, OrderType, OrderStatus, ProductType, TimeInForce
from src.common.money import to_money
from src.common.exceptions import InvalidOrderError


class TradeEvent(BaseModel):
    """Execution event emitted for an order leg (Option B)."""
    trade_id: str
    order_id: str
    symbol: str
    side: Side
    price: Decimal
    quantity: int = Field(gt=0)
    counterparty_order_id: str
    is_maker: bool
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @field_validator("price")
    @classmethod
    def validate_price(cls, v: Decimal) -> Decimal:
        return to_money(v)


class MatchRecord(BaseModel):
    """Exchange-level atomic match linking maker and taker."""
    match_id: str
    symbol: str
    maker_order_id: str
    taker_order_id: str
    price: Decimal
    quantity: int = Field(gt=0)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    maker_trade_event: Optional[TradeEvent] = None
    taker_trade_event: Optional[TradeEvent] = None

    @field_validator("price")
    @classmethod
    def validate_price(cls, v: Decimal) -> Decimal:
        return to_money(v)


class Order(BaseModel):
    """In-memory order domain model."""
    order_id: str
    symbol: str
    side: Side
    order_type: OrderType
    quantity: int = Field(gt=0)
    price: Optional[Decimal] = None
    trigger_price: Optional[Decimal] = None
    product_type: ProductType = ProductType.CNC
    time_in_force: TimeInForce = TimeInForce.DAY
    status: OrderStatus = OrderStatus.PENDING
    filled_qty: int = 0
    remaining_qty: int = 0
    average_fill_price: Optional[Decimal] = None
    account_id: str = "DEFAULT"
    sequence_id: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @model_validator(mode="after")
    def validate_order(self) -> "Order":
        if self.order_type == OrderType.LIMIT:
            if self.price is None or self.price <= Decimal("0"):
                raise InvalidOrderError(f"LIMIT order '{self.order_id}' requires a positive price.")
            self.price = to_money(self.price)
        elif self.order_type == OrderType.SL:
            if self.trigger_price is None or self.trigger_price <= Decimal("0"):
                raise InvalidOrderError(f"SL order '{self.order_id}' requires a positive trigger_price.")
            if self.price is None or self.price <= Decimal("0"):
                raise InvalidOrderError(f"SL order '{self.order_id}' requires a positive limit price.")
            self.trigger_price = to_money(self.trigger_price)
            self.price = to_money(self.price)
        elif self.order_type == OrderType.SL_M:
            if self.trigger_price is None or self.trigger_price <= Decimal("0"):
                raise InvalidOrderError(f"SL_M order '{self.order_id}' requires a positive trigger_price.")
            self.trigger_price = to_money(self.trigger_price)
        
        # Initial remaining quantity should equal total quantity if not set
        if self.remaining_qty == 0 and self.filled_qty == 0:
            self.remaining_qty = self.quantity

        return self

    @property
    def is_active(self) -> bool:
        """Active orders rest on the book or can be matched."""
        return self.status in (OrderStatus.OPEN, OrderStatus.PARTIALLY_FILLED, OrderStatus.TRIGGER_PENDING)


    @property
    def is_terminal(self) -> bool:
        """Terminal orders cannot change state or be matched."""
        return self.status in (OrderStatus.FILLED, OrderStatus.CANCELLED, OrderStatus.REJECTED)


class MatchResult(BaseModel):
    """Encapsulates the outcome of matching an order against the order book."""
    taker_order: Order
    matches: List[MatchRecord] = Field(default_factory=list)
    trade_events: List[TradeEvent] = Field(default_factory=list)
