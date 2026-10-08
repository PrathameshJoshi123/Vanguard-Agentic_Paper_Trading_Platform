from decimal import Decimal
import pytest

from src.common.types import OrderStatus, OrderType, ProductType, Side
from src.core.models import Order
from src.core.trade_service import TradeExecutionService
from src.settlement.mis_squareoff import MISSquareOffManager
from src.scheduler.service import TradingSchedulerService
from src.events.bus import InMemoryEventBus
from src.events.models import DomainEventType


def test_mis_squareoff_long_position():
    bus = InMemoryEventBus()
    trade_svc = TradeExecutionService(event_bus=bus)
    account_id = "ACC_MIS_TEST"
    trade_svc.register_account(account_id, initial_deposit=Decimal("100000.00"))

    # Seed maker SELL order at 1000.00
    trade_svc.register_account("MAKER", initial_deposit=Decimal("100000.00"))
    maker_order = Order(
        order_id="ORD-MAKER-1",
        symbol="TCS",
        side=Side.SELL,
        order_type=OrderType.LIMIT,
        price=Decimal("1000.00"),
        quantity=20,
        product_type=ProductType.CNC,
        account_id="MAKER",
    )
    trade_svc.get_account("MAKER").holdings["TCS"] = 20
    trade_svc.place_order(maker_order)

    # Buy 20 MIS TCS
    buy_order = Order(
        order_id="ORD-BUY-MIS",
        symbol="TCS",
        side=Side.BUY,
        order_type=OrderType.LIMIT,
        price=Decimal("1000.00"),
        quantity=20,
        product_type=ProductType.MIS,
        account_id=account_id,
    )
    trade_svc.place_order(buy_order)

    pos = trade_svc.position_manager.get_position(account_id, "TCS", ProductType.MIS)
    assert pos.quantity == 20
    assert pos.average_price == Decimal("1000.00")
    assert pos.is_open is True

    # Update market price to 1050.00
    trade_svc.position_manager.update_market_price("TCS", Decimal("1050.00"))

    # Execute MIS Auto Square-off
    manager = MISSquareOffManager(trade_service=trade_svc)
    results = manager.square_off_all_mis()

    assert len(results) == 1
    res = results[0]
    assert res.account_id == account_id
    assert res.symbol == "TCS"
    assert res.closed_quantity == 20
    assert res.side == Side.SELL
    assert res.status == OrderStatus.FILLED

    # Verify position is closed
    pos_after = trade_svc.position_manager.get_position(account_id, "TCS", ProductType.MIS)
    assert pos_after.quantity == 0
    assert pos_after.is_open is False
    assert pos_after.realized_pnl > Decimal("0.00")  # Gained ₹1000 gross minus charges


def test_mis_squareoff_leaves_cnc_untouched():
    bus = InMemoryEventBus()
    trade_svc = TradeExecutionService(event_bus=bus)
    account_id = "ACC_CNC_MIS"
    trade_svc.register_account(account_id, initial_deposit=Decimal("200000.00"))
    trade_svc.register_account("MAKER", initial_deposit=Decimal("200000.00"))
    trade_svc.get_account("MAKER").holdings["INFY"] = 100
    trade_svc.get_account("MAKER").holdings["RELIANCE"] = 100

    # Maker liquidity
    trade_svc.place_order(
        Order(
            order_id="M1",
            symbol="INFY",
            side=Side.SELL,
            order_type=OrderType.LIMIT,
            price=Decimal("1500.00"),
            quantity=10,
            product_type=ProductType.CNC,
            account_id="MAKER",
        )
    )
    trade_svc.place_order(
        Order(
            order_id="M2",
            symbol="RELIANCE",
            side=Side.SELL,
            order_type=OrderType.LIMIT,
            price=Decimal("2500.00"),
            quantity=10,
            product_type=ProductType.CNC,
            account_id="MAKER",
        )
    )

    # Buy INFY as CNC, RELIANCE as MIS
    trade_svc.place_order(
        Order(
            order_id="BUY-CNC",
            symbol="INFY",
            side=Side.BUY,
            order_type=OrderType.LIMIT,
            price=Decimal("1500.00"),
            quantity=10,
            product_type=ProductType.CNC,
            account_id=account_id,
        )
    )
    trade_svc.place_order(
        Order(
            order_id="BUY-MIS",
            symbol="RELIANCE",
            side=Side.BUY,
            order_type=OrderType.LIMIT,
            price=Decimal("2500.00"),
            quantity=10,
            product_type=ProductType.MIS,
            account_id=account_id,
        )
    )

    manager = MISSquareOffManager(trade_service=trade_svc)
    results = manager.square_off_all_mis()

    assert len(results) == 1
    assert results[0].symbol == "RELIANCE"

    # Verify CNC position is still open and unchanged
    cnc_pos = trade_svc.position_manager.get_position(account_id, "INFY", ProductType.CNC)
    assert cnc_pos.quantity == 10
    assert cnc_pos.is_open is True

    # Verify MIS position is closed
    mis_pos = trade_svc.position_manager.get_position(account_id, "RELIANCE", ProductType.MIS)
    assert mis_pos.quantity == 0
    assert mis_pos.is_open is False


@pytest.mark.asyncio
async def test_scheduler_service_lifecycle_and_trigger():
    bus = InMemoryEventBus()
    trade_svc = TradeExecutionService(event_bus=bus)
    manager = MISSquareOffManager(trade_service=trade_svc)
    scheduler = TradingSchedulerService(square_off_manager=manager)

    scheduler.start()
    assert scheduler.is_running is True

    # Immediate trigger executes without error
    results = scheduler.trigger_now()
    assert isinstance(results, list)

    scheduler.stop()
    assert scheduler.is_running is False
