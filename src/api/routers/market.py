from decimal import Decimal
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field

from src.market_data.gateway import MarketDataGateway
from src.api.dependencies import get_market_gateway

router = APIRouter(prefix="/market", tags=["Market Data"])


class DepthLevelSchema(BaseModel):
    price: float
    quantity: int
    orders: int = 1


class MarketDepthResponse(BaseModel):
    symbol: str
    ltp: float
    spread: float
    bids: List[DepthLevelSchema]
    asks: List[DepthLevelSchema]
    total_buy_quantity: int
    total_sell_quantity: int
    volume: int
    timestamp: str
    feed_mode: str


class FeedModeRequest(BaseModel):
    mode: str = Field(..., description="'LIVE' or 'OFFLINE' / 'REPLAY'")
    speed_multiplier: Optional[float] = Field(default=None, description="Pacing multiplier for replay")
    file_path: Optional[str] = Field(default="data/reliance_50_ticks.jsonl", description="Path to replay file")


class FeedStatusResponse(BaseModel):
    feed_mode: str
    is_running: bool
    symbols_tracked: List[str]
    health: Dict[str, Any]


@router.get("/depth/{symbol}", response_model=MarketDepthResponse)
def get_market_depth(
    symbol: str,
    gateway: MarketDataGateway = Depends(get_market_gateway),
):
    """
    Returns live L2 5-depth order book for a symbol (bids, asks, LTP, spread, volume).
    Falls back gracefully to realistic resting liquidity if tick stream is warming up.
    """
    sym = symbol.upper()
    depth = gateway.get_latest_depth(sym)
    bids = [
        DepthLevelSchema(price=float(b.price), quantity=b.quantity, orders=getattr(b, "orders", 1))
        for b in depth.bids[:5]
    ]
    asks = [
        DepthLevelSchema(price=float(a.price), quantity=a.quantity, orders=getattr(a, "orders", 1))
        for a in depth.asks[:5]
    ]
    spread = round(asks[0].price - bids[0].price, 2) if (asks and bids) else 0.0

    return MarketDepthResponse(
        symbol=sym,
        ltp=float(depth.ltp),
        spread=spread,
        bids=bids,
        asks=asks,
        total_buy_quantity=depth.total_buy_quantity,
        total_sell_quantity=depth.total_sell_quantity,
        volume=depth.volume,
        timestamp=depth.timestamp.isoformat() if depth.timestamp else "",
        feed_mode="REPLAY" if gateway.replay_mode else "LIVE",
    )


@router.get("/status", response_model=FeedStatusResponse)
def get_feed_status(
    gateway: MarketDataGateway = Depends(get_market_gateway),
):
    """
    Returns current feed health, mode (LIVE NSE vs OFFLINE REPLAY), and sequence metrics.
    """
    health = gateway.get_feed_health("RELIANCE")
    return FeedStatusResponse(
        feed_mode="REPLAY" if gateway.replay_mode else "LIVE",
        is_running=gateway.is_running,
        symbols_tracked=list(gateway._latest_depths.keys()) or ["RELIANCE"],
        health={
            "symbol": health.symbol,
            "status": str(health.status),
            "ticks_received": health.total_ticks_processed,
            "duplicates_dropped": health.duplicate_ticks_dropped,
            "out_of_order_dropped": health.out_of_order_ticks_dropped,
            "sequence_gaps_detected": health.sequence_gaps_detected,
        },
    )


@router.post("/feed-mode", status_code=status.HTTP_200_OK)
async def toggle_feed_mode(
    req: FeedModeRequest,
    gateway: MarketDataGateway = Depends(get_market_gateway),
):
    """
    The 'Demo Toggle Switch' endpoint:
    Switches between LIVE NSE FEED and OFFLINE REPLAY seamlessly.
    """
    is_replay = req.mode.upper() in ("REPLAY", "OFFLINE")
    file_path = req.file_path if is_replay else None

    await gateway.switch_feed_mode(
        replay_mode=is_replay,
        replay_file_path=file_path,
        symbols=["RELIANCE"],
    )

    return {
        "status": "SUCCESS",
        "feed_mode": "REPLAY" if is_replay else "LIVE",
        "message": f"Market feed successfully switched to {'OFFLINE REPLAY' if is_replay else 'LIVE NSE FEED'}.",
    }
