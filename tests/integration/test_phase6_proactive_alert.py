import json
import time
from decimal import Decimal
import pytest
from starlette.testclient import TestClient

from src.api.app import app
from src.api.dependencies import get_trade_service, get_market_gateway, reset_engine_state
from src.common.types import ProductType, Side
from src.core.models import Order
from src.events.models import DomainEvent, DomainEventType
from src.market_data.models import DepthLevel, MarketDepth


def test_phase6_exit_criteria_unprompted_websocket_alert():
    """
    Phase 6 Exit Criteria:
    Fire a simulated tick showing a 6% drop in a held stock.
    Observe an unprompted, structured alert pop up on the WebSocket stream within 2 seconds.
    """
    reset_engine_state()
    svc = get_trade_service()
    account_id = "ACC_PHASE6_TEST"
    svc.register_account(account_id, initial_deposit=Decimal("1000000.00"))

    # Seed held position: 10 TCS @ 1000.00
    pos = svc.position_manager.get_position(account_id, "TCS", ProductType.CNC)
    pos.quantity = 10
    pos.average_price = Decimal("1000.00")
    svc.position_manager.update_market_price("TCS", Decimal("1000.00"))

    with TestClient(app) as client:
        # 1. Connect WebSocket client for this account
        with client.websocket_connect(f"/ws/{account_id}") as ws:
            init_frame = ws.receive_json()
            assert init_frame["type"] == "CONNECTION_ESTABLISHED"

            start_time = time.time()

            # 2. Fire a simulated tick showing 6% drop in held stock (LTP = 940.00)
            mkt_gateway = get_market_gateway()
            tick = MarketDepth(
                symbol="TCS",
                ltp=Decimal("940.00"),
                volume=15000,
                bids=[DepthLevel(price=Decimal("939.50"), quantity=50, orders=1)],
                asks=[DepthLevel(price=Decimal("940.00"), quantity=50, orders=1)],
                sequence_id=1,
            )

            # Ingest tick into gateway (updates position manager and emits TICK_RECEIVED to event bus)
            client.portal.call(mkt_gateway.ingest_tick, tick) if hasattr(client, "portal") else None
            # Also publish directly to event bus for synchronous test guarantee
            svc.position_manager.update_market_price("TCS", Decimal("940.00"))
            from src.events.bus import default_event_bus
            default_event_bus.publish_nowait(
                DomainEvent(
                    event_id="EVT_TICK_SIM_6PCT",
                    event_type=DomainEventType.TICK_RECEIVED,
                    entity_type="MARKET",
                    entity_id="TCS",
                    payload={"symbol": "TCS", "ltp": 940.0},
                )
            )

            # 3. Read incoming frames and assert AGENT_ALERT arrives within 2 seconds
            received_alert = None
            while time.time() - start_time < 2.0:
                try:
                    frame = ws.receive_json()
                    if frame.get("type") == "AGENT_ALERT":
                        received_alert = frame
                        break
                except Exception:
                    time.sleep(0.05)

            elapsed_seconds = time.time() - start_time

            # 4. Assert exit criteria
            assert received_alert is not None, f"No AGENT_ALERT received on WebSocket stream within 2.0s (elapsed {elapsed_seconds:.3f}s)"
            assert elapsed_seconds <= 2.0, f"Alert took {elapsed_seconds:.3f}s, exceeding 2s requirement"

            alert_data = received_alert["data"]
            assert alert_data["symbol"] == "TCS"
            assert alert_data["change_pct"] == -6.0
            assert alert_data["severity"] == "CRITICAL"
            assert "risk_brief" in alert_data
            assert len(alert_data["risk_brief"]) > 10


def test_api_what_if_simulation_endpoint():
    reset_engine_state()
    svc = get_trade_service()
    account_id = "ACC_SIM_API"
    svc.register_account(account_id, initial_deposit=Decimal("500000.00"))

    # Seed position: 20 INFY @ 2000.00
    pos = svc.position_manager.get_position(account_id, "INFY", ProductType.CNC)
    pos.quantity = 20
    pos.average_price = Decimal("2000.00")
    svc.position_manager.update_market_price("INFY", Decimal("2000.00"))

    with TestClient(app) as client:
        # 1. Test POST /api/v1/agent/simulate with percentage change
        payload = {
            "account_id": account_id,
            "scenarios": [
                {
                    "symbol": "INFY",
                    "price_change_pct": -6.0
                }
            ]
        }
        res = client.post("/api/v1/agent/simulate", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["account_id"] == account_id
        assert len(data["positions"]) == 1
        pos_sim = data["positions"][0]
        assert pos_sim["symbol"] == "INFY"
        assert float(pos_sim["simulated_price"]) == 1880.0
        assert float(pos_sim["projected_unrealized_pnl"]) == -2400.0

        # 2. Test natural language prompt query
        nl_payload = {
            "account_id": account_id,
            "natural_language_prompt": "What if INFY drops 6%?"
        }
        res_nl = client.post("/api/v1/agent/simulate", json=nl_payload)
        assert res_nl.status_code == 200
        nl_data = res_nl.json()
        assert len(nl_data["positions"]) == 1
        assert float(nl_data["positions"][0]["simulated_price"]) == 1880.0


def test_api_mis_squareoff_endpoint():
    reset_engine_state()
    svc = get_trade_service()
    account_id = "ACC_SQ_API"
    svc.register_account(account_id, initial_deposit=Decimal("500000.00"))

    # Seed open MIS position: 15 RELIANCE @ 2500.00
    pos = svc.position_manager.get_position(account_id, "RELIANCE", ProductType.MIS)
    pos.quantity = 15
    pos.average_price = Decimal("2500.00")
    svc.position_manager.update_market_price("RELIANCE", Decimal("2550.00"))

    with TestClient(app) as client:
        res = client.post(f"/settlement/mis-squareoff?account_id={account_id}")
        assert res.status_code == 200
        results = res.json()
        assert len(results) == 1
        assert results[0]["symbol"] == "RELIANCE"
        assert results[0]["closed_quantity"] == 15

        # Verify position is closed
        pos_after = svc.position_manager.get_position(account_id, "RELIANCE", ProductType.MIS)
        assert pos_after.quantity == 0
        assert pos_after.is_open is False
