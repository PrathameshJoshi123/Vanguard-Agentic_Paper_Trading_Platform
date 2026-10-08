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
    TRIGGER_PENDING = "TRIGGER_PENDING"  # Resting Stop-Loss order awaiting trigger price
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


class LedgerCategory(str, Enum):
    CASH_DEPOSIT = "CASH_DEPOSIT"
    CASH_WITHDRAWAL = "CASH_WITHDRAWAL"
    TRADE_SETTLEMENT = "TRADE_SETTLEMENT"
    BROKERAGE_CHARGE = "BROKERAGE_CHARGE"
    STT_CHARGE = "STT_CHARGE"
    EXCHANGE_TURNOVER_CHARGE = "EXCHANGE_TURNOVER_CHARGE"
    SEBI_TURNOVER_CHARGE = "SEBI_TURNOVER_CHARGE"
    STAMP_DUTY_CHARGE = "STAMP_DUTY_CHARGE"
    GST_CHARGE = "GST_CHARGE"
    MARGIN_BLOCK = "MARGIN_BLOCK"
    MARGIN_RELEASE = "MARGIN_RELEASE"
    REALIZED_PNL = "REALIZED_PNL"


class AccountCategory(str, Enum):
    USER_CASH = "USER_CASH"
    USER_MARGIN_RESERVE = "USER_MARGIN_RESERVE"
    BROKER_REVENUE = "BROKER_REVENUE"
    STT_PAYABLE = "STT_PAYABLE"
    EXCHANGE_FEES_PAYABLE = "EXCHANGE_FEES_PAYABLE"
    SEBI_FEES_PAYABLE = "SEBI_FEES_PAYABLE"
    STAMP_DUTY_PAYABLE = "STAMP_DUTY_PAYABLE"
    GST_PAYABLE = "GST_PAYABLE"
    EXCHANGE_SETTLEMENT = "EXCHANGE_SETTLEMENT"


class SettlementCycle(str, Enum):
    INSTANT = "INSTANT"        # Option A: Immediate cash settlement for paper trading
    T_PLUS_ONE = "T_PLUS_ONE"  # Option B: Rolling T+1 delivery settlement
