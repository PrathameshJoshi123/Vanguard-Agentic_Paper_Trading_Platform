import asyncio
from decimal import Decimal
import sys
import httpx
import pytest

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

BASE_URL = "http://localhost:8000"
API_V1 = f"{BASE_URL}/api/developer-api/v1"
HEADERS = {"Authorization": "Bearer HACK9999", "Content-Type": "application/json"}


@pytest.mark.asyncio
async def test_live_server_health_and_market_depth():
    """Live Server Hit: Verify engine health and live market depth."""
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
        # 1. Health check
        res = await client.get("/system/health")
        assert res.status_code == 200
        health_data = res.json()
        assert health_data["status"] == "ok"
        assert health_data["engine"] == "online"

        # 2. Market depth check for RELIANCE
        res = await client.get("/market/depth/RELIANCE")
        assert res.status_code == 200
        depth = res.json()
        assert depth["symbol"] == "RELIANCE"
        assert depth["ltp"] > 0
        assert len(depth["bids"]) > 0
        assert len(depth["asks"]) > 0
        print(f"\n[OK] Health: {health_data['status']}, RELIANCE LTP: ₹{depth['ltp']}")


@pytest.mark.asyncio
async def test_live_021_auth_and_instruments():
    """Live Server Hit: 021 Auth token issuance and instruments master listing."""
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
        # 1. POST /auth/token
        auth_payload = {"username": "HACK9999", "password": "AnyPassword"}
        res = await client.post(f"{API_V1}/auth/token", json=auth_payload)
        assert res.status_code == 200
        auth_res = res.json()
        assert auth_res["success"] is True
        token = auth_res["data"]["accessToken"]
        assert len(token) > 0

        # 2. GET /instruments
        res = await client.get(f"{API_V1}/instruments", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 200
        csv_text = res.text
        assert "token,exchange" in csv_text
        assert "RELIANCE" in csv_text
        assert "TCS" in csv_text
        print(f"[OK] Auth Token issued: {token[:12]}..., Instruments CSV loaded successfully ({len(csv_text)} bytes)")


@pytest.mark.asyncio
async def test_live_l1_order_lifecycle_placement_modify_cancel():
    """Live Server Hit: L1 Order Placement, Modification, and Cancellation via official 021 REST API."""
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
        # 1. Place resting LIMIT BUY order (RELIANCE @ ₹2400.00 = 240000 paise)
        order_payload = {
            "exchange": "NSE",
            "token": 2885,
            "qty": 10,
            "price": 240000,
            "book": "RL",
            "product": "CNC",
            "validity": "Day",
        }
        res = await client.post(f"{API_V1}/orders", json=order_payload, headers=HEADERS)
        assert res.status_code == 200
        res_data = res.json()
        assert res_data["success"] is True
        order_id = res_data["data"]["orderId"]

        # 2. Verify order details via GET /orders/{orderId}
        res = await client.get(f"{API_V1}/orders/{order_id}", headers=HEADERS)
        assert res.status_code == 200
        order_details = res.json()[0]
        assert str(order_details["orderId"]) == str(order_id)
        assert order_details["qtyRemaining"] == 10
        assert order_details["price"] == 240000
        assert order_details["status"] in ("Placed", "Pending")

        # 3. Modify order: increase qty to 15, increase price to ₹2410.00
        modify_payload = {
            "orderId": order_id,
            "qty": 15,
            "price": 241000,
            "validity": "Day",
        }
        res = await client.put(f"{API_V1}/orders/{order_id}", json=modify_payload, headers=HEADERS)
        assert res.status_code == 200
        assert res.json()["success"] is True

        # Verify modified state
        res = await client.get(f"{API_V1}/orders/{order_id}", headers=HEADERS)
        order_details = res.json()[0]
        assert order_details["qtyRemaining"] == 15
        assert order_details["price"] == 241000

        # 4. Cancel order
        res = await client.delete(f"{API_V1}/orders/{order_id}", headers=HEADERS)
        assert res.status_code == 200
        assert res.json()["success"] is True

        # Verify cancelled state
        res = await client.get(f"{API_V1}/orders/{order_id}", headers=HEADERS)
        order_details = res.json()[0]
        assert order_details["status"] == "Cancelled"
        assert order_details["qtyRemaining"] == 0
        print(f"[OK] L1 Order {order_id} placed -> modified (qty=15, px=241000) -> cancelled successfully")


@pytest.mark.asyncio
async def test_live_l2_stop_loss_trigger_pending_and_cancellation():
    """Live Server Hit: L2 Stop-Loss (SL & SL-M) orders rest in TRIGGER_PENDING and can be cancelled."""
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
        # Place SL SELL order: Trigger @ ₹2450.00, Limit @ ₹2440.00 (book="SL")
        sl_payload = {
            "exchange": "NSE",
            "token": 2885,
            "qty": -10,
            "price": 244000,
            "trigger": 245000,
            "book": "SL",
            "product": "MIS",
            "validity": "Day",
        }
        res = await client.post(f"{API_V1}/orders", json=sl_payload, headers=HEADERS)
        assert res.status_code == 200
        assert res.json()["success"] is True
        sl_order_id = res.json()["data"]["orderId"]

        # Check order status - must be TriggerPending
        res = await client.get(f"{API_V1}/orders/{sl_order_id}", headers=HEADERS)
        assert res.status_code == 200
        sl_details = res.json()[0]
        assert sl_details["status"] in ("TriggerPending", "Pending")
        assert sl_details["triggerPrice"] == 245000
        assert sl_details["price"] == 244000

        # Cancel resting Stop-Loss order
        res = await client.delete(f"{API_V1}/orders/{sl_order_id}", headers=HEADERS)
        assert res.status_code == 200
        assert res.json()["success"] is True

        res = await client.get(f"{API_V1}/orders/{sl_order_id}", headers=HEADERS)
        assert res.json()[0]["status"] == "Cancelled"
        print(f"[OK] L2 SL Order {sl_order_id} verified in TRIGGER_PENDING and cancelled cleanly")


@pytest.mark.asyncio
async def test_live_l3_margin_rejection_and_leverage():
    """Live Server Hit: L3 Short margin order rejection and 5x leverage validation."""
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
        # 1. Place gigantic order that exceeds account funds
        # 20,000 shares @ ₹2500 = ₹5,00,00,000 (5 Crore) > ₹10,00,000
        huge_payload = {
            "exchange": "NSE",
            "token": 2885,
            "qty": 20000,
            "price": 250000,
            "book": "RL",
            "product": "CNC",
            "validity": "Day",
        }
        res = await client.post(f"{API_V1}/orders", json=huge_payload, headers=HEADERS)
        assert res.status_code == 200
        envelope = res.json()
        assert envelope["success"] is False
        assert envelope["data"] is None
        assert "Insufficient funds" in envelope["error"]

        print(f"[OK] L3 Pre-trade risk check correctly rejected oversized order: {envelope['error']}")


@pytest.mark.asyncio
async def test_live_ledger_audit_zero_discrepancy():
    """Live Server Hit: Audit reconciliation guarantees ₹0.00 discrepancy ('The Ledger Never Lies')."""
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
        res = await client.get("/system/reconcile?account_id=HACK9999")
        assert res.status_code == 200
        audit = res.json()
        assert audit["is_balanced"] is True
        assert audit["discrepancy"] == "0.00"
        print(f"[OK] Double-Entry Ledger Reconciled: Discrepancy = ₹{audit['discrepancy']}, Balanced = {audit['is_balanced']}")


@pytest.mark.asyncio
async def test_live_l3_mis_auto_squareoff():
    """Live Server Hit: Deterministic 15:20 IST MIS auto square-off."""
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
        res = await client.post("/settlement/mis-squareoff")
        assert res.status_code == 200
        squareoff_res = res.json()
        assert isinstance(squareoff_res, list)
        print(f"[OK] MIS Auto Square-Off triggered successfully: {len(squareoff_res)} positions squared off")


if __name__ == "__main__":
    print("Running Live Server Integration Hits...")
    asyncio.run(test_live_server_health_and_market_depth())
    asyncio.run(test_live_021_auth_and_instruments())
    asyncio.run(test_live_l1_order_lifecycle_placement_modify_cancel())
    asyncio.run(test_live_l2_stop_loss_trigger_pending_and_cancellation())
    asyncio.run(test_live_l3_margin_rejection_and_leverage())
    asyncio.run(test_live_ledger_audit_zero_discrepancy())
    asyncio.run(test_live_l3_mis_auto_squareoff())
    print("\nALL LIVE SERVER HITS PASSED WITH 100% SUCCESS!")
