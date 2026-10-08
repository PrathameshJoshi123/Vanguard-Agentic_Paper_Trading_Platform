import logging
import re
from decimal import Decimal
from typing import Dict, List, Optional

from src.common.money import to_money
from src.common.types import ProductType, Side
from src.core.trade_service import TradeExecutionService
from src.ledger.charges import IndianRegulatoryChargesCalculator
from src.portfolio.models import Position
from src.simulation.models import (
    HypotheticalOrder,
    PriceScenario,
    SimulatedPosition,
    SimulationRequest,
    SimulationResult,
)

logger = logging.getLogger(__name__)


class WhatIfSimulationEngine:
    """
    In-memory What-If Simulation Engine adhering to plan.txt Section 11 & 31.
    Clones current active portfolio positions, applies hypothetical price shifts or trades,
    and runs the exact deterministic MTM and margin mathematics without modifying live engine state.
    """

    def __init__(
        self,
        trade_service: TradeExecutionService,
        charges_calculator: Optional[IndianRegulatoryChargesCalculator] = None,
    ):
        self.trade_service = trade_service
        self.charges_calculator = charges_calculator or IndianRegulatoryChargesCalculator()

    def simulate(self, request: SimulationRequest) -> SimulationResult:
        """
        Executes a What-If scenario analysis in-memory.
        """
        account_id = request.account_id
        account_state = self.trade_service.get_account(account_id)
        pos_mgr = self.trade_service.position_manager

        # Parse natural language prompt if scenarios are empty
        scenarios = list(request.scenarios)
        if not scenarios and request.natural_language_prompt:
            parsed_scenario = self._parse_prompt(request.natural_language_prompt)
            if parsed_scenario:
                scenarios.append(parsed_scenario)

        # 1. Clone open positions in-memory
        live_positions: List[Position] = [
            p for p in pos_mgr._positions.values()
            if p.account_id == account_id and p.is_open
        ]

        # Scenario price mapping: symbol -> (target_price, pct_change)
        price_adjustments: Dict[str, PriceScenario] = {s.symbol.upper(): s for s in scenarios}

        simulated_positions: List[SimulatedPosition] = []
        current_total_unrealized = Decimal("0.00")
        projected_total_unrealized = Decimal("0.00")
        current_mis_margin = Decimal("0.00")
        projected_mis_margin = Decimal("0.00")

        mis_margin_rate = self.trade_service.risk_engine.margin_calculator.config.mis_margin_rate

        for pos in live_positions:
            symbol = pos.symbol.upper()
            qty = pos.quantity
            avg_price = pos.average_price

            # Current price
            current_price = pos_mgr._latest_prices.get(symbol, avg_price)
            curr_unrealized = pos.unrealized_pnl
            current_total_unrealized += curr_unrealized

            # Margin requirement currently
            if pos.product_type == ProductType.MIS:
                current_mis_margin += to_money(Decimal(abs(qty)) * current_price * mis_margin_rate)

            # Determine simulated price
            scenario = price_adjustments.get(symbol)
            if scenario:
                if scenario.target_price is not None:
                    sim_price = to_money(scenario.target_price)
                    pct_change = to_money(((sim_price - current_price) / current_price) * Decimal("100")) if current_price > 0 else Decimal("0.00")
                elif scenario.price_change_pct is not None:
                    pct_change = to_money(scenario.price_change_pct)
                    sim_price = to_money(current_price * (Decimal("1.00") + (pct_change / Decimal("100.00"))))
                else:
                    sim_price = current_price
                    pct_change = Decimal("0.00")
            else:
                sim_price = current_price
                pct_change = Decimal("0.00")

            # Deterministic MTM calculation under simulated price
            if qty > 0:
                proj_unrealized = to_money(Decimal(qty) * (sim_price - avg_price))
            else:
                proj_unrealized = to_money(Decimal(abs(qty)) * (avg_price - sim_price))

            projected_total_unrealized += proj_unrealized
            pnl_delta = to_money(proj_unrealized - curr_unrealized)

            # Projected margin under simulated price
            if pos.product_type == ProductType.MIS:
                projected_mis_margin += to_money(Decimal(abs(qty)) * sim_price * mis_margin_rate)

            simulated_positions.append(
                SimulatedPosition(
                    symbol=symbol,
                    product_type=pos.product_type,
                    quantity=qty,
                    average_price=avg_price,
                    current_price=current_price,
                    simulated_price=sim_price,
                    price_change_pct=pct_change,
                    current_unrealized_pnl=curr_unrealized,
                    projected_unrealized_pnl=proj_unrealized,
                    pnl_delta=pnl_delta,
                )
            )

        # 2. Simulate Hypothetical Orders (if provided)
        projected_charges = Decimal("0.00")
        for h_order in request.hypothetical_orders:
            order_charges = self.charges_calculator.calculate_trade_charges(
                side=h_order.side,
                product_type=h_order.product_type,
                price=h_order.price,
                quantity=h_order.quantity,
            )
            projected_charges += order_charges.total_charges

            # Additional margin impact if MIS
            if h_order.product_type == ProductType.MIS:
                order_margin = self.trade_service.risk_engine.margin_calculator.calculate_order_margin(
                    product_type=ProductType.MIS,
                    price=h_order.price,
                    quantity=h_order.quantity,
                )
                projected_mis_margin += order_margin

        # Risk Assessment
        cash_balance = account_state.cash_balance
        pnl_delta_total = to_money(projected_total_unrealized - current_total_unrealized)

        risk_assessment = "NORMAL"
        if projected_mis_margin > cash_balance:
            risk_assessment = "MARGIN_CALL_WARNING"
        elif pnl_delta_total < Decimal("-5000.00") or (cash_balance > 0 and (pnl_delta_total / cash_balance) < Decimal("-0.10")):
            risk_assessment = "HIGH_DRAWDOWN"
        elif pnl_delta_total < Decimal("0.00"):
            risk_assessment = "MODERATE_RISK"
        else:
            risk_assessment = "FAVORABLE_PROJECTION"

        narrative = self._generate_narrative(
            account_id=account_id,
            simulated_positions=simulated_positions,
            pnl_delta=pnl_delta_total,
            risk_assessment=risk_assessment,
        )

        return SimulationResult(
            account_id=account_id,
            current_total_unrealized_pnl=to_money(current_total_unrealized),
            projected_total_unrealized_pnl=to_money(projected_total_unrealized),
            projected_pnl_delta=pnl_delta_total,
            current_margin_utilized=to_money(current_mis_margin),
            projected_margin_utilized=to_money(projected_mis_margin),
            available_cash=cash_balance,
            positions=simulated_positions,
            projected_charges=to_money(projected_charges),
            risk_assessment=risk_assessment,
            narrative_summary=narrative,
        )

    def _parse_prompt(self, prompt: str) -> Optional[PriceScenario]:
        """
        Parses queries like:
        - 'What if TCS falls 6%?'
        - 'What happens if RELIANCE drops 8%?'
        - 'If INFY rises 5%'
        """
        pattern = r"(?:what\s+if|if)?\s*([A-Za-z0-9_-]+)\s*(falls|drops|rises|increases|gains|falls\s+by|drops\s+by)\s*(\d+(?:\.\d+)?)\s*%"
        match = re.search(pattern, prompt, re.IGNORECASE)
        if match:
            symbol = match.group(1).upper()
            action = match.group(2).lower()
            pct_val = Decimal(match.group(3))

            if "fall" in action or "drop" in action:
                pct_val = -pct_val

            return PriceScenario(symbol=symbol, price_change_pct=pct_val)
        return None

    def _generate_narrative(
        self,
        account_id: str,
        simulated_positions: List[SimulatedPosition],
        pnl_delta: Decimal,
        risk_assessment: str,
    ) -> str:
        if not simulated_positions:
            return f"No open positions found for account {account_id} to simulate."

        impact_desc = "decrease" if pnl_delta < Decimal("0.00") else "increase"
        lines = [
            f"Under this scenario, your portfolio unrealized P&L is projected to {impact_desc} by ₹{abs(pnl_delta):,.2f}.",
            f"Risk Level: {risk_assessment}.",
        ]
        for p in simulated_positions:
            if p.pnl_delta != Decimal("0.00"):
                p_desc = "loss" if p.pnl_delta < 0 else "gain"
                lines.append(f"- {p.symbol}: Price moves {p.price_change_pct}% to ₹{p.simulated_price}, generating a {p_desc} of ₹{abs(p.pnl_delta):,.2f}.")

        return " ".join(lines)
