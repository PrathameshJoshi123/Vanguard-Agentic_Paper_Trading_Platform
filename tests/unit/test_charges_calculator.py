from decimal import Decimal
import pytest

from src.common.types import Side, ProductType
from src.ledger.charges import IndianRegulatoryChargesCalculator, ChargesConfig


def test_mis_buy_charges_calculation():
    """
    Test MIS Buy 100 @ ₹100:
    Turnover = ₹10,000.00
    Brokerage = min(20, 0.03% * 10,000) = ₹3.00
    STT = ₹0.00 (exempt on buy for MIS)
    Exchange Turnover = 0.00297% * 10,000 = ₹0.30
    SEBI Turnover = 0.0001% * 10,000 = ₹0.01
    Stamp Duty = 0.003% * 10,000 = ₹0.30
    GST = 18% * (3.00 + 0.30 + 0.01) = 18% * 3.31 = ₹0.60
    Total Charges = 3.00 + 0.00 + 0.30 + 0.01 + 0.30 + 0.60 = ₹4.21
    """
    calc = IndianRegulatoryChargesCalculator()
    charges = calc.calculate_trade_charges(
        side=Side.BUY,
        product_type=ProductType.MIS,
        price=Decimal("100.00"),
        quantity=100,
    )
    assert charges.turnover == Decimal("10000.00")
    assert charges.brokerage == Decimal("3.00")
    assert charges.stt == Decimal("0.00")
    assert charges.exchange_turnover_charge == Decimal("0.30")
    assert charges.sebi_turnover_charge == Decimal("0.01")
    assert charges.stamp_duty == Decimal("0.30")
    assert charges.gst == Decimal("0.60")
    assert charges.total_charges == Decimal("4.21")


def test_mis_sell_charges_calculation():
    """
    Test MIS Sell 100 @ ₹110:
    Turnover = ₹11,000.00
    Brokerage = min(20, 0.03% * 11,000) = ₹3.30
    STT = 0.025% * 11,000 = ₹2.75
    Exchange Turnover = 0.00297% * 11,000 = ₹0.33
    SEBI Turnover = 0.0001% * 11,000 = ₹0.01
    Stamp Duty = ₹0.00 (exempt on sell)
    GST = 18% * (3.30 + 0.33 + 0.01) = 18% * 3.64 = ₹0.66
    Total Charges = 3.30 + 2.75 + 0.33 + 0.01 + 0.00 + 0.66 = ₹7.05
    """
    calc = IndianRegulatoryChargesCalculator()
    charges = calc.calculate_trade_charges(
        side=Side.SELL,
        product_type=ProductType.MIS,
        price=Decimal("110.00"),
        quantity=100,
    )
    assert charges.turnover == Decimal("11000.00")
    assert charges.brokerage == Decimal("3.30")
    assert charges.stt == Decimal("2.75")
    assert charges.exchange_turnover_charge == Decimal("0.33")
    assert charges.sebi_turnover_charge == Decimal("0.01")
    assert charges.stamp_duty == Decimal("0.00")
    assert charges.gst == Decimal("0.66")
    assert charges.total_charges == Decimal("7.05")


def test_cnc_delivery_charges_calculation():
    """
    Test CNC Buy and Sell:
    Buy 100 @ ₹1,000 = ₹100,000
    Brokerage = ₹0
    STT = 0.1% * 100,000 = ₹100.00
    Exchange Turnover = 0.00297% * 100,000 = ₹2.97
    SEBI Turnover = 0.0001% * 100,000 = ₹0.10
    Stamp Duty = 0.015% * 100,000 = ₹15.00
    GST = 18% * (0 + 2.97 + 0.10) = 18% * 3.07 = ₹0.55
    Total Buy Charges = 100.00 + 2.97 + 0.10 + 15.00 + 0.55 = ₹118.62
    """
    calc = IndianRegulatoryChargesCalculator()
    charges = calc.calculate_trade_charges(
        side=Side.BUY,
        product_type=ProductType.CNC,
        price=Decimal("1000.00"),
        quantity=100,
    )
    assert charges.turnover == Decimal("100000.00")
    assert charges.brokerage == Decimal("0.00")
    assert charges.stt == Decimal("100.00")
    assert charges.exchange_turnover_charge == Decimal("2.97")
    assert charges.sebi_turnover_charge == Decimal("0.10")
    assert charges.stamp_duty == Decimal("15.00")
    assert charges.gst == Decimal("0.55")
    assert charges.total_charges == Decimal("118.62")


def test_brokerage_cap_at_twenty_rupees():
    """Test that MIS brokerage is capped at ₹20 per trade for large orders."""
    calc = IndianRegulatoryChargesCalculator()
    # Turnover = 1,000 * 1,000 = ₹1,000,000 (0.03% would be ₹300, capped at ₹20)
    charges = calc.calculate_trade_charges(
        side=Side.BUY,
        product_type=ProductType.MIS,
        price=Decimal("1000.00"),
        quantity=1000,
    )
    assert charges.brokerage == Decimal("20.00")
