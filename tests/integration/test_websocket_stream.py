import json
from decimal import Decimal
import pytest
from starlette.testclient import TestClient

from src.api.app import app
from src.api.dependencies import get_trade_service, reset_engine_state


def test_websocket_realtime_trade_streaming_exit_criteria():
    """
    Phase 4 Exit Criteria:
    Send an order via API or engine, and observe the TRADE_EXECUTED event
    streaming over the WebSocket client in real-time.
    """
    reset_engine_state()
    svc = get_trade_service()
    account_id = "ACC_WS_STREAM_TEST"
    svc.register_account(account_id, initial_deposit=Decimal("1000000.00"))

    with TestClient(app) as client:
        # 1. Connect WebSocket client for this account
        with client.websocket_connect(f"/ws/{account_id}") as ws:
            # First frame: Handshake confirmation
            init_frame = ws.receive_json()
            assert init_frame["type"] == "CONNECTION_ESTABLISHED"
            assert init_frame["account_id"] == account_id

            # 2. Seed resting SELL limit order on book (Maker liquidity)
            maker_payload = {
                "symbol": "RELIANCE",
                "side": "SELL",
                "order_type": "LIMIT",
                "quantity": 10,
                "price": "2500.00",
                "product_type": "CNC",
                "account_id": "ACC_MAKER",
            }
            svc.register_account("ACC_MAKER", initial_deposit=Decimal("500000.00"))
            # Give maker shares to sell
            maker_acc = svc.get_account("ACC_MAKER")
            maker_acc.holdings["RELIANCE"] = 50
            client.post("/orders", json=maker_payload)

            # 3. Taker sends BUY market/limit order via REST API that crosses the maker order
            taker_payload = {
                "symbol": "RELIANCE",
                "side": "BUY",
                "order_type": "LIMIT",
                "quantity": 10,
                "price": "2500.00",
                "product_type": "CNC",
                "account_id": account_id,
            }
            order_res = client.post("/orders", json=taker_payload)
            assert order_res.status_code == 201

            # 4. Read incoming WebSocket frames and verify TRADE_EXECUTED event arrived
            received_events = []
            # Read upcoming frames (ORDER_PLACED, TRADE_EXECUTED, POSITION_UPDATED, MARGIN_UTILIZATION_CHANGED)
            for _ in range(4):
                frame = ws.receive_json()
                received_events.append(frame["type"])
                if frame["type"] == "TRADE_EXECUTED":
                    trade_data = frame["data"]
                    assert trade_data["symbol"] == "RELIANCE"
                    assert float(trade_data["price"]) == 2500.00
                    assert trade_data["quantity"] == 10
                    assert "charges" in trade_data

            assert "TRADE_EXECUTED" in received_events
            assert "ORDER_PLACED" in received_events
