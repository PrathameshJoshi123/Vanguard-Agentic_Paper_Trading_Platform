from decimal import Decimal
import struct
import pytest

from src.market_data.models import FeedStatus, MarketDepth
from src.market_data.sequence_manager import SequenceManager
from src.market_data.zero21.config import Zero21Config
from src.market_data.zero21.feed import Zero21MarketFeedHandler
from src.market_data.zero21.parser import TC_LTP, EXCH_NSECM


@pytest.fixture
def feed_handler() -> Zero21MarketFeedHandler:
    config = Zero21Config(
        ucc="HACK1234",
        password="Pass",
        ws_base_url="wss://mock.021.trade/market",
    )
    seq_mgr = SequenceManager()
    return Zero21MarketFeedHandler(config=config, sequence_manager=seq_mgr)


def test_feed_handler_subscriptions(feed_handler: Zero21MarketFeedHandler):
    # Subscribe by symbol
    success = feed_handler.subscribe_symbol("RELIANCE")
    assert success is True
    assert (1, 2885) in feed_handler._subscribed_instruments

    # Subscribe by token
    feed_handler.subscribe_token(11536, exchange_code=1)
    assert (1, 11536) in feed_handler._subscribed_instruments


def test_feed_handler_binary_dispatch_and_deduplication(feed_handler: Zero21MarketFeedHandler):
    received_depths = []

    def on_tick(depth: MarketDepth):
        received_depths.append(depth)

    feed_handler.add_callback(on_tick)

    # Construct synthetic TC 1 packet for RELIANCE (2885) @ 2500.00
    pkt = struct.pack(">H H I I", TC_LTP, EXCH_NSECM, 2885, 250000)

    # First dispatch should succeed
    feed_handler._process_binary_frame(pkt)
    assert len(received_depths) == 1
    assert received_depths[0].symbol == "RELIANCE"
    assert received_depths[0].ltp == Decimal("2500.00")

    # Second dispatch with identical sequence/timestamp is dropped as duplicate
    # by SequenceManager
    feed_handler._process_binary_frame(pkt)
    # The callback should not be invoked a second time if dropped
    # Let's check feed health
    health = feed_handler.get_feed_health("RELIANCE")
    assert health.duplicate_ticks_dropped >= 1


@pytest.mark.asyncio
async def test_feed_handler_graceful_start_and_stop(feed_handler: Zero21MarketFeedHandler):
    # Should start without crashing and stop cleanly
    feed_handler.subscribe_symbol("RELIANCE")
    await feed_handler.start()
    assert feed_handler._running is True

    await feed_handler.stop()
    assert feed_handler._running is False
    assert feed_handler.status == FeedStatus.DISCONNECTED
