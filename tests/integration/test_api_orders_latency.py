import time
from decimal import Decimal
import pytest
from httpx import AsyncClient, ASGITransport

from src.api.app import app
from src.api.dependencies import get_trade_service, reset_engine_state


@pytest.fixture(autouse=True)
def setup_engine():
    reset_engine_state()
    svc = get_trade_service()
    svc.register_account("ACC_LATENCY_TEST", initial_deposit=Decimal("10000000.00"))
    yield
    reset_engine_state()


@pytest.mark.asyncio
async def test_order_placement_latency_sub_5ms_exit_criteria():
    """
    Phase 4 Exit Criteria:
    Send an order via API.
    See the response in <5ms.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Warmup request
        warmup_payload = {
            "symbol": "TCS",
            "side": "BUY",
            "order_type": "LIMIT",
            "quantity": 1,
            "price": "3000.00",
            "product_type": "CNC",
            "account_id": "ACC_LATENCY_TEST",
        }
        await client.post("/orders", json=warmup_payload)

        # Benchmark 50 order placements
        durations = []
        for i in range(50):
            payload = {
                "symbol": "TCS",
                "side": "BUY",
                "order_type": "LIMIT",
                "quantity": 5,
                "price": str(Decimal("3000.00") - Decimal(i)),
                "product_type": "CNC",
                "account_id": "ACC_LATENCY_TEST",
            }

            t_start = time.perf_counter()
            response = await client.post("/orders", json=payload)
            t_end = time.perf_counter()

            assert response.status_code == 201
            latency_ms = (t_end - t_start) * 1000.0
            durations.append(latency_ms)

        avg_latency_ms = sum(durations) / len(durations)
        p95_latency_ms = sorted(durations)[int(len(durations) * 0.95)]

        print(f"\n[LATENCY BENCHMARK] Average: {avg_latency_ms:.3f}ms, P95: {p95_latency_ms:.3f}ms")

        # Must strictly meet < 5ms exit criterion
        assert avg_latency_ms < 5.0, f"Average latency {avg_latency_ms:.3f}ms exceeded 5ms limit!"
        assert p95_latency_ms < 5.0, f"P95 latency {p95_latency_ms:.3f}ms exceeded 5ms limit!"
