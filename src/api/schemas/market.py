from typing import List
from pydantic import BaseModel, Field


class CandleBarSchema(BaseModel):
    time: int = Field(..., description="Unix timestamp in seconds (UTC)")
    open: float = Field(..., description="Open price")
    high: float = Field(..., description="High price")
    low: float = Field(..., description="Low price")
    close: float = Field(..., description="Close price")
    volume: int = Field(default=0, description="Volume traded during candle interval")


class CandleHistoryResponse(BaseModel):
    symbol: str
    timeframe: str = "1m"
    candles: List[CandleBarSchema]
