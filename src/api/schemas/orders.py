from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, Field

from src.common.types import Side, OrderType, OrderStatus, ProductType, TimeInForce


class OrderCreate(BaseModel):
    symbol: str
    side: Side
    order_type: OrderType
    quantity: int = Field(gt=0, description="Order quantity in units")
    price: Optional[Decimal] = Field(default=None, description="Limit price (mandatory for LIMIT/SL)")
    trigger_price: Optional[Decimal] = Field(default=None, description="Trigger price (mandatory for SL/SL-M)")
    product_type: ProductType = Field(default=ProductType.CNC, description="CNC (Delivery) or MIS (Intraday)")
    time_in_force: TimeInForce = Field(default=TimeInForce.DAY)
    account_id: str = Field(default="DEFAULT", description="Trading account ID")


class OrderModify(BaseModel):
    new_quantity: Optional[int] = Field(default=None, gt=0, description="Updated order quantity")
    new_price: Optional[Decimal] = Field(default=None, gt=0, description="Updated limit price")


class TradeResponse(BaseModel):
    trade_id: str
    order_id: str
    symbol: str
    side: Side
    price: Decimal
    quantity: int
    counterparty_order_id: str
    is_maker: bool
    timestamp: datetime


class OrderResponse(BaseModel):
    order_id: str
    account_id: str
    symbol: str
    side: Side
    order_type: OrderType
    product_type: ProductType
    quantity: int
    price: Optional[Decimal] = None
    trigger_price: Optional[Decimal] = None
    time_in_force: TimeInForce
    status: OrderStatus
    filled_qty: int
    remaining_qty: int
    average_fill_price: Optional[Decimal] = None
    created_at: datetime
    updated_at: datetime


class OrderPlacementResponse(BaseModel):
    order: OrderResponse
    trades: List[TradeResponse] = Field(default_factory=list)
    total_charges: Decimal = Decimal("0.00")
    account_balance: Decimal = Decimal("0.00")
