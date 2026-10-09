from decimal import Decimal
import struct
import pytest

from src.market_data.zero21.parser import (
    BinaryPacketParser,
    TC_LTP,
    TC_FULL,
    TC_HEARTBEAT,
    EXCH_NSECM,
)
from src.market_data.zero21.instruments import InstrumentMaster


@pytest.fixture
def parser() -> BinaryPacketParser:
    master = InstrumentMaster()
    return BinaryPacketParser(instruments=master)


def test_parse_tc1_ltp_basic(parser: BinaryPacketParser):
    # TC 1: 12 bytes
    # TC=1 (2B), Exch=1 (2B), Token=2885 (4B), LTP=250000 paise (4B) -> 2500.00
    frame = struct.pack(">H H I I", TC_LTP, EXCH_NSECM, 2885, 250000)
    depths = parser.parse_frame(frame, sequence_counter=1)

    assert len(depths) == 1
    depth = depths[0]
    assert depth.symbol == "RELIANCE"
    assert depth.ltp == Decimal("2500.00")
    assert depth.sequence_id == 1


def test_parse_tc1_ltp_with_snapshot_open(parser: BinaryPacketParser):
    # TC 1 with snapshot 'o': 17 bytes
    frame = struct.pack(
        ">H H I I c I",
        TC_LTP,
        EXCH_NSECM,
        2885,
        250500,  # LTP 2505.00
        b"o",
        249000,  # Open 2490.00
    )
    depths = parser.parse_frame(frame, sequence_counter=2)

    assert len(depths) == 1
    depth = depths[0]
    assert depth.symbol == "RELIANCE"
    assert depth.ltp == Decimal("2505.00")
    assert depth.open_price == Decimal("2490.00")


def test_parse_tc1_ltp_with_snapshot_close(parser: BinaryPacketParser):
    # TC 1 with snapshot 'c': 17 bytes
    frame = struct.pack(
        ">H H I I c I",
        TC_LTP,
        EXCH_NSECM,
        11536,  # TCS
        350000,  # LTP 3500.00
        b"c",
        348000,  # Close 3480.00
    )
    depths = parser.parse_frame(frame, sequence_counter=3)

    assert len(depths) == 1
    depth = depths[0]
    assert depth.symbol == "TCS"
    assert depth.ltp == Decimal("3500.00")
    assert depth.close_price == Decimal("3480.00")


def test_parse_tc10_heartbeat(parser: BinaryPacketParser):
    # Heartbeat is 2 bytes: TC=10
    frame = struct.pack(">H", TC_HEARTBEAT)
    depths = parser.parse_frame(frame)
    assert len(depths) == 0


def test_parse_tc3_nsecm_full_depth(parser: BinaryPacketParser):
    # 220-byte NSECM packet
    header = struct.pack(
        ">H H I I I I Q Q Q I I I I I",
        TC_FULL,
        EXCH_NSECM,
        2885,    # RELIANCE
        250050,  # LTP 2500.50
        100,     # Last trade qty
        249800,  # Avg price 2498.00
        1500000, # Volume
        45000,   # Total buy qty
        55000,   # Total sell qty
        249000,  # Close 2490.00
        249500,  # Open 2495.00
        251000,  # High 2510.00
        248500,  # Low 2485.00
        1234567, # Trade time
    )
    assert len(header) == 64

    # 10 levels of depth: 5 bids then 5 asks
    # Level format: qty (8B), price in paise (4B), orders (2B) = 14B
    depth_bytes = bytearray()

    # 5 Bids (descending price: 2500.00, 2499.50, 2499.00, 2498.50, 2498.00)
    for i in range(5):
        qty = 200 * (i + 1)
        price_paise = 250000 - (i * 50)
        orders = i + 1
        depth_bytes.extend(struct.pack(">Q I H", qty, price_paise, orders))

    # 5 Asks (ascending price: 2501.00, 2501.50, 2502.00, 2502.50, 2503.00)
    for i in range(5):
        qty = 300 * (i + 1)
        price_paise = 250100 + (i * 50)
        orders = i + 1
        depth_bytes.extend(struct.pack(">Q I H", qty, price_paise, orders))

    assert len(depth_bytes) == 140

    tail = struct.pack(
        ">I Q I",
        250000,  # Indicative close
        0,       # Imbalance qty
        1234567, # Exchange time
    )
    assert len(tail) == 16

    full_packet = header + depth_bytes + tail
    assert len(full_packet) == 220

    depths = parser.parse_frame(full_packet, sequence_counter=10)
    assert len(depths) == 1
    depth = depths[0]

    assert depth.symbol == "RELIANCE"
    assert depth.ltp == Decimal("2500.50")
    assert depth.open_price == Decimal("2495.00")
    assert depth.high_price == Decimal("2510.00")
    assert depth.low_price == Decimal("2485.00")
    assert depth.close_price == Decimal("2490.00")
    assert depth.volume == 1500000
    assert depth.total_buy_quantity == 45000
    assert depth.total_sell_quantity == 55000

    # Validate Depth
    assert len(depth.bids) == 5
    assert depth.bids[0].price == Decimal("2500.00")
    assert depth.bids[0].quantity == 200
    assert depth.bids[0].orders_count == 1

    assert len(depth.asks) == 5
    assert depth.asks[0].price == Decimal("2501.00")
    assert depth.asks[0].quantity == 300
    assert depth.asks[0].orders_count == 1

    assert depth.spread == Decimal("1.00")


def test_parse_multi_packet_frame(parser: BinaryPacketParser):
    # Pack TC 10 (Heartbeat 2B) + TC 1 (LTP 12B) + TC 1 (LTP 12B)
    p_heartbeat = struct.pack(">H", TC_HEARTBEAT)
    p_rel = struct.pack(">H H I I", TC_LTP, EXCH_NSECM, 2885, 250000)
    p_infy = struct.pack(">H H I I", TC_LTP, EXCH_NSECM, 1594, 160000)

    combined_frame = p_heartbeat + p_rel + p_infy
    assert len(combined_frame) == 26

    depths = parser.parse_frame(combined_frame)
    assert len(depths) == 2
    assert depths[0].symbol == "RELIANCE"
    assert depths[0].ltp == Decimal("2500.00")
    assert depths[1].symbol == "INFY"
    assert depths[1].ltp == Decimal("1600.00")
