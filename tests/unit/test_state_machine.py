from decimal import Decimal
import pytest
from src.common.types import Side, OrderType, OrderStatus
from src.common.exceptions import InvalidOrderStateTransitionError
from src.core.models import Order
from src.core.state_machine import OrderStateMachine


def test_order_state_machine_valid_full_lifecycle():
    sm = OrderStateMachine()
    order = Order(
        order_id="ORD-1",
        symbol="TCS",
        side=Side.BUY,
        order_type=OrderType.LIMIT,
        quantity=100,
        price=Decimal("3500.00"),
    )
    assert order.status == OrderStatus.PENDING
    assert order.remaining_qty == 100
    assert order.filled_qty == 0

    # PENDING -> OPEN
    sm.transition(order, OrderStatus.OPEN)
    assert order.status == OrderStatus.OPEN

    # OPEN -> PARTIALLY_FILLED (fill 40 shares @ 3500)
    sm.transition(order, OrderStatus.PARTIALLY_FILLED, fill_qty=40, fill_price=Decimal("3500.00"))
    assert order.status == OrderStatus.PARTIALLY_FILLED
    assert order.filled_qty == 40
    assert order.remaining_qty == 60
    assert order.average_fill_price == Decimal("3500.00")

    # PARTIALLY_FILLED -> PARTIALLY_FILLED (fill another 30 shares @ 3510)
    sm.transition(order, OrderStatus.PARTIALLY_FILLED, fill_qty=30, fill_price=Decimal("3510.00"))
    assert order.status == OrderStatus.PARTIALLY_FILLED
    assert order.filled_qty == 70
    assert order.remaining_qty == 30
    # VWAP = ((40 * 3500) + (30 * 3510)) / 70 = (140000 + 105300) / 70 = 245300 / 70 = 3504.2857... -> 3504.29
    assert order.average_fill_price == Decimal("3504.29")

    # PARTIALLY_FILLED -> FILLED (fill final 30 shares @ 3500)
    sm.transition(order, OrderStatus.FILLED, fill_qty=30, fill_price=Decimal("3500.00"))
    assert order.status == OrderStatus.FILLED
    assert order.filled_qty == 100
    assert order.remaining_qty == 0
    assert order.is_terminal is True


def test_illegal_transition_from_terminal_states():
    sm = OrderStateMachine()
    order = Order(
        order_id="ORD-2",
        symbol="INFY",
        side=Side.BUY,
        order_type=OrderType.LIMIT,
        quantity=10,
        price=Decimal("1800.00"),
    )
    sm.transition(order, OrderStatus.OPEN)
    sm.transition(order, OrderStatus.CANCELLED)
    assert order.status == OrderStatus.CANCELLED
    assert order.is_terminal is True

    # Attempting to move from CANCELLED to OPEN or FILLED must fail
    with pytest.raises(InvalidOrderStateTransitionError):
        sm.transition(order, OrderStatus.OPEN)

    with pytest.raises(InvalidOrderStateTransitionError):
        sm.transition(order, OrderStatus.FILLED)


def test_fill_quantity_exceeding_remaining_fails():
    sm = OrderStateMachine()
    order = Order(
        order_id="ORD-3",
        symbol="RELIANCE",
        side=Side.SELL,
        order_type=OrderType.LIMIT,
        quantity=50,
        price=Decimal("2500.00"),
    )
    sm.transition(order, OrderStatus.OPEN)

    with pytest.raises(InvalidOrderStateTransitionError, match="exceeds remaining quantity"):
        sm.transition(order, OrderStatus.PARTIALLY_FILLED, fill_qty=60, fill_price=Decimal("2500.00"))


def test_transition_to_filled_with_remaining_quantity_fails():
    sm = OrderStateMachine()
    order = Order(
        order_id="ORD-4",
        symbol="RELIANCE",
        side=Side.SELL,
        order_type=OrderType.LIMIT,
        quantity=50,
        price=Decimal("2500.00"),
    )
    sm.transition(order, OrderStatus.OPEN)

    # Cannot transition to FILLED without filling all remaining qty
    with pytest.raises(InvalidOrderStateTransitionError, match="Cannot transition to FILLED"):
        sm.transition(order, OrderStatus.FILLED, fill_qty=20, fill_price=Decimal("2500.00"))
