from decimal import Decimal
from typing import Optional, Dict, Any, Literal
from pydantic import BaseModel, Field
from src.common.types import Side, OrderType, ProductType

class OrderProposal(BaseModel):
    account_id: str
    symbol: str
    side: Side
    order_type: OrderType = OrderType.LIMIT
    quantity: int = Field(gt=0)
    price: Optional[Decimal] = None
    trigger_price: Optional[Decimal] = None
    product_type: ProductType = ProductType.MIS
    stop_loss_price: Optional[Decimal] = None

class PolicyCheckResult(BaseModel):
    status: Literal["NEEDS_APPROVAL", "REJECTED"]
    reason: Optional[str] = None
    order_payload: Optional[Dict[str, Any]] = None
