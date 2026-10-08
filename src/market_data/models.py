from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator

from src.common.money import to_money


class DepthLevel(BaseModel):
    """Represents a single price level in the market depth."""
    price: Decimal
    quantity: int = Field(ge=0)
    orders_count: Optional[int] = Field(default=None, ge=0)

    @field_validator("price")
    @classmethod
    def validate_price(cls, v: Decimal) -> Decimal:
        return to_money(v)


class MarketDepth(BaseModel):
    """
    Standardized internal L2 Market Depth DTO representing the Top 5 Bids and Top 5 Asks.
    """
    symbol: str
    ltp: Decimal
    bids: List[DepthLevel] = Field(default_factory=list)
    asks: List[DepthLevel] = Field(default_factory=list)
    total_buy_quantity: int = 0
    total_sell_quantity: int = 0
    volume: int = 0
    open_price: Optional[Decimal] = None
    high_price: Optional[Decimal] = None
    low_price: Optional[Decimal] = None
    close_price: Optional[Decimal] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    sequence_id: int = 0

    @field_validator("ltp", "open_price", "high_price", "low_price", "close_price")
    @classmethod
    def validate_prices(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is not None:
            return to_money(v)
        return None

    @property
    def best_bid(self) -> Optional[Decimal]:
        return self.bids[0].price if self.bids else None

    @property
    def best_ask(self) -> Optional[Decimal]:
        return self.asks[0].price if self.asks else None

    @property
    def spread(self) -> Optional[Decimal]:
        if self.best_bid is not None and self.best_ask is not None:
            return to_money(self.best_ask - self.best_bid)
        return None


class FeedStatus(str, Enum):
    CONNECTED = "CONNECTED"
    DISCONNECTED = "DISCONNECTED"
    REPLAYING = "REPLAYING"
    COMPLETED = "COMPLETED"
    ERROR = "ERROR"


class FeedHealth(BaseModel):
    """Health statistics and metrics for the market data feed."""
    symbol: str
    status: FeedStatus = FeedStatus.DISCONNECTED
    total_ticks_processed: int = 0
    duplicate_ticks_dropped: int = 0
    out_of_order_ticks_dropped: int = 0
    sequence_gaps_detected: int = 0
    last_tick_time: Optional[datetime] = None
    last_sequence_id: int = 0
