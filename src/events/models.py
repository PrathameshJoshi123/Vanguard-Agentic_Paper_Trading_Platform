from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class DomainEventType:
    TICK_RECEIVED = "TICK_RECEIVED"
    ORDER_PLACED = "ORDER_PLACED"
    ORDER_MODIFIED = "ORDER_MODIFIED"
    ORDER_CANCELLED = "ORDER_CANCELLED"
    ORDER_REJECTED = "ORDER_REJECTED"
    TRADE_EXECUTED = "TRADE_EXECUTED"
    POSITION_UPDATED = "POSITION_UPDATED"
    HOLDING_UPDATED = "HOLDING_UPDATED"
    MARGIN_UTILIZATION_CHANGED = "MARGIN_UTILIZATION_CHANGED"
    LEDGER_ENTRY_RECORDED = "LEDGER_ENTRY_RECORDED"
    MTM_UPDATED = "MTM_UPDATED"
    AGENT_ALERT = "AGENT_ALERT"
    MIS_SQUAREOFF_TRIGGERED = "MIS_SQUAREOFF_TRIGGERED"
    MIS_SQUAREOFF_COMPLETED = "MIS_SQUAREOFF_COMPLETED"


class DomainEvent(BaseModel):
    """
    Unified domain event adhering to plan.txt Section 38.
    """
    event_id: str
    event_type: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    entity_type: str
    entity_id: str
    account_id: Optional[str] = None
    payload: Dict[str, Any] = Field(default_factory=dict)
    sequence: int = 0
