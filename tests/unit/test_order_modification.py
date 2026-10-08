from decimal import Decimal
import pytest

from src.common.types import Side, OrderType, OrderStatus, ProductType
from src.common.exceptions import InsufficientMarginError, InvalidOrderError, OrderNotFoundError
from src.core.models import Order
from src.core.trade_service import TradeExecutionService


def test_order_modification_price_and_quantity():
    service = TradeExecutionService()
    account_id = "ACC_MOD_TEST"
    service.register_account(account_id, initial_deposit=Decimal("100000.00"))

    order = Order(
        order_id="ORD_MOD_1",
        account_id=account_id,
        symbol="TCS",
        side=Side.BUY,
        order_type=OrderType.LIMIT,
        price=Decimal("3000.00"),
        quantity=10,
        product_type=ProductType.CNC,
    )
    res = service.place_order(order)
    assert res.order.status == OrderStatus.OPEN
    acc = service.get_account(account_id)
    # 10 * 3000 = 30000 + charges
    assert acc.blocked_margin > Decimal("30000.00")

    # Modify quantity to 5 (reduce) and price to 2950.00
    modified = service.modify_order(
        account_id=account_id,
        symbol="TCS",
        order_id="ORD_MOD_1",
        new_quantity=5,
        new_price=Decimal("2950.00"),
    )
    assert modified.quantity == 5
    assert modified.remaining_qty == 5
    assert modified.price == Decimal("2950.00")

    # Blocked margin should now be lower (5 * 2950 ~ 14750 + charges)
    assert acc.blocked_margin < Decimal("20000.00")


def test_order_modification_insufficient_margin_rollback():
    service = TradeExecutionService()
    account_id = "ACC_MOD_ROLLBACK"
    # Small deposit: 50,000 INR
    service.register_account(account_id, initial_deposit=Decimal("50000.00"))

    order = Order(
        order_id="ORD_MOD_2",
        account_id=account_id,
        symbol="INFY",
        side=Side.BUY,
        order_type=OrderType.LIMIT,
        price=Decimal("1000.00"),
        quantity=40,
        product_type=ProductType.CNC,
    )
    service.place_order(order)
    old_blocked = service.get_account(account_id).blocked_margin

    # Try modifying quantity to 100 (requires ~100,000 > 50,000 deposit)
    with pytest.raises(InsufficientMarginError):
        service.modify_order(
            account_id=account_id,
            symbol="INFY",
            order_id="ORD_MOD_2",
            new_quantity=100,
        )

    # Rollback verification: blocked margin preserved, order untouched
    assert service.get_account(account_id).blocked_margin == old_blocked
    current_order = service.get_order("ORD_MOD_2")
    assert current_order.quantity == 40
