from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field

from src.common.types import Side, ProductType
from src.common.money import to_money


class ChargesConfig(BaseModel):
    """Configurable regulatory and brokerage fee parameters (Indian Equity Market)."""
    # Brokerage (Discount broker standard: MIS min(₹20, 0.03%), CNC ₹0)
    mis_brokerage_rate: Decimal = Decimal("0.0003")  # 0.03%
    mis_max_brokerage: Decimal = Decimal("20.00")    # Max ₹20 per executed order
    cnc_brokerage_rate: Decimal = Decimal("0.0000")  # ₹0 for delivery
    cnc_max_brokerage: Decimal = Decimal("0.00")

    # Securities Transaction Tax (STT)
    # CNC: 0.1% on both Buy and Sell
    # MIS: 0.025% on Sell only
    stt_cnc_rate: Decimal = Decimal("0.0010")
    stt_mis_sell_rate: Decimal = Decimal("0.00025")

    # Exchange Turnover Charges (NSE: 0.00297% on turnover)
    exchange_turnover_rate: Decimal = Decimal("0.0000297")

    # SEBI Turnover Fees (₹10 per crore = 0.0001% on turnover)
    sebi_turnover_rate: Decimal = Decimal("0.0000010")

    # Stamp Duty (Levied on BUY side only by Indian States)
    # CNC Buy: 0.015% (₹1500 per crore)
    # MIS Buy: 0.003% (₹300 per crore)
    stamp_duty_cnc_buy_rate: Decimal = Decimal("0.00015")
    stamp_duty_mis_buy_rate: Decimal = Decimal("0.00003")

    # Goods and Services Tax (GST: 18% on Brokerage + Exchange Charges + SEBI Fees)
    gst_rate: Decimal = Decimal("0.18")


class TradeCharges(BaseModel):
    """Itemized breakdown of taxes and charges for a single trade leg."""
    turnover: Decimal
    brokerage: Decimal
    stt: Decimal
    exchange_turnover_charge: Decimal
    sebi_turnover_charge: Decimal
    stamp_duty: Decimal
    gst: Decimal
    total_charges: Decimal


class IndianRegulatoryChargesCalculator:
    """Pure deterministic calculator for Indian equity market regulatory charges and brokerage."""

    def __init__(self, config: Optional[ChargesConfig] = None):
        self.config = config or ChargesConfig()

    def calculate_trade_charges(
        self,
        side: Side,
        product_type: ProductType,
        price: Decimal,
        quantity: int,
    ) -> TradeCharges:
        """
        Calculates all Indian statutory taxes and charges for a trade leg down to exact paise.
        """
        turnover = to_money(price * Decimal(quantity))

        # 1. Brokerage
        if product_type == ProductType.MIS:
            raw_brokerage = turnover * self.config.mis_brokerage_rate
            brokerage = to_money(min(raw_brokerage, self.config.mis_max_brokerage))
        else:
            raw_brokerage = turnover * self.config.cnc_brokerage_rate
            brokerage = to_money(min(raw_brokerage, self.config.cnc_max_brokerage))

        # 2. STT (Securities Transaction Tax)
        if product_type == ProductType.CNC:
            stt = to_money(turnover * self.config.stt_cnc_rate)
        else:
            if side == Side.SELL:
                stt = to_money(turnover * self.config.stt_mis_sell_rate)
            else:
                stt = Decimal("0.00")

        # 3. Exchange Turnover Charge (NSE)
        exchange_turnover_charge = to_money(turnover * self.config.exchange_turnover_rate)

        # 4. SEBI Turnover Fee
        sebi_turnover_charge = to_money(turnover * self.config.sebi_turnover_rate)

        # 5. Stamp Duty (BUY side only)
        if side == Side.BUY:
            if product_type == ProductType.CNC:
                stamp_duty = to_money(turnover * self.config.stamp_duty_cnc_buy_rate)
            else:
                stamp_duty = to_money(turnover * self.config.stamp_duty_mis_buy_rate)
        else:
            stamp_duty = Decimal("0.00")

        # 6. GST (18% on Brokerage + Exchange Fee + SEBI Fee)
        taxable_services = brokerage + exchange_turnover_charge + sebi_turnover_charge
        gst = to_money(taxable_services * self.config.gst_rate)

        # 7. Total Charges
        total_charges = to_money(
            brokerage
            + stt
            + exchange_turnover_charge
            + sebi_turnover_charge
            + stamp_duty
            + gst
        )

        return TradeCharges(
            turnover=turnover,
            brokerage=brokerage,
            stt=stt,
            exchange_turnover_charge=exchange_turnover_charge,
            sebi_turnover_charge=sebi_turnover_charge,
            stamp_duty=stamp_duty,
            gst=gst,
            total_charges=total_charges,
        )

    def calculate_estimated_order_charges(
        self,
        side: Side,
        product_type: ProductType,
        price: Decimal,
        quantity: int,
    ) -> Decimal:
        """Helper to get estimated total charges for pre-trade margin requirement checks."""
        return self.calculate_trade_charges(side, product_type, price, quantity).total_charges
