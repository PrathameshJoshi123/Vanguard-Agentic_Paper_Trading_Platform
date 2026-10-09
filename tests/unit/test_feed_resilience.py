import struct
from datetime import datetime, timezone, timedelta
from decimal import Decimal
import pytest

from src.market_data.models import MarketDepth, DepthLevel, FeedStatus
from src.market_data.sequence_manager import SequenceManager
from src.market_data.zero21.config import Zero21Config
from src.market_data.zero21.feed import Zero21MarketFeedHandler
from src.market_data.zero21.parser import TC_LTP, EXCH_NSECM


@pytest.fixture
def sequence_manager() -> SequenceManager:
    return SequenceManager(history_window=100)


def create_depth(
    symbol: str = "RELIANCE",
    ltp: Decimal = Decimal("2500.00"),
    sequence_id: int = 1,
    dt: datetime = None,
) -> MarketDepth:
    if dt is None:
        dt = datetime.now(timezone.utc)
    return MarketDepth(
        symbol=symbol,
        ltp=ltp,
        bids=[DepthLevel(price=ltp - Decimal("0.50"), quantity=100)],
        asks=[DepthLevel(price=ltp + Decimal("0.50"), quantity=100)],
        total_buy_quantity=1000,
        total_sell_quantity=1000,
        volume=10000,
        timestamp=dt,
        sequence_id=sequence_id,
    )


def test_duplicate_tick_rejection(sequence_manager: SequenceManager):
    """Verifies that ticks with identical (symbol, sequence_id, timestamp) are dropped."""
    now = datetime.now(timezone.utc)
    tick1 = create_depth(sequence_id=10, dt=now)
    tick2 = create_depth(sequence_id=10, dt=now)

    valid1, reason1 = sequence_manager.validate_and_record(tick1)
    assert valid1 is True
    assert reason1 is None

    valid2, reason2 = sequence_manager.validate_and_record(tick2)
    assert valid2 is False
    assert "Duplicate tick detected" in reason2

    health = sequence_manager.get_health("RELIANCE")
    assert health.duplicate_ticks_dropped == 1
    assert health.total_ticks_processed == 1


def test_out_of_order_sequence_rejection(sequence_manager: SequenceManager):
    """Verifies that ticks arriving with backwards sequence numbers are dropped."""
    now = datetime.now(timezone.utc)
    tick_later = create_depth(sequence_id=20, dt=now)
    tick_stale = create_depth(sequence_id=15, dt=now + timedelta(seconds=1))

    valid1, _ = sequence_manager.validate_and_record(tick_later)
    assert valid1 is True

    valid2, reason2 = sequence_manager.validate_and_record(tick_stale)
    assert valid2 is False
    assert "Out-of-order tick" in reason2

    health = sequence_manager.get_health("RELIANCE")
    assert health.out_of_order_ticks_dropped == 1


def test_out_of_order_timestamp_rejection(sequence_manager: SequenceManager):
    """Verifies that ticks arriving with older timestamps are dropped."""
    now = datetime.now(timezone.utc)
    tick_current = create_depth(sequence_id=0, dt=now)
    tick_past = create_depth(sequence_id=0, dt=now - timedelta(seconds=5))

    valid1, _ = sequence_manager.validate_and_record(tick_current)
    assert valid1 is True

    valid2, reason2 = sequence_manager.validate_and_record(tick_past)
    assert valid2 is False
    assert "Out-of-order tick by timestamp" in reason2

    health = sequence_manager.get_health("RELIANCE")
    assert health.out_of_order_ticks_dropped == 1


def test_sequence_gap_detection(sequence_manager: SequenceManager):
    """Verifies that jumps in sequence numbers are counted as sequence gaps."""
    now = datetime.now(timezone.utc)
    tick1 = create_depth(sequence_id=100, dt=now)
    tick2 = create_depth(sequence_id=115, dt=now + timedelta(milliseconds=10))

    sequence_manager.validate_and_record(tick1)
    valid2, _ = sequence_manager.validate_and_record(tick2)

    assert valid2 is True
    health = sequence_manager.get_health("RELIANCE")
    assert health.sequence_gaps_detected == 14  # skipped 101 through 114
    assert health.last_sequence_id == 115


def test_feed_handler_disconnect_and_reconnect():
    """Verifies that Zero21MarketFeedHandler manages disconnection states cleanly."""
    config = Zero21Config(
        ucc="HACK_MOCK",
        password="mock_password",
        ws_base_url="wss://mock.021.trade/market",
    )
    handler = Zero21MarketFeedHandler(config=config)
    assert handler.status == FeedStatus.DISCONNECTED

    health = handler.get_feed_health("RELIANCE")
    assert health.status == FeedStatus.DISCONNECTED
    assert health.duplicate_ticks_dropped == 0
