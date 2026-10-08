from datetime import datetime
from decimal import Decimal
from typing import Set, Dict, Optional

from src.common.types import OrderStatus
from src.common.exceptions import InvalidOrderStateTransitionError
from src.common.money import to_money
from src.common.clock import Clock, default_clock
from src.core.models import Order


# Allowed transition matrix
VALID_TRANSITIONS: Dict[OrderStatus, Set[OrderStatus]] = {
    OrderStatus.PENDING: {
        OrderStatus.TRIGGER_PENDING,
        OrderStatus.OPEN,
        OrderStatus.PARTIALLY_FILLED,
        OrderStatus.FILLED,
        OrderStatus.REJECTED,
        OrderStatus.CANCELLED,
    },
    OrderStatus.TRIGGER_PENDING: {
        OrderStatus.OPEN,
        OrderStatus.CANCELLED,
        OrderStatus.REJECTED,
    },
    OrderStatus.OPEN: {

        OrderStatus.PARTIALLY_FILLED,
        OrderStatus.FILLED,
        OrderStatus.CANCELLED,
    },
    OrderStatus.PARTIALLY_FILLED: {
        OrderStatus.PARTIALLY_FILLED,
        OrderStatus.FILLED,
        OrderStatus.CANCELLED,
    },
    OrderStatus.FILLED: set(),    # Terminal state
    OrderStatus.CANCELLED: set(), # Terminal state
    OrderStatus.REJECTED: set(),  # Terminal state
}


class OrderStateMachine:
    """Deterministic order state machine with strict guards."""

    def __init__(self, clock: Optional[Clock] = None):
        self.clock = clock or default_clock

    def validate_transition(self, current_status: OrderStatus, target_status: OrderStatus) -> bool:
        allowed = VALID_TRANSITIONS.get(current_status, set())
        return target_status in allowed

    def transition(
        self,
        order: Order,
        target_status: OrderStatus,
        fill_qty: int = 0,
        fill_price: Optional[Decimal] = None,
        reason: str = "",
    ) -> Order:
        """Applies a state transition with deterministic invariant checking."""
        current_status = order.status

        # 1. Check state transition legitimacy
        if not self.validate_transition(current_status, target_status):
            raise InvalidOrderStateTransitionError(
                order_id=order.order_id,
                current_status=current_status.value,
                target_status=target_status.value,
                reason=reason or f"Transition from {current_status} to {target_status} is not allowed.",
            )

        # 2. Process fill increments if supplied
        if fill_qty > 0:
            if fill_qty > order.remaining_qty:
                raise InvalidOrderStateTransitionError(
                    order_id=order.order_id,
                    current_status=current_status.value,
                    target_status=target_status.value,
                    reason=f"Fill quantity {fill_qty} exceeds remaining quantity {order.remaining_qty}.",
                )
            if fill_price is None or fill_price <= Decimal("0"):
                raise InvalidOrderStateTransitionError(
                    order_id=order.order_id,
                    current_status=current_status.value,
                    target_status=target_status.value,
                    reason="Fill price must be strictly positive.",
                )

            current_filled = order.filled_qty
            new_filled = current_filled + fill_qty
            old_avg = order.average_fill_price or Decimal("0")
            
            # Cumulative volume-weighted average price (VWAP)
            new_avg = ((old_avg * Decimal(current_filled)) + (fill_price * Decimal(fill_qty))) / Decimal(new_filled)
            
            order.filled_qty = new_filled
            order.remaining_qty -= fill_qty
            order.average_fill_price = to_money(new_avg)

        # 3. Guard target status invariants
        if target_status == OrderStatus.FILLED:
            if order.remaining_qty != 0:
                raise InvalidOrderStateTransitionError(
                    order_id=order.order_id,
                    current_status=current_status.value,
                    target_status=target_status.value,
                    reason=f"Cannot transition to FILLED with {order.remaining_qty} remaining quantity.",
                )

        elif target_status == OrderStatus.PARTIALLY_FILLED:
            if order.remaining_qty == 0:
                raise InvalidOrderStateTransitionError(
                    order_id=order.order_id,
                    current_status=current_status.value,
                    target_status=target_status.value,
                    reason="Cannot transition to PARTIALLY_FILLED when remaining quantity is 0 (should be FILLED).",
                )
            if order.filled_qty == 0:
                raise InvalidOrderStateTransitionError(
                    order_id=order.order_id,
                    current_status=current_status.value,
                    target_status=target_status.value,
                    reason="Cannot transition to PARTIALLY_FILLED when filled quantity is 0.",
                )

        elif target_status == OrderStatus.CANCELLED:
            # When cancelling, remaining quantity becomes 0
            order.remaining_qty = 0

        # 4. Commit transition
        order.status = target_status
        order.updated_at = self.clock.now()

        return order
