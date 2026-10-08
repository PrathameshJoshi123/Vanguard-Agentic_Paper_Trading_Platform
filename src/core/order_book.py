import heapq
from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Optional, Tuple

from src.common.types import Side, OrderStatus
from src.common.exceptions import OrderNotFoundError, InvalidOrderError
from src.common.money import to_money
from src.core.models import Order


class SymbolOrderBook:
    """In-memory Priority Queue (Heap-based) Order Book for a single instrument/symbol.
    
    Price-Time Priority:
      - Bids: Highest Price first (Price DESC), then earliest timestamp (ASC), then sequence_id (ASC).
      - Asks: Lowest Price first (Price ASC), then earliest timestamp (ASC), then sequence_id (ASC).
    """

    def __init__(self, symbol: str):
        self.symbol = symbol
        self._bids_heap: List[Tuple[Decimal, datetime, int, str]] = []  # (-price, timestamp, seq, order_id)
        self._asks_heap: List[Tuple[Decimal, datetime, int, str]] = []  # (price, timestamp, seq, order_id)
        self._orders: Dict[str, Order] = {}
        self._sequence_counter: int = 0

    def _next_sequence(self) -> int:
        self._sequence_counter += 1
        return self._sequence_counter

    def add_order(self, order: Order) -> None:
        """Adds a resting limit order to the appropriate side of the order book."""
        if order.symbol != self.symbol:
            raise InvalidOrderError(f"Cannot add order for symbol '{order.symbol}' to book for '{self.symbol}'.")
        if order.price is None or order.price <= Decimal("0"):
            raise InvalidOrderError(f"Resting order '{order.order_id}' must have a valid price.")
        if order.remaining_qty <= 0:
            raise InvalidOrderError(f"Cannot add order '{order.order_id}' with zero remaining quantity.")

        seq = self._next_sequence()
        order.sequence_id = seq
        self._orders[order.order_id] = order

        if order.side == Side.BUY:
            # Min-heap on -price gives highest price priority
            entry = (-order.price, order.created_at, seq, order.order_id)
            heapq.heappush(self._bids_heap, entry)
        else:
            # Min-heap on price gives lowest price priority
            entry = (order.price, order.created_at, seq, order.order_id)
            heapq.heappush(self._asks_heap, entry)

    def get_order(self, order_id: str) -> Optional[Order]:
        """Fetches an order by its ID."""
        return self._orders.get(order_id)

    def cancel_order(self, order_id: str) -> Order:
        """Cancels an active resting order (tombstoned for lazy heap pruning)."""
        order = self._orders.get(order_id)
        if not order:
            raise OrderNotFoundError(f"Order '{order_id}' not found in order book '{self.symbol}'.")
        
        if not order.is_active:
            raise InvalidOrderError(f"Cannot cancel order '{order_id}' with status '{order.status.value}'.")
        
        # State machine transition to CANCELLED should happen through the engine,
        # but if called directly on book:
        order.status = OrderStatus.CANCELLED
        order.remaining_qty = 0
        return order

    def modify_order(
        self,
        order_id: str,
        new_quantity: Optional[int] = None,
        new_price: Optional[Decimal] = None,
    ) -> Order:
        """Modifies price and/or quantity of an active resting order."""
        order = self._orders.get(order_id)
        if not order:
            raise OrderNotFoundError(f"Order '{order_id}' not found in order book '{self.symbol}'.")

        if not order.is_active:
            raise InvalidOrderError(f"Cannot modify order '{order_id}' with status '{order.status.value}'.")

        if new_quantity is not None:
            if new_quantity <= order.filled_qty:
                raise InvalidOrderError(f"New quantity ({new_quantity}) must be greater than filled quantity ({order.filled_qty}).")
            order.quantity = new_quantity
            order.remaining_qty = new_quantity - order.filled_qty

        if new_price is not None:
            order.price = to_money(new_price)

        # Reprioritize in heap with new sequence id
        seq = self._next_sequence()
        order.sequence_id = seq

        if order.side == Side.BUY:
            entry = (-order.price, order.created_at, seq, order.order_id)
            heapq.heappush(self._bids_heap, entry)
        else:
            entry = (order.price, order.created_at, seq, order.order_id)
            heapq.heappush(self._asks_heap, entry)

        return order

    def _prune_bids(self) -> None:
        """Lazily prunes non-active / empty / stale orders from the top of the bids heap."""
        while self._bids_heap:
            _, _, seq, order_id = self._bids_heap[0]
            order = self._orders.get(order_id)
            if order is None or not order.is_active or order.remaining_qty <= 0 or order.sequence_id != seq:
                heapq.heappop(self._bids_heap)
            else:
                break

    def _prune_asks(self) -> None:
        """Lazily prunes non-active / empty / stale orders from the top of the asks heap."""
        while self._asks_heap:
            _, _, seq, order_id = self._asks_heap[0]
            order = self._orders.get(order_id)
            if order is None or not order.is_active or order.remaining_qty <= 0 or order.sequence_id != seq:
                heapq.heappop(self._asks_heap)
            else:
                break

    def peek_best_bid(self) -> Optional[Order]:
        """Returns the top of the bid book without removing it."""
        self._prune_bids()
        if not self._bids_heap:
            return None
        return self._orders[self._bids_heap[0][3]]

    def peek_best_ask(self) -> Optional[Order]:
        """Returns the top of the ask book without removing it."""
        self._prune_asks()
        if not self._asks_heap:
            return None
        return self._orders[self._asks_heap[0][3]]

    def pop_best_bid(self) -> Optional[Order]:
        """Pops and returns the best bid order."""
        self._prune_bids()
        if not self._bids_heap:
            return None
        _, _, _, order_id = heapq.heappop(self._bids_heap)
        return self._orders.get(order_id)

    def pop_best_ask(self) -> Optional[Order]:
        """Pops and returns the best ask order."""
        self._prune_asks()
        if not self._asks_heap:
            return None
        _, _, _, order_id = heapq.heappop(self._asks_heap)
        return self._orders.get(order_id)

    @property
    def best_bid_price(self) -> Optional[Decimal]:
        top = self.peek_best_bid()
        return top.price if top else None

    @property
    def best_ask_price(self) -> Optional[Decimal]:
        top = self.peek_best_ask()
        return top.price if top else None

    @property
    def spread(self) -> Optional[Decimal]:
        bid = self.best_bid_price
        ask = self.best_ask_price
        if bid is not None and ask is not None:
            return to_money(ask - bid)
        return None

    def get_market_depth(self, levels: int = 5) -> Dict[str, List[Dict[str, Decimal | int]]]:
        """Generates aggregated L2 market depth (useful for live tick integration and UI)."""
        self._prune_bids()
        self._prune_asks()

        bids_depth: Dict[Decimal, int] = {}
        asks_depth: Dict[Decimal, int] = {}

        # Collect active bids (matching active sequence_id)
        for _, _, seq, order_id in self._bids_heap:
            order = self._orders.get(order_id)
            if order and order.is_active and order.remaining_qty > 0 and order.price is not None and order.sequence_id == seq:
                bids_depth[order.price] = bids_depth.get(order.price, 0) + order.remaining_qty

        # Collect active asks (matching active sequence_id)
        for _, _, seq, order_id in self._asks_heap:
            order = self._orders.get(order_id)
            if order and order.is_active and order.remaining_qty > 0 and order.price is not None and order.sequence_id == seq:
                asks_depth[order.price] = asks_depth.get(order.price, 0) + order.remaining_qty

        sorted_bids = sorted(bids_depth.items(), key=lambda x: x[0], reverse=True)[:levels]
        sorted_asks = sorted(asks_depth.items(), key=lambda x: x[0])[:levels]

        return {
            "bids": [{"price": p, "quantity": q} for p, q in sorted_bids],
            "asks": [{"price": p, "quantity": q} for p, q in sorted_asks],
        }

