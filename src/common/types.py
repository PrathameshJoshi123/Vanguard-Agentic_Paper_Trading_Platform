from enum import Enum


class Side(str, Enum):
    BUY = "BUY"
    SELL = "SELL"


class OrderType(str, Enum):
    MARKET = "MARKET"
    LIMIT = "LIMIT"
    SL = "SL"       # Stop-Loss Limit (PS requirement for subsequent phases)
    SL_M = "SL_M"   # Stop-Loss Market (PS requirement for subsequent phases)


class OrderStatus(str, Enum):
    PENDING = "PENDING"
    OPEN = "OPEN"
    PARTIALLY_FILLED = "PARTIALLY_FILLED"
    FILLED = "FILLED"
    CANCELLED = "CANCELLED"
    REJECTED = "REJECTED"


class ProductType(str, Enum):
    CNC = "CNC"  # Cash and Carry (Delivery)
    MIS = "MIS"  # Margin Intraday Square-off


class TimeInForce(str, Enum):
    DAY = "DAY"
    IOC = "IOC"  # Immediate or Cancel
