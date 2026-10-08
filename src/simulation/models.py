from decimal import Decimal
from typing import Dict, List, Optional
from pydantic import BaseModel, Field

from src.common.types import ProductType, Side


class PriceScenario(BaseModel):
    """Defines a hypothetical price alteration for a single stock."""
    symbol: str
    price_change_pct: Optional[Decimal] = None  # e.g., Decimal("-6.0") for -6%
    target_price: Optional[Decimal] = None      # e.g., Decimal("2450.00")


class HypotheticalOrder(BaseModel):
    """Defines a hypothetical new order to simulate within the portfolio."""
    symbol: str
    side: Side
    quantity: int
    price: Decimal
    product_type: ProductType = ProductType.CNC


class SimulationRequest(BaseModel):
    """Request payload for POST /api/v1/agent/simulate adhering to plan.txt Section 11."""
    account_id: str
    scenarios: List[PriceScenario] = Field(default_factory=list)
    hypothetical_orders: List[HypotheticalOrder] = Field(default_factory=list)
    natural_language_prompt: Optional[str] = None


class SimulatedPosition(BaseModel):
    """Detailed projection of an individual held position."""
    symbol: str
    product_type: ProductType
    quantity: int
    average_price: Decimal
    current_price: Decimal
    simulated_price: Decimal
    price_change_pct: Decimal
    current_unrealized_pnl: Decimal
    projected_unrealized_pnl: Decimal
    pnl_delta: Decimal


class SimulationResult(BaseModel):
    """Output projection showing simulated P&L, margin utilization, and risk status."""
    account_id: str
    current_total_unrealized_pnl: Decimal
    projected_total_unrealized_pnl: Decimal
    projected_pnl_delta: Decimal
    current_margin_utilized: Decimal
    projected_margin_utilized: Decimal
    available_cash: Decimal
    positions: List[SimulatedPosition]
    projected_charges: Decimal = Decimal("0.00")
    risk_assessment: str
    narrative_summary: str
