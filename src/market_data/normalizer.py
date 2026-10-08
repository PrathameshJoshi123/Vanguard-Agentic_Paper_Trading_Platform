from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional

from src.common.money import to_money
from src.market_data.models import DepthLevel, MarketDepth


class MarketDepthNormalizer:
    """
    Normalizes raw market depth payloads from multiple vendors (NSE India / nsepython,
    Angel One, Dhan, or Generic WebSocket feeds) into the unified internal MarketDepth DTO.
    """

    @classmethod
    def normalize_nse_quote(cls, symbol: str, raw_data: Dict[str, Any], sequence_id: int = 0) -> MarketDepth:
        """
        Normalizes an NSE India / nsepython quote response.
        Structure typically contains:
          - priceInfo: {lastPrice, open, intraDayHighLow: {min, max}, close, ...}
          - marketDeptOrderBook: {bid: [{price, quantity}], ask: [{price, quantity}], totalBuyQuantity, totalSellQuantity}
          - or directly at root level if pre-parsed.
        """
        # If payload comes wrapped in nsepython nse_quote {'equityResponse': [...]}
        if "equityResponse" in raw_data and isinstance(raw_data["equityResponse"], list) and len(raw_data["equityResponse"]) > 0:
            raw_data = raw_data["equityResponse"][0]

        price_info = raw_data.get("priceInfo", {})
        meta_data = raw_data.get("metaData", {})
        trade_info = raw_data.get("tradeInfo", {})
        order_book = raw_data.get("orderBook", {})

        ltp_val = (
            order_book.get("lastPrice")
            or price_info.get("lastPrice")
            or trade_info.get("lastPrice")
            or raw_data.get("lastPrice")
            or raw_data.get("ltp")
            or Decimal("0.00")
        )
        ltp = to_money(Decimal(str(ltp_val)))

        open_p = meta_data.get("open") or price_info.get("open")
        high_p = meta_data.get("dayHigh") or price_info.get("intraDayHighLow", {}).get("max") or price_info.get("high")
        low_p = meta_data.get("dayLow") or price_info.get("intraDayHighLow", {}).get("min") or price_info.get("low")
        close_p = meta_data.get("closePrice") or price_info.get("close")

        # Parse market depth:
        # Check orderBook (nsepython nse_quote format: buyPrice1..5, buyQuantity1..5, sellPrice1..5, sellQuantity1..5)
        raw_bids = []
        raw_asks = []
        if order_book and "buyPrice1" in order_book:
            for i in range(1, 6):
                bp = order_book.get(f"buyPrice{i}")
                bq = order_book.get(f"buyQuantity{i}")
                if bp is not None and bq is not None and bp > 0:
                    raw_bids.append({"price": bp, "quantity": bq})

                sp = order_book.get(f"sellPrice{i}")
                sq = order_book.get(f"sellQuantity{i}")
                if sp is not None and sq is not None and sp > 0:
                    raw_asks.append({"price": sp, "quantity": sq})
        else:
            depth_block = raw_data.get("marketDeptOrderBook", {})
            raw_bids = depth_block.get("bid", []) or raw_data.get("bids", [])
            raw_asks = depth_block.get("ask", []) or raw_data.get("asks", [])

        bids = cls._extract_depth_levels(raw_bids, reverse=True)
        asks = cls._extract_depth_levels(raw_asks, reverse=False)

        total_buy = int(
            order_book.get("totalBuyQuantity")
            or raw_data.get("marketDeptOrderBook", {}).get("totalBuyQuantity")
            or raw_data.get("totalBuyQuantity")
            or sum(b.quantity for b in bids)
        )
        total_sell = int(
            order_book.get("totalSellQuantity")
            or raw_data.get("marketDeptOrderBook", {}).get("totalSellQuantity")
            or raw_data.get("totalSellQuantity")
            or sum(a.quantity for a in asks)
        )
        volume = int(
            trade_info.get("totalTradedVolume")
            or raw_data.get("volume")
            or raw_data.get("totalTradedVolume")
            or 0
        )

        # Parse timestamp
        timestamp_str = raw_data.get("lastUpdateTime") or raw_data.get("timestamp")
        tick_time = cls._parse_timestamp(timestamp_str)


        return MarketDepth(
            symbol=symbol.upper(),
            ltp=ltp,
            bids=bids[:5],
            asks=asks[:5],
            total_buy_quantity=total_buy,
            total_sell_quantity=total_sell,
            volume=volume,
            open_price=to_money(Decimal(str(open_p))) if open_p is not None else None,
            high_price=to_money(Decimal(str(high_p))) if high_p is not None else None,
            low_price=to_money(Decimal(str(low_p))) if low_p is not None else None,
            close_price=to_money(Decimal(str(close_p))) if close_p is not None else None,
            timestamp=tick_time,
            sequence_id=sequence_id,
        )

    @classmethod
    def normalize_generic(cls, data: Dict[str, Any], sequence_id: int = 0) -> MarketDepth:
        """
        Normalizes a generic dictionary (e.g. from a .jsonl replay file or standard mock feed).
        """
        symbol = str(data.get("symbol", "UNKNOWN")).upper()
        ltp = to_money(Decimal(str(data["ltp"])))

        raw_bids = data.get("bids", [])
        raw_asks = data.get("asks", [])

        bids = cls._extract_depth_levels(raw_bids, reverse=True)
        asks = cls._extract_depth_levels(raw_asks, reverse=False)

        total_buy = int(data.get("total_buy_quantity") or sum(b.quantity for b in bids))
        total_sell = int(data.get("total_sell_quantity") or sum(a.quantity for a in asks))
        volume = int(data.get("volume", 0))

        timestamp = cls._parse_timestamp(data.get("timestamp"))
        seq = int(data.get("sequence_id", sequence_id))

        return MarketDepth(
            symbol=symbol,
            ltp=ltp,
            bids=bids[:5],
            asks=asks[:5],
            total_buy_quantity=total_buy,
            total_sell_quantity=total_sell,
            volume=volume,
            open_price=to_money(Decimal(str(data["open_price"]))) if data.get("open_price") is not None else None,
            high_price=to_money(Decimal(str(data["high_price"]))) if data.get("high_price") is not None else None,
            low_price=to_money(Decimal(str(data["low_price"]))) if data.get("low_price") is not None else None,
            close_price=to_money(Decimal(str(data["close_price"]))) if data.get("close_price") is not None else None,
            timestamp=timestamp,
            sequence_id=seq,
        )

    @staticmethod
    def _extract_depth_levels(levels: List[Dict[str, Any]], reverse: bool = False) -> List[DepthLevel]:
        """Extracts and orders depth levels."""
        parsed: List[DepthLevel] = []
        for item in levels:
            price_val = item.get("price")
            qty_val = item.get("quantity") or item.get("qty")
            orders_count = item.get("orders") or item.get("orders_count")
            if price_val is not None and qty_val is not None:
                parsed.append(
                    DepthLevel(
                        price=to_money(Decimal(str(price_val))),
                        quantity=int(qty_val),
                        orders_count=int(orders_count) if orders_count is not None else None,
                    )
                )
        # Bids: descending by price; Asks: ascending by price
        parsed.sort(key=lambda x: x.price, reverse=reverse)
        return parsed

    @staticmethod
    def _parse_timestamp(ts_val: Any) -> datetime:
        if isinstance(ts_val, datetime):
            return ts_val if ts_val.tzinfo else ts_val.replace(tzinfo=timezone.utc)
        if isinstance(ts_val, (int, float)):
            # Epoch timestamp in milliseconds or seconds
            if ts_val > 1e11:
                return datetime.fromtimestamp(ts_val / 1000.0, tz=timezone.utc)
            return datetime.fromtimestamp(ts_val, tz=timezone.utc)
        if isinstance(ts_val, str):
            try:
                # ISO 8601 or standard string
                dt = datetime.fromisoformat(ts_val.replace("Z", "+00:00"))
                return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
            except Exception:
                pass
        return datetime.now(timezone.utc)
