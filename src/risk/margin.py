from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field

from src.common.types import Side, ProductType
from src.common.money import to_money
from src.ledger.charges import IndianRegulatoryChargesCalculator


class MarginConfig(BaseModel):
    """Margin configuration for Indian equities."""
    cnc_margin_rate: Decimal = Decimal("1.00")   # 100% of order value for Delivery
    mis_margin_rate: Decimal = Decimal("0.20")   # 20% margin (5x leverage) for Intraday
    include_estimated_charges: bool = True       # Enforce pre-trade charges buffer


class MarginRequirement(BaseModel):
    """Calculated pre-trade margin requirement."""
    order_value: Decimal
    base_margin: Decimal
    estimated_charges: Decimal
    total_required_margin: Decimal


class MarginCalculator:
    """Calculates upfront margin requirements according to SEBI / NSE rules."""

    def __init__(
        self,
        config: Optional[MarginConfig] = None,
        charges_calculator: Optional[IndianRegulatoryChargesCalculator] = None,
    ):
        self.config = config or MarginConfig()
        self.charges_calculator = charges_calculator or IndianRegulatoryChargesCalculator()

    def calculate_margin(
        self,
        side: Side,
        product_type: ProductType,
        price: Decimal,
        quantity: int,
    ) -> MarginRequirement:
        """
        Calculates required margin for an order:
        - CNC BUY: 100% order value + estimated charges
        - CNC SELL: 0 cash margin required (requires delivery holdings check)
        - MIS BUY / SELL: 20% order value (5x leverage) + estimated charges
        """
        price = to_money(price)
        order_value = to_money(price * Decimal(quantity))

        if product_type == ProductType.CNC:
            if side == Side.BUY:
                base_margin = to_money(order_value * self.config.cnc_margin_rate)
            else:
                # CNC Sell requires shares in demat / holdings, not cash margin
                base_margin = Decimal("0.00")
        else:
            # MIS Buy or Short Sell requires 20% margin
            base_margin = to_money(order_value * self.config.mis_margin_rate)

        estimated_charges = Decimal("0.00")
        if self.config.include_estimated_charges:
            estimated_charges = self.charges_calculator.calculate_estimated_order_charges(
                side=side,
                product_type=product_type,
                price=price,
                quantity=quantity,
            )

        total_required = to_money(base_margin + estimated_charges)

        return MarginRequirement(
            order_value=order_value,
            base_margin=base_margin,
            estimated_charges=estimated_charges,
            total_required_margin=total_required,
        )
