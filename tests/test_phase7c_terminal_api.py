import pytest
from decimal import Decimal
from fastapi.testclient import TestClient

from src.api.app import create_app
from src.api.dependencies import get_trade_service, reset_engine_state


@pytest.fixture(autouse=True)
def clean_engine():
    reset_engine_state()
    yield
    reset_engine_state()


@pytest.fixture
def client():
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client


def test_margin_check_mis_sufficient(client):
    """Verifies MIS margin pre-check: 20% margin + estimated regulatory charges."""
    payload = {
        "account_id": "DEFAULT",
        "symbol": "RELIANCE",
        "side": "BUY",
        "order_type": "LIMIT",
        "product_type": "MIS",
        "quantity": 100,
        "price": "2500.00",
    }
    response = client.post("/api/v1/margin/check", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["sufficient"] is True
    # Order value: 100 * 2500 = 250,000. 20% base margin = 50,000.
    # Total required margin should be around 50,000 + charges
    assert float(data["required_margin"]) >= 50000.0
    assert float(data["shortfall"]) == 0.0

    # Charges breakdown checks
    charges = data["charges"]
    assert float(charges["turnover"]) == 250000.0
    assert float(charges["brokerage"]) == 20.0  # Cap of 20 for MIS
    assert float(charges["stt"]) == 0.0         # No STT on MIS Buy
    assert float(charges["exchange_turnover"]) > 0.0
    assert float(charges["stamp_duty"]) > 0.0
    assert float(charges["gst"]) > 0.0
    assert float(charges["total_charges"]) > 0.0


def test_margin_check_cnc_delivery(client):
    """Verifies CNC delivery margin check: 100% order value, 0 brokerage, STT charged on Buy."""
    payload = {
        "account_id": "DEFAULT",
        "symbol": "RELIANCE",
        "side": "BUY",
        "order_type": "LIMIT",
        "product_type": "CNC",
        "quantity": 10,
        "price": "2500.00",
    }
    response = client.post("/api/v1/margin/check", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["sufficient"] is True
    # Order value = 25,000. CNC requires 100% margin + charges
    assert float(data["required_margin"]) >= 25000.0

    charges = data["charges"]
    assert float(charges["turnover"]) == 25000.0
    assert float(charges["brokerage"]) == 0.0   # 0 brokerage on CNC delivery
    assert float(charges["stt"]) == 25.0        # 0.1% STT on 25,000 = 25.0


def test_margin_check_insufficient(client):
    """Verifies shortfall detection when order margin exceeds available cash."""
    # Place massive order requiring 25,000,000 against default 1,000,000 cash
    payload = {
        "account_id": "DEFAULT",
        "symbol": "RELIANCE",
        "side": "BUY",
        "order_type": "LIMIT",
        "product_type": "CNC",
        "quantity": 10000,
        "price": "2500.00",
    }
    response = client.post("/api/v1/margin/check", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["sufficient"] is False
    assert float(data["shortfall"]) > 0.0
    assert float(data["required_margin"]) > float(data["available_margin"])


def test_market_candles_endpoint(client):
    """Verifies candlestick history endpoint formatting for TradingView Lightweight Charts."""
    response = client.get("/api/v1/market/candles/RELIANCE?limit=30")
    assert response.status_code == 200
    data = response.json()

    assert data["symbol"] == "RELIANCE"
    assert data["timeframe"] == "1m"
    candles = data["candles"]
    assert len(candles) > 0
    assert len(candles) <= 30

    for c in candles:
        assert "time" in c
        assert isinstance(c["time"], int)
        assert c["high"] >= c["low"]
        assert c["high"] >= c["open"]
        assert c["high"] >= c["close"]
        assert c["low"] <= c["open"]
        assert c["low"] <= c["close"]
        assert c["volume"] >= 0

    # Ensure strictly ascending timestamps
    for i in range(1, len(candles)):
        assert candles[i]["time"] >= candles[i - 1]["time"]
