from decimal import Decimal
from typing import Dict, Optional
from pydantic import BaseModel, Field

from src.common.types import Side, ProductType
from src.common.money import to_money
from src.common.exceptions import InsufficientMarginError, InsufficientHoldingsError, InvalidOrderError
from src.core.models import Order
from src.risk.margin import MarginCalculator, MarginRequirement


class AccountRiskState(BaseModel):
    """Real-time financial and risk balances for a trading account."""
    account_id: str
    cash_balance: Decimal = Field(default=Decimal("0.00"))
    realized_pnl: Decimal = Field(default=Decimal("0.00"))
    blocked_margin: Decimal = Field(default=Decimal("0.00"))
    position_margin: Decimal = Field(default=Decimal("0.00"))
    holdings: Dict[str, int] = Field(default_factory=dict)         # symbol -> total settled quantity
    blocked_holdings: Dict[str, int] = Field(default_factory=dict) # symbol -> qty locked in pending CNC sells

    @property
    def free_cash(self) -> Decimal:
        """Cash remaining after subtracting blocked margin and position margin."""
        return to_money(self.cash_balance + self.realized_pnl - self.blocked_margin - self.position_margin)

    @property
    def available_margin(self) -> Decimal:
        """SEBI conservative: Realized P&L updates available margin, unrealized MTM does not fund leverage."""
        return max(Decimal("0.00"), self.free_cash)

    def get_free_holding_qty(self, symbol: str) -> int:
        """Available quantity of shares in demat not locked in pending sell orders."""
        total = self.holdings.get(symbol, 0)
        blocked = self.blocked_holdings.get(symbol, 0)
        return max(0, total - blocked)


class PreTradeRiskEngine:
    """Validates orders before placement, manages blocked margin, and enforces SEBI margin rules."""

    def __init__(self, margin_calculator: Optional[MarginCalculator] = None):
        self.margin_calculator = margin_calculator or MarginCalculator()
        # Maps order_id -> blocked MarginRequirement
        self._blocked_order_margins: Dict[str, MarginRequirement] = {}
        # Maps order_id -> blocked holdings quantity (for CNC sell)
        self._blocked_order_holdings: Dict[str, int] = {}

    def validate_pre_trade(self, account: AccountRiskState, order: Order) -> MarginRequirement:
        """
        Performs pre-trade risk checks:
        1. CNC Sell: Must have sufficient free holdings in demat.
        2. Buy / MIS Sell: Account must have sufficient available margin.
        Raises InsufficientHoldingsError or InsufficientMarginError if checks fail.
        """
        effective_price = order.price if order.price is not None else order.trigger_price
        if effective_price is None or effective_price <= Decimal("0"):
            # Resolve reference price for MARKET / SL_M orders
            # Try to get best opposite book price or fallback reference
            effective_price = Decimal("2500.00")

        margin_req = self.margin_calculator.calculate_margin(
            side=order.side,
            product_type=order.product_type,
            price=effective_price,
            quantity=order.quantity,
        )

        if order.product_type == ProductType.CNC and order.side == Side.SELL:
            free_qty = account.get_free_holding_qty(order.symbol)
            if free_qty < order.quantity:
                raise InsufficientHoldingsError(
                    f"Insufficient holdings for CNC sell of {order.quantity} {order.symbol}. "
                    f"Available free shares: {free_qty}."
                )
        else:
            if account.available_margin < margin_req.total_required_margin:
                raise InsufficientMarginError(
                    f"Insufficient margin for order '{order.order_id}'. "
                    f"Required: ₹{margin_req.total_required_margin}, Available: ₹{account.available_margin}."
                )

        return margin_req

    def block_margin_for_order(
        self,
        account: AccountRiskState,
        order: Order,
    ) -> MarginRequirement:
        """
        Validates order and locks required margin or holdings upon LIMIT order placement.
        """
        if order.order_id in self._blocked_order_margins:
            return self._blocked_order_margins[order.order_id]
        if order.order_id in self._blocked_order_holdings:
            return self.margin_calculator.calculate_margin(
                side=order.side,
                product_type=order.product_type,
                price=order.price or Decimal("2500.00"),
                quantity=order.quantity,
            )

        margin_req = self.validate_pre_trade(account, order)

        if order.product_type == ProductType.CNC and order.side == Side.SELL:
            # Lock holdings
            account.blocked_holdings[order.symbol] = (
                account.blocked_holdings.get(order.symbol, 0) + order.quantity
            )
            self._blocked_order_holdings[order.order_id] = order.quantity
        else:
            # Lock cash margin
            account.blocked_margin = to_money(account.blocked_margin + margin_req.total_required_margin)
            self._blocked_order_margins[order.order_id] = margin_req

        return margin_req

    def release_margin_for_order(
        self,
        account: AccountRiskState,
        order_id: str,
        symbol: str,
    ) -> Decimal:
        """
        Releases blocked margin or holdings when an order is cancelled or rejected.
        Returns amount of cash margin released.
        """
        released_cash = Decimal("0.00")
        if order_id in self._blocked_order_margins:
            margin_req = self._blocked_order_margins.pop(order_id)
            account.blocked_margin = to_money(
                max(Decimal("0.00"), account.blocked_margin - margin_req.total_required_margin)
            )
            released_cash = margin_req.total_required_margin

        if order_id in self._blocked_order_holdings:
            qty = self._blocked_order_holdings.pop(order_id)
            current_blocked = account.blocked_holdings.get(symbol, 0)
            account.blocked_holdings[symbol] = max(0, current_blocked - qty)

        return released_cash

    def release_partial_blocked_margin(
        self,
        account: AccountRiskState,
        order_id: str,
        filled_qty: int,
        total_order_qty: int,
    ) -> Decimal:
        """
        Releases pro-rata blocked margin when an order fills (to be replaced by position margin / settlement).
        """
        if order_id not in self._blocked_order_margins or total_order_qty == 0:
            return Decimal("0.00")

        margin_req = self._blocked_order_margins[order_id]
        portion = Decimal(filled_qty) / Decimal(total_order_qty)
        released_amt = to_money(margin_req.total_required_margin * portion)

        account.blocked_margin = to_money(max(Decimal("0.00"), account.blocked_margin - released_amt))
        # Reduce stored requirement for remainder
        margin_req.total_required_margin = to_money(
            max(Decimal("0.00"), margin_req.total_required_margin - released_amt)
        )
        if margin_req.total_required_margin == Decimal("0.00"):
            self._blocked_order_margins.pop(order_id, None)

        return released_amt
