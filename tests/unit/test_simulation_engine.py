from decimal import Decimal
import pytest

from src.common.types import OrderType, ProductType, Side
from src.core.models import Order
from src.core.trade_service import TradeExecutionService
from src.simulation.engine import WhatIfSimulationEngine
from src.simulation.models import (
    HypotheticalOrder,
    PriceScenario,
    SimulationRequest,
)


def test_what_if_simulation_price_pct_drop():
    trade_svc = TradeExecutionService()
    account_id = "ACC_SIM_TEST"
    trade_svc.register_account(account_id, initial_deposit=Decimal("100000.00"))

    # Seed and execute BUY 10 TCS @ 2500.00
    trade_svc.register_account("MAKER", initial_deposit=Decimal("100000.00"))
    trade_svc.get_account("MAKER").holdings["TCS"] = 50
    trade_svc.place_order(
        Order(
            order_id="M1",
            symbol="TCS",
            side=Side.SELL,
            order_type=OrderType.LIMIT,
            price=Decimal("2500.00"),
            quantity=10,
            product_type=ProductType.CNC,
            account_id="MAKER",
        )
    )
    trade_svc.place_order(
        Order(
            order_id="B1",
            symbol="TCS",
            side=Side.BUY,
            order_type="LIMIT",
            price=Decimal("2500.00"),
            quantity=10,
            product_type=ProductType.CNC,
            account_id=account_id,
        )
    )

    pos = trade_svc.position_manager.get_position(account_id, "TCS", ProductType.CNC)
    assert pos.quantity == 10
    assert pos.average_price == Decimal("2500.00")

    sim_engine = WhatIfSimulationEngine(trade_service=trade_svc)

    # Simulate: What if TCS falls 6%?
    req = SimulationRequest(
        account_id=account_id,
        scenarios=[
            PriceScenario(symbol="TCS", price_change_pct=Decimal("-6.0"))
        ],
    )
    res = sim_engine.simulate(req)

    assert res.account_id == account_id
    assert len(res.positions) == 1
    sim_pos = res.positions[0]
    assert sim_pos.symbol == "TCS"
    assert sim_pos.current_price == Decimal("2500.00")
    # 2500 * (1 - 0.06) = 2350.00
    assert sim_pos.simulated_price == Decimal("2350.00")
    # Projected P&L: 10 * (2350 - 2500) = -1500.00
    assert sim_pos.projected_unrealized_pnl == Decimal("-1500.00")
    assert sim_pos.pnl_delta == Decimal("-1500.00")
    assert res.projected_total_unrealized_pnl == Decimal("-1500.00")

    # Verify live position was not mutated!
    assert pos.unrealized_pnl == Decimal("0.00")


def test_what_if_simulation_natural_language_prompt():
    trade_svc = TradeExecutionService()
    account_id = "ACC_SIM_NL"
    trade_svc.register_account(account_id, initial_deposit=Decimal("100000.00"))

    # Give a position in TCS
    trade_svc.position_manager._positions[(account_id, "TCS", ProductType.CNC)] = (
        from_pos := trade_svc.position_manager.get_position(account_id, "TCS", ProductType.CNC)
    )
    from_pos.quantity = 20
    from_pos.average_price = Decimal("3000.00")
    trade_svc.position_manager.update_market_price("TCS", Decimal("3000.00"))

    sim_engine = WhatIfSimulationEngine(trade_service=trade_svc)

    req = SimulationRequest(
        account_id=account_id,
        natural_language_prompt="What if TCS falls 6%?",
    )
    res = sim_engine.simulate(req)

    assert len(res.positions) == 1
    sim_pos = res.positions[0]
    # 3000 * 0.94 = 2820.00
    assert sim_pos.simulated_price == Decimal("2820.00")
    # 20 * (2820 - 3000) = -3600.00
    assert sim_pos.projected_unrealized_pnl == Decimal("-3600.00")
    assert "TCS" in res.narrative_summary


def test_what_if_simulation_with_hypothetical_orders():
    trade_svc = TradeExecutionService()
    account_id = "ACC_SIM_HYPO"
    trade_svc.register_account(account_id, initial_deposit=Decimal("100000.00"))

    sim_engine = WhatIfSimulationEngine(trade_service=trade_svc)

    req = SimulationRequest(
        account_id=account_id,
        scenarios=[],
        hypothetical_orders=[
            HypotheticalOrder(
                symbol="RELIANCE",
                side=Side.BUY,
                quantity=10,
                price=Decimal("2500.00"),
                product_type=ProductType.CNC,
            )
        ],
    )
    res = sim_engine.simulate(req)
    assert res.projected_charges > Decimal("0.00")
