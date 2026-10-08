import asyncio
from datetime import datetime, timezone, timedelta
from decimal import Decimal
import pytest

from src.agentic.monitor.rules import DebounceTracker, RiskThresholdEvaluator
from src.agentic.monitor.event_monitor import AutonomousEventMonitor
from src.common.types import ProductType
from src.events.bus import InMemoryEventBus
from src.events.models import DomainEvent, DomainEventType
from src.portfolio.position_manager import PositionManager


def test_debounce_tracker_logic():
    tracker = DebounceTracker(cooldown_seconds=60.0, retrigger_delta_pct=Decimal("2.0"))
    now = datetime.now(timezone.utc)
    key = "ACC1:TCS:DRAWDOWN"

    # 1. First trigger always succeeds
    assert tracker.should_trigger(key, Decimal("2400.00"), now=now) is True

    # 2. Immediate second call with minor change is throttled
    assert tracker.should_trigger(key, Decimal("2390.00"), now=now + timedelta(seconds=5)) is False

    # 3. Call within 60s with >= 2% additional drop succeeds
    # 2400 * 0.98 = 2352.00. Price 2350.00 is > 2% drop from 2400.00
    assert tracker.should_trigger(key, Decimal("2350.00"), now=now + timedelta(seconds=10)) is True

    # 4. Call after 60s cooldown from last trigger (at +10s) succeeds unconditionally
    assert tracker.should_trigger(key, Decimal("2350.00"), now=now + timedelta(seconds=80)) is True


def test_risk_threshold_evaluator():
    evaluator = RiskThresholdEvaluator(
        tick_drop_threshold_pct=Decimal("3.0"),
        unrealized_loss_threshold_pct=Decimal("5.0"),
    )
    pos_mgr = PositionManager()
    pos = pos_mgr.get_position("ACC1", "TCS", ProductType.CNC)
    pos.quantity = 10
    pos.average_price = Decimal("1000.00")

    # 4% drop: should NOT trigger drawdown threshold (threshold is 5%)
    ctx = evaluator.evaluate_position_drawdown(pos, Decimal("960.00"))
    assert ctx is None

    # 6% drop: SHOULD trigger drawdown threshold
    pos.unrealized_pnl = Decimal("-600.00")
    ctx = evaluator.evaluate_position_drawdown(pos, Decimal("940.00"))
    assert ctx is not None
    assert ctx.symbol == "TCS"
    assert ctx.change_pct == Decimal("-6.00")


@pytest.mark.asyncio
async def test_autonomous_event_monitor_publishes_agent_alert():
    bus = InMemoryEventBus()
    pos_mgr = PositionManager()
    monitor = AutonomousEventMonitor(event_bus=bus, position_manager=pos_mgr)

    # Setup open position in TCS
    pos = pos_mgr.get_position("ACC_TEST", "TCS", ProductType.CNC)
    pos.quantity = 10
    pos.average_price = Decimal("1000.00")
    pos_mgr.update_market_price("TCS", Decimal("1000.00"))

    alert_queue = bus.subscribe("*")
    await monitor.start()

    try:
        # Ingest a tick showing 6% drop (LTP 940.00)
        pos_mgr.update_market_price("TCS", Decimal("940.00"))
        tick_event = DomainEvent(
            event_id="EVT_TICK_1",
            event_type=DomainEventType.TICK_RECEIVED,
            entity_type="MARKET",
            entity_id="TCS",
            payload={"symbol": "TCS", "ltp": 940.0},
        )
        await bus.publish(tick_event)

        # Wait for AGENT_ALERT
        agent_alert = None
        for _ in range(20):
            try:
                event = await asyncio.wait_for(alert_queue.get(), timeout=0.2)
                if event.event_type == DomainEventType.AGENT_ALERT:
                    agent_alert = event
                    break
            except asyncio.TimeoutError:
                pass

        assert agent_alert is not None
        assert agent_alert.payload["symbol"] == "TCS"
        assert agent_alert.payload["change_pct"] == -6.0
        assert "risk_brief" in agent_alert.payload
        assert len(agent_alert.payload["risk_brief"]) > 10

    finally:
        await monitor.stop()
