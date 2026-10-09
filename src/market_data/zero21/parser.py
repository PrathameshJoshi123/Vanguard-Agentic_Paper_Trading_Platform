from datetime import datetime, timezone
from decimal import Decimal
import logging
import struct
from typing import List, Optional, Tuple

from src.common.money import to_money
from src.market_data.models import DepthLevel, MarketDepth
from src.market_data.zero21.instruments import InstrumentMaster, instrument_master

logger = logging.getLogger(__name__)

# Constants for Transaction Codes (TC)
TC_LTP = 1
TC_FULL = 3
TC_ORDERS_BSE = 8
TC_OPTION_CHAIN = 9
TC_HEARTBEAT = 10

# Exchange codes
EXCH_NSECM = 1
EXCH_NSEFO = 2
EXCH_NSEIDX = 3
EXCH_BSEEQ = 4
EXCH_BSEFO = 5
EXCH_BSEIDX = 6

# Base epoch offset for 1980-01-01 00:00:00 IST in seconds
EPOCH_1980_OFFSET = 315513000


class BinaryPacketParser:
    """
    High-Performance Zero-Allocation Binary Market Feed Parser for 021 Trade Developer Sandbox.
    Decodes Big-Endian ('>') byte streams:
      - TC 1 (LTP, 12 bytes min + snapshot 'o'/'c' 5 bytes)
      - TC 3 (Full Depth, 220 bytes for NSECM)
      - TC 10 (Heartbeat, 2 bytes)
    Packs depth levels (5 Bids, 5 Asks) and normalizes paise integers into Decimal Rupees.
    """

    def __init__(self, instruments: Optional[InstrumentMaster] = None):
        self.instruments = instruments or instrument_master

    @staticmethod
    def paise_to_decimal(paise: int) -> Decimal:
        """Converts integer paise (₹1 = 100 paise) to Decimal Rupees."""
        return to_money(Decimal(paise) / Decimal("100"))

    def parse_frame(self, frame_bytes: bytes, sequence_counter: int = 0) -> List[MarketDepth]:
        """
        Parses a single WebSocket frame which may contain multiple binary packets packed back-to-back.
        Returns a list of normalized MarketDepth objects.
        """
        depths: List[MarketDepth] = []
        offset = 0
        total_len = len(frame_bytes)

        while offset + 2 <= total_len:
            tc = struct.unpack_from(">H", frame_bytes, offset)[0]

            if tc == TC_HEARTBEAT:
                # 2-byte heartbeat frame [0x00, 0x0A]
                offset += 2
                continue

            elif tc == TC_LTP:
                depth, bytes_consumed = self._parse_tc1_ltp(
                    frame_bytes, offset, total_len, sequence_counter
                )
                if bytes_consumed <= 0:
                    break
                offset += bytes_consumed
                if depth:
                    depths.append(depth)

            elif tc == TC_FULL:
                depth, bytes_consumed = self._parse_tc3_full(
                    frame_bytes, offset, total_len, sequence_counter
                )
                if bytes_consumed <= 0:
                    break
                offset += bytes_consumed
                if depth:
                    depths.append(depth)

            else:
                # Unknown TC or corrupted stream, skip 2 bytes to re-align
                logger.debug(f"Unknown or unhandled packet TC {tc} at offset {offset}, skipping.")
                offset += 2

        return depths

    def _parse_tc1_ltp(
        self, data: bytes, offset: int, total_len: int, sequence_id: int
    ) -> Tuple[Optional[MarketDepth], int]:
        """
        TC 1: LTP Packet
        0: TC (2B)
        2: Exchange code (2B)
        4: Token (4B)
        8: LTP in paise (4B)
        Total base length: 12 bytes.
        In snapshot frames: may have 5 extra bytes (1 byte 'o' or 'c' + 4B price).
        """
        if offset + 12 > total_len:
            return None, 0

        tc, exch, token, ltp_paise = struct.unpack_from(">HHI I", data, offset)
        bytes_consumed = 12

        # Check for 5 extra snapshot bytes ('o' or 'c')
        open_price: Optional[Decimal] = None
        close_price: Optional[Decimal] = None
        if offset + 17 <= total_len:
            peek_next = data[offset + 12]
            if peek_next in (0x6F, 0x63):  # 'o' or 'c'
                extra_type, extra_price_paise = struct.unpack_from(">cI", data, offset + 12)
                bytes_consumed += 5
                if extra_type == b"o":
                    open_price = self.paise_to_decimal(extra_price_paise)
                elif extra_type == b"c":
                    close_price = self.paise_to_decimal(extra_price_paise)

        symbol = self.instruments.token_to_symbol(token) or f"TOKEN_{token}"
        ltp = self.paise_to_decimal(ltp_paise)

        # Single LTP tick with default spread levels if depth is absent
        depth = MarketDepth(
            symbol=symbol,
            ltp=ltp,
            bids=[DepthLevel(price=ltp - Decimal("0.05"), quantity=100, orders_count=1)],
            asks=[DepthLevel(price=ltp + Decimal("0.05"), quantity=100, orders_count=1)],
            total_buy_quantity=100,
            total_sell_quantity=100,
            volume=0,
            open_price=open_price,
            close_price=close_price,
            timestamp=datetime.now(timezone.utc),
            sequence_id=sequence_id,
        )
        return depth, bytes_consumed

    def _parse_tc3_full(
        self, data: bytes, offset: int, total_len: int, sequence_id: int
    ) -> Tuple[Optional[MarketDepth], int]:
        """
        TC 3: Full Depth Packet
        Layout depends on exchange code at offset + 2:
          - NSECM (1): 220 bytes.
          - NSEIDX (3): 36 bytes.
          - NSEFO (2): 234 bytes.
          - BSE (4/5/6): 262 bytes.
        """
        if offset + 4 > total_len:
            return None, 0

        exch = struct.unpack_from(">H", data, offset + 2)[0]

        if exch == EXCH_NSECM:
            return self._parse_tc3_nsecm(data, offset, total_len, sequence_id)
        elif exch == EXCH_NSEIDX:
            return self._parse_tc3_nseidx(data, offset, total_len, sequence_id)
        elif exch == EXCH_NSEFO:
            return self._parse_tc3_nsefo(data, offset, total_len, sequence_id)
        elif exch in (EXCH_BSEEQ, EXCH_BSEFO, EXCH_BSEIDX):
            return self._parse_tc3_bse(data, offset, total_len, sequence_id)
        else:
            # Skip unknown exchange full packet (at least 220 bytes or advance offset)
            return None, 4

    def _parse_tc3_nsecm(
        self, data: bytes, offset: int, total_len: int, sequence_id: int
    ) -> Tuple[Optional[MarketDepth], int]:
        """
        Exchange 1 (NSECM) Full Packet: 220 bytes.
        0: TC (2)
        2: exch (2)
        4: token (4)
        8: LTP (4)
        12: last trade qty (4)
        16: avg price (4)
        20: volume (8)
        28: total buy qty (8)
        36: total sell qty (8)
        44: close (4)
        48: open (4)
        52: high (4)
        56: low (4)
        60: last trade time (4)
        64: depth (140 bytes = 10 levels * 14 bytes)
            Each level: qty(8) + price(4) + orders(2)
            first 5 bids, then 5 asks
        204: indicative close (4)
        208: indicative imbalance qty (8)
        216: exchange time (4)
        Total = 220 bytes.
        """
        PACKET_LEN = 220
        if offset + PACKET_LEN > total_len:
            return None, 0

        header_fmt = ">H H I I I I Q Q Q I I I I I"
        (
            tc,
            exch,
            token,
            ltp_paise,
            last_trade_qty,
            avg_price_paise,
            volume,
            total_buy_qty,
            total_sell_qty,
            close_paise,
            open_paise,
            high_paise,
            low_paise,
            last_trade_time_raw,
        ) = struct.unpack_from(header_fmt, data, offset)

        symbol = self.instruments.token_to_symbol(token) or f"TOKEN_{token}"
        ltp = self.paise_to_decimal(ltp_paise)
        open_price = self.paise_to_decimal(open_paise) if open_paise > 0 else None
        high_price = self.paise_to_decimal(high_paise) if high_paise > 0 else None
        low_price = self.paise_to_decimal(low_paise) if low_paise > 0 else None
        close_price = self.paise_to_decimal(close_paise) if close_paise > 0 else None

        # Parse 10 depth levels: 5 bids followed by 5 asks (140 bytes from offset + 64)
        depth_offset = offset + 64
        bids: List[DepthLevel] = []
        asks: List[DepthLevel] = []

        # 5 Bids
        for _ in range(5):
            qty, price_paise, orders = struct.unpack_from(">Q I H", data, depth_offset)
            depth_offset += 14
            if price_paise > 0:
                bids.append(
                    DepthLevel(
                        price=self.paise_to_decimal(price_paise),
                        quantity=qty,
                        orders_count=orders,
                    )
                )

        # 5 Asks
        for _ in range(5):
            qty, price_paise, orders = struct.unpack_from(">Q I H", data, depth_offset)
            depth_offset += 14
            if price_paise > 0:
                asks.append(
                    DepthLevel(
                        price=self.paise_to_decimal(price_paise),
                        quantity=qty,
                        orders_count=orders,
                    )
                )

        # Parse trade / exchange time
        trade_time = datetime.now(timezone.utc)
        if last_trade_time_raw > 0:
            unix_ts = last_trade_time_raw + EPOCH_1980_OFFSET
            try:
                trade_time = datetime.fromtimestamp(unix_ts, tz=timezone.utc)
            except Exception:
                pass

        depth = MarketDepth(
            symbol=symbol,
            ltp=ltp,
            bids=bids[:5],
            asks=asks[:5],
            total_buy_quantity=total_buy_qty,
            total_sell_quantity=total_sell_qty,
            volume=volume,
            open_price=open_price,
            high_price=high_price,
            low_price=low_price,
            close_price=close_price,
            timestamp=trade_time,
            sequence_id=sequence_id,
        )

        return depth, PACKET_LEN

    def _parse_tc3_nseidx(
        self, data: bytes, offset: int, total_len: int, sequence_id: int
    ) -> Tuple[Optional[MarketDepth], int]:
        """NSE Index Packet: 36 bytes."""
        PACKET_LEN = 36
        if offset + PACKET_LEN > total_len:
            return None, 0

        tc, exch, token, index_val_paise, close_p, open_p, high_p, low_p, exch_time, ind_close = (
            struct.unpack_from(">H H I I I I I I I I", data, offset)
        )

        symbol = self.instruments.token_to_symbol(token) or f"INDEX_{token}"
        ltp = self.paise_to_decimal(index_val_paise)

        depth = MarketDepth(
            symbol=symbol,
            ltp=ltp,
            bids=[],
            asks=[],
            open_price=self.paise_to_decimal(open_p) if open_p > 0 else None,
            high_price=self.paise_to_decimal(high_p) if high_p > 0 else None,
            low_price=self.paise_to_decimal(low_p) if low_p > 0 else None,
            close_price=self.paise_to_decimal(close_p) if close_p > 0 else None,
            timestamp=datetime.now(timezone.utc),
            sequence_id=sequence_id,
        )
        return depth, PACKET_LEN

    def _parse_tc3_nsefo(
        self, data: bytes, offset: int, total_len: int, sequence_id: int
    ) -> Tuple[Optional[MarketDepth], int]:
        """NSEFO Packet: 234 bytes."""
        PACKET_LEN = 234
        if offset + PACKET_LEN > total_len:
            return None, 0
        token = struct.unpack_from(">I", data, offset + 6)[0]
        ltp_paise = struct.unpack_from(">I", data, offset + 10)[0]
        symbol = self.instruments.token_to_symbol(token) or f"NSEFO_{token}"
        ltp = self.paise_to_decimal(ltp_paise)
        depth = MarketDepth(
            symbol=symbol,
            ltp=ltp,
            timestamp=datetime.now(timezone.utc),
            sequence_id=sequence_id,
        )
        return depth, PACKET_LEN

    def _parse_tc3_bse(
        self, data: bytes, offset: int, total_len: int, sequence_id: int
    ) -> Tuple[Optional[MarketDepth], int]:
        """BSE Packet: 262 bytes."""
        PACKET_LEN = 262
        if offset + PACKET_LEN > total_len:
            return None, 0
        token = struct.unpack_from(">I", data, offset + 4)[0]
        ltp_paise = struct.unpack_from(">I", data, offset + 8)[0]
        symbol = self.instruments.token_to_symbol(token) or f"BSE_{token}"
        ltp = self.paise_to_decimal(ltp_paise)
        depth = MarketDepth(
            symbol=symbol,
            ltp=ltp,
            timestamp=datetime.now(timezone.utc),
            sequence_id=sequence_id,
        )
        return depth, PACKET_LEN


# Global singleton parser
binary_packet_parser = BinaryPacketParser()
