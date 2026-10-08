from datetime import datetime, timezone
from decimal import Decimal
from typing import Dict, List, Optional

from src.common.types import Side, OrderType, OrderStatus, TimeInForce
from src.common.exceptions import InvalidOrderError, OrderNotFoundError
from src.common.clock import Clock, default_clock
from src.core.models import Order, TradeEvent, MatchRecord, MatchResult
from src.core.state_machine import OrderStateMachine
from src.core.order_book import SymbolOrderBook


class DeterministicMatchingEngine:
    """Low-latency deterministic in-memory matching engine for equities."""

    def __init__(self, clock: Optional[Clock] = None):
        self.clock = clock or default_clock
        self.state_machine = OrderStateMachine(clock=self.clock)
        self.books: Dict[str, SymbolOrderBook] = {}
        self._trade_counter: int = 0

    def get_or_create_book(self, symbol: str) -> SymbolOrderBook:
        """Retrieves the SymbolOrderBook for the instrument, creating it if absent."""
        if symbol not in self.books:
            self.books[symbol] = SymbolOrderBook(symbol)
        return self.books[symbol]

    def get_book(self, symbol: str) -> SymbolOrderBook:
        return self.get_or_create_book(symbol)

    def _next_trade_id(self) -> str:
        self._trade_counter += 1
        return f"TRD-{self._trade_counter:06d}"

    def place_order(self, order: Order) -> MatchResult:
        """Processes an incoming order deterministically against the order book."""
        if order.status != OrderStatus.PENDING:
            raise InvalidOrderError(f"Cannot place order '{order.order_id}' with status '{order.status.value}'. Must be PENDING.")

        book = self.get_or_create_book(order.symbol)
        result = MatchResult(taker_order=order)

        # Walk opposite book to match
        while order.remaining_qty > 0:
            maker = book.peek_best_ask() if order.side == Side.BUY else book.peek_best_bid()
            if maker is None:
                break  # Opposite book has no resting liquidity

            # Crossing check
            if order.order_type == OrderType.LIMIT:
                if order.side == Side.BUY and maker.price > order.price:
                    break  # Lowest ask exceeds buy limit
                if order.side == Side.SELL and maker.price < order.price:
                    break  # Highest bid is below sell limit

            # Determine execution quantity and price (maker/passive price rules)
            match_qty = min(order.remaining_qty, maker.remaining_qty)
            exec_price = maker.price
            trade_id = self._next_trade_id()
            match_time = self.clock.now()

            # Create individual order leg trade events (Option B)
            maker_event = TradeEvent(
                trade_id=trade_id,
                order_id=maker.order_id,
                symbol=order.symbol,
                side=maker.side,
                price=exec_price,
                quantity=match_qty,
                counterparty_order_id=order.order_id,
                is_maker=True,
                timestamp=match_time,
            )
            taker_event = TradeEvent(
                trade_id=trade_id,
                order_id=order.order_id,
                symbol=order.symbol,
                side=order.side,
                price=exec_price,
                quantity=match_qty,
                counterparty_order_id=maker.order_id,
                is_maker=False,
                timestamp=match_time,
            )

            # Atomic match record
            match_record = MatchRecord(
                match_id=trade_id,
                symbol=order.symbol,
                maker_order_id=maker.order_id,
                taker_order_id=order.order_id,
                price=exec_price,
                quantity=match_qty,
                timestamp=match_time,
                maker_trade_event=maker_event,
                taker_trade_event=taker_event,
            )

            # State transition for Maker
            maker_target = OrderStatus.FILLED if (maker.remaining_qty - match_qty == 0) else OrderStatus.PARTIALLY_FILLED
            self.state_machine.transition(
                maker,
                target_status=maker_target,
                fill_qty=match_qty,
                fill_price=exec_price,
                reason=f"Matched with incoming {order.side.value} order {order.order_id}",
            )

            # State transition for Taker
            taker_target = OrderStatus.FILLED if (order.remaining_qty - match_qty == 0) else OrderStatus.PARTIALLY_FILLED
            self.state_machine.transition(
                order,
                target_status=taker_target,
                fill_qty=match_qty,
                fill_price=exec_price,
                reason=f"Matched with resting {maker.side.value} order {maker.order_id}",
            )

            result.matches.append(match_record)
            result.trade_events.extend([maker_event, taker_event])

        # Post-match processing for remaining taker quantity
        if order.remaining_qty > 0:
            if order.order_type == OrderType.LIMIT:
                if order.time_in_force == TimeInForce.IOC:
                    # IOC limit order cancels unfilled portion
                    target = OrderStatus.CANCELLED
                    self.state_machine.transition(order, target_status=target, reason="IOC order remainder cancelled.")
                else:
                    # Standard DAY Limit order rests on the book
                    if order.status == OrderStatus.PENDING:
                        self.state_machine.transition(order, target_status=OrderStatus.OPEN, reason="Resting on book.")
                    book.add_order(order)
            elif order.order_type == OrderType.MARKET:
                # Option A: Market order fills available depth, cancels remainder (IOC)
                if order.status == OrderStatus.PENDING:
                    # Zero filled due to empty book
                    self.state_machine.transition(order, target_status=OrderStatus.CANCELLED, reason="Market order cancelled due to lack of opposite liquidity.")
                elif order.status == OrderStatus.PARTIALLY_FILLED:
                    self.state_machine.transition(order, target_status=OrderStatus.CANCELLED, reason="Market order remainder cancelled after exhausting top depth.")

        return result

    def cancel_order(self, symbol: str, order_id: str) -> Order:
        """Cancels an active resting order."""
        if symbol not in self.books:
            raise OrderNotFoundError(f"Order book for '{symbol}' does not exist.")
        
        book = self.books[symbol]
        order = book.get_order(order_id)
        if not order:
            raise OrderNotFoundError(f"Order '{order_id}' not found in '{symbol}' book.")

        if not order.is_active:
            raise InvalidOrderError(f"Cannot cancel order '{order_id}' in state '{order.status.value}'.")

        self.state_machine.transition(order, target_status=OrderStatus.CANCELLED, reason="User cancellation request.")
        return order

    def modify_order(
        self,
        symbol: str,
        order_id: str,
        new_quantity: Optional[int] = None,
        new_price: Optional[Decimal] = None,
    ) -> Order:
        """Modifies price and/or quantity of an active resting order."""
        if symbol not in self.books:
            raise OrderNotFoundError(f"Order book for '{symbol}' does not exist.")

        book = self.books[symbol]
        return book.modify_order(order_id=order_id, new_quantity=new_quantity, new_price=new_price)

