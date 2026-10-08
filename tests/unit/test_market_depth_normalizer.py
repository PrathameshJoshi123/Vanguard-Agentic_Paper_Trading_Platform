from decimal import Decimal
import pytest

from src.market_data.normalizer import MarketDepthNormalizer
from src.market_data.models import MarketDepth


def test_normalize_nse_quote_structure():
    raw_nse_payload = {
        "priceInfo": {
            "lastPrice": 2450.50,
            "open": 2420.00,
            "close": 2430.00,
            "intraDayHighLow": {
                "max": 2465.00,
                "min": 2410.00,
            },
        },
        "marketDeptOrderBook": {
            "totalBuyQuantity": 50000,
            "totalSellQuantity": 42000,
            "bid": [
                {"price": 2450.00, "quantity": 500, "orders": 12},
                {"price": 2449.50, "quantity": 1200, "orders": 25},
                {"price": 2449.00, "quantity": 800, "orders": 15},
                {"price": 2448.50, "quantity": 2000, "orders": 40},
                {"price": 2448.00, "quantity": 1500, "orders": 30},
                {"price": 2447.50, "quantity": 3000, "orders": 50},  # 6th level, should be sliced to 5
            ],
            "ask": [
                {"price": 2450.50, "quantity": 600, "orders": 10},
                {"price": 2451.00, "quantity": 900, "orders": 18},
                {"price": 2451.50, "quantity": 1100, "orders": 22},
                {"price": 2452.00, "quantity": 1500, "orders": 35},
                {"price": 2452.50, "quantity": 2500, "orders": 45},
            ],
        },
        "volume": 1250000,
        "lastUpdateTime": "2026-10-08T09:30:00+00:00",
    }

    depth: MarketDepth = MarketDepthNormalizer.normalize_nse_quote("RELIANCE", raw_nse_payload, sequence_id=1)

    assert depth.symbol == "RELIANCE"
    assert depth.ltp == Decimal("2450.50")
    assert depth.open_price == Decimal("2420.00")
    assert depth.high_price == Decimal("2465.00")
    assert depth.low_price == Decimal("2410.00")
    assert depth.close_price == Decimal("2430.00")

    # Top 5 bids descending
    assert len(depth.bids) == 5
    assert depth.bids[0].price == Decimal("2450.00")
    assert depth.bids[0].quantity == 500
    assert depth.bids[0].orders_count == 12
    assert depth.bids[4].price == Decimal("2448.00")

    # Top 5 asks ascending
    assert len(depth.asks) == 5
    assert depth.asks[0].price == Decimal("2450.50")
    assert depth.asks[0].quantity == 600
    assert depth.asks[4].price == Decimal("2452.50")

    # Spread calculation
    assert depth.spread == Decimal("0.50")
    assert depth.total_buy_quantity == 50000
    assert depth.total_sell_quantity == 42000
    assert depth.volume == 1250000


def test_normalize_generic_replay_dict():
    generic_payload = {
        "symbol": "TCS",
        "ltp": "3850.25",
        "bids": [
            {"price": "3850.00", "quantity": 300},
            {"price": "3849.50", "quantity": 500},
        ],
        "asks": [
            {"price": "3850.50", "quantity": 400},
            {"price": "3851.00", "quantity": 700},
        ],
        "volume": 98000,
        "timestamp": "2026-10-08T10:15:30Z",
    }

    depth = MarketDepthNormalizer.normalize_generic(generic_payload, sequence_id=42)
    assert depth.symbol == "TCS"
    assert depth.ltp == Decimal("3850.25")
    assert depth.best_bid == Decimal("3850.00")
    assert depth.best_ask == Decimal("3850.50")
    assert depth.spread == Decimal("0.50")
    assert depth.sequence_id == 42
