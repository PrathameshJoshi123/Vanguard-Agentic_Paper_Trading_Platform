import asyncio
import json
import os
import tempfile
from decimal import Decimal
import pytest

from src.market_data.replay_engine import ReplayEngine
from src.market_data.models import FeedStatus


@pytest.mark.asyncio
async def test_replay_engine_streaming():
    ticks_data = [
        {
            "symbol": "RELIANCE",
            "ltp": 2500.00 + i,
            "bids": [{"price": 2499.50 + i, "quantity": 100}],
            "asks": [{"price": 2500.50 + i, "quantity": 100}],
            "volume": 1000 * (i + 1),
            "timestamp": f"2026-10-08T09:30:{i:02d}Z",
        }
        for i in range(10)
    ]

    with tempfile.NamedTemporaryFile("w+", delete=False, suffix=".jsonl", encoding="utf-8") as f:
        for t in ticks_data:
            f.write(json.dumps(t) + "\n")
        temp_path = f.name

    try:
        engine = ReplayEngine(file_path=temp_path, speed_multiplier=0)
        collected = []
        async for depth in engine.stream_ticks():
            collected.append(depth)

        assert len(collected) == 10
        assert engine.status == FeedStatus.COMPLETED
        assert engine.ticks_replayed == 10
        assert collected[0].symbol == "RELIANCE"
        assert collected[0].ltp == Decimal("2500.00")
        assert collected[9].ltp == Decimal("2509.00")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
