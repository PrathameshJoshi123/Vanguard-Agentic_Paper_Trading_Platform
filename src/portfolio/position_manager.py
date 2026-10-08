from decimal import Decimal
from typing import Dict, Tuple, Optional, List

from src.common.types import Side, ProductType
from src.common.money import to_money
from src.core.models import TradeEvent
from src.portfolio.models import Position, Holding, PortfolioSummary


class PositionManager:
    """Manages active positions, computes VWAP, and calculates Realized & Unrealized MTM P&L."""

    def __init__(self):
        # Key: (account_id, symbol, product_type) -> Position
        self._positions: Dict[Tuple[str, str, ProductType], Position] = {}
        # Key: (account_id, symbol) -> Holding
        self._holdings: Dict[Tuple[str, str], Holding] = {}
        # Latest known market prices for MTM calculation: symbol -> LTP
        self._latest_prices: Dict[str, Decimal] = {}

    def get_position(self, account_id: str, symbol: str, product_type: ProductType) -> Position:
        """Retrieves or initializes a position record."""
        key = (account_id, symbol, product_type)
        if key not in self._positions:
            self._positions[key] = Position(
                account_id=account_id,
                symbol=symbol,
                product_type=product_type,
            )
        return self._positions[key]

    def get_holding(self, account_id: str, symbol: str) -> Optional[Holding]:
        return self._holdings.get((account_id, symbol))

    def apply_trade(
        self,
        account_id: str,
        product_type: ProductType,
        trade_event: TradeEvent,
        charges: Decimal = Decimal("0.00"),
    ) -> Tuple[Position, Decimal]:
        """
        Applies an executed trade to the account's position.
        Updates VWAP on position expansion and books Realized P&L on position reduction.
        Returns: (updated_position, realized_pnl_delta)
        """
        pos = self.get_position(account_id, trade_event.symbol, product_type)
        fill_price = to_money(trade_event.price)
        fill_qty = trade_event.quantity
        side = trade_event.side

        realized_pnl_delta = Decimal("0.00")

        if pos.quantity == 0:
            # 1. Opening a brand new position
            pos.quantity = fill_qty if side == Side.BUY else -fill_qty
            pos.average_price = fill_price

        elif pos.quantity > 0:
            # Currently LONG
            if side == Side.BUY:
                # Increasing Long: update VWAP
                new_qty = pos.quantity + fill_qty
                weighted_cost = (Decimal(pos.quantity) * pos.average_price) + (Decimal(fill_qty) * fill_price)
                pos.average_price = to_money(weighted_cost / Decimal(new_qty))
                pos.quantity = new_qty
            else:
                # Selling against Long: partial or complete exit
                if fill_qty <= pos.quantity:
                    # Closing full or part of Long position
                    closed_qty = fill_qty
                    realized_pnl_delta = to_money(Decimal(closed_qty) * (fill_price - pos.average_price))
                    pos.quantity -= fill_qty
                    if pos.quantity == 0:
                        pos.average_price = Decimal("0.00")
                else:
                    # Reversal: Long flipped to Short
                    closed_qty = pos.quantity
                    realized_pnl_delta = to_money(Decimal(closed_qty) * (fill_price - pos.average_price))
                    remaining_short = fill_qty - closed_qty
                    pos.quantity = -remaining_short
                    pos.average_price = fill_price

        else:
            # Currently SHORT (pos.quantity < 0)
            abs_curr_qty = abs(pos.quantity)
            if side == Side.SELL:
                # Increasing Short: update VWAP
                new_abs_qty = abs_curr_qty + fill_qty
                weighted_cost = (Decimal(abs_curr_qty) * pos.average_price) + (Decimal(fill_qty) * fill_price)
                pos.average_price = to_money(weighted_cost / Decimal(new_abs_qty))
                pos.quantity = -new_abs_qty
            else:
                # Buying to cover Short: partial or complete exit
                if fill_qty <= abs_curr_qty:
                    closed_qty = fill_qty
                    realized_pnl_delta = to_money(Decimal(closed_qty) * (pos.average_price - fill_price))
                    pos.quantity += fill_qty
                    if pos.quantity == 0:
                        pos.average_price = Decimal("0.00")
                else:
                    # Reversal: Short flipped to Long
                    closed_qty = abs_curr_qty
                    realized_pnl_delta = to_money(Decimal(closed_qty) * (pos.average_price - fill_price))
                    remaining_long = fill_qty - closed_qty
                    pos.quantity = remaining_long
                    pos.average_price = fill_price

        pos.realized_pnl = to_money(pos.realized_pnl + realized_pnl_delta)
        pos.total_charges = to_money(pos.total_charges + charges)

        # Update MTM unrealized P&L if latest price is known
        if trade_event.symbol in self._latest_prices:
            self._recalculate_mtm(pos, self._latest_prices[trade_event.symbol])
        else:
            # Fallback to trade price
            self._latest_prices[trade_event.symbol] = fill_price
            self._recalculate_mtm(pos, fill_price)

        # If CNC, update delivery holdings
        if product_type == ProductType.CNC:
            self._sync_cnc_holding(account_id, trade_event.symbol, side, fill_qty, fill_price)

        return pos, realized_pnl_delta

    def update_market_price(self, symbol: str, ltp: Decimal) -> None:
        """Updates Last Traded Price (LTP) and recalculates MTM for all active positions in this symbol."""
        ltp = to_money(ltp)
        self._latest_prices[symbol] = ltp
        for pos in self._positions.values():
            if pos.symbol == symbol and pos.is_open:
                self._recalculate_mtm(pos, ltp)

    def _recalculate_mtm(self, pos: Position, ltp: Decimal) -> None:
        """Deterministic MTM calculation."""
        if not pos.is_open:
            pos.unrealized_pnl = Decimal("0.00")
            return

        if pos.is_long:
            pos.unrealized_pnl = to_money(Decimal(pos.quantity) * (ltp - pos.average_price))
        else:
            pos.unrealized_pnl = to_money(Decimal(abs(pos.quantity)) * (pos.average_price - ltp))

    def _sync_cnc_holding(
        self,
        account_id: str,
        symbol: str,
        side: Side,
        quantity: int,
        price: Decimal,
    ) -> None:
        """Maintains delivery holdings for CNC trades."""
        key = (account_id, symbol)
        holding = self._holdings.get(key)
        if side == Side.BUY:
            if holding is None:
                self._holdings[key] = Holding(
                    account_id=account_id,
                    symbol=symbol,
                    quantity=quantity,
                    average_buy_price=price,
                )
            else:
                new_qty = holding.quantity + quantity
                weighted_cost = (Decimal(holding.quantity) * holding.average_buy_price) + (Decimal(quantity) * price)
                holding.average_buy_price = to_money(weighted_cost / Decimal(new_qty))
                holding.quantity = new_qty
        else:
            if holding:
                holding.quantity = max(0, holding.quantity - quantity)

    def get_portfolio_summary(self, account_id: str) -> PortfolioSummary:
        """Aggregates all open and closed positions for an account."""
        positions = [p for p in self._positions.values() if p.account_id == account_id]
        holdings = [h for h in self._holdings.values() if h.account_id == account_id]

        total_realized = sum((p.realized_pnl for p in positions), Decimal("0.00"))
        total_unrealized = sum((p.unrealized_pnl for p in positions), Decimal("0.00"))
        total_charges = sum((p.total_charges for p in positions), Decimal("0.00"))

        gross_pnl = to_money(total_realized + total_unrealized)
        net_pnl = to_money(gross_pnl - total_charges)
        open_count = sum(1 for p in positions if p.is_open)

        return PortfolioSummary(
            account_id=account_id,
            total_realized_pnl=to_money(total_realized),
            total_unrealized_pnl=to_money(total_unrealized),
            total_charges=to_money(total_charges),
            gross_pnl=gross_pnl,
            net_pnl=net_pnl,
            open_positions_count=open_count,
            positions=positions,
            holdings=holdings,
        )
