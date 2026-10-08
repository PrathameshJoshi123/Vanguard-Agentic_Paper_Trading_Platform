from datetime import datetime, timezone, timedelta
from decimal import Decimal
import pytest

from src.market_data.models import DepthLevel, MarketDepth
from src.market_data.sequence_manager import SequenceManager


def make_dummy_depth(symbol: str, ltp: Decimal, seq: int, ts: datetime) -> MarketDepth:
    return MarketDepth(
        symbol=symbol,
        ltp=ltp,
        bids=[DepthLevel(price=ltp - Decimal("0.50"), quantity=100)],
        asks=[DepthLevel(price=ltp + Decimal("0.50"), quantity=100)],
        sequence_id=seq,
        timestamp=ts,
    )


def test_sequence_resilience_duplicate_drop():
    sm = SequenceManager()
    base_time = datetime(2026, 10, 8, 9, 30, 0, tzinfo=timezone.utc)

    d1 = make_dummy_depth("INFY", Decimal("1500.00"), seq=1, ts=base_time)
    ok1, reason1 = sm.validate_and_record(d1)
    assert ok1 is True
    assert reason1 is None

    # Duplicate tick identical sequence and timestamp
    d1_dup = make_dummy_depth("INFY", Decimal("1500.00"), seq=1, ts=base_time)
    ok2, reason2 = sm.validate_and_record(d1_dup)
    assert ok2 is False
    assert "Duplicate tick detected" in reason2

    health = sm.get_health("INFY")
    assert health.total_ticks_processed == 1
    assert health.duplicate_ticks_dropped == 1


def test_sequence_resilience_out_of_order_drop():
    sm = SequenceManager()
    t1 = datetime(2026, 10, 8, 9, 30, 0, tzinfo=timezone.utc)
    t2 = t1 + timedelta(seconds=1)
    t3 = t1 + timedelta(seconds=2)

    # Ingest seq 1
    sm.validate_and_record(make_dummy_depth("INFY", Decimal("1500.00"), seq=1, ts=t1))
    # Ingest seq 3 (jumped)
    sm.validate_and_record(make_dummy_depth("INFY", Decimal("1502.00"), seq=3, ts=t3))

    # Delayed arrival of seq 2 (older sequence than accepted 3)
    ok_delayed, reason = sm.validate_and_record(make_dummy_depth("INFY", Decimal("1501.00"), seq=2, ts=t2))
    assert ok_delayed is False
    assert "Out-of-order tick" in reason

    health = sm.get_health("INFY")
    assert health.out_of_order_ticks_dropped == 1
    assert health.sequence_gaps_detected == 1  # From 1 to 3 skipped seq 2


def test_sequence_resilience_gap_detection():
    sm = SequenceManager()
    t1 = datetime(2026, 10, 8, 9, 30, 0, tzinfo=timezone.utc)

    # Ingest seq 1
    sm.validate_and_record(make_dummy_depth("SBIN", Decimal("600.00"), seq=1, ts=t1))
    # Ingest seq 5 (skipped 2, 3, 4 -> 3 gaps)
    sm.validate_and_record(make_dummy_depth("SBIN", Decimal("605.00"), seq=5, ts=t1 + timedelta(seconds=4)))

    health = sm.get_health("SBIN")
    assert health.sequence_gaps_detected == 3
    assert health.total_ticks_processed == 2
