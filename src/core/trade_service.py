from decimal import Decimal
from typing import Optional, List, Dict
import uuid
from pydantic import BaseModel

from src.common.types import Side, ProductType, OrderStatus
from src.common.money import to_money
from src.common.exceptions import InvalidOrderError, OrderNotFoundError
from src.core.models import Order, TradeEvent, MatchResult
from src.core.matching_engine import DeterministicMatchingEngine
from src.risk.engine import PreTradeRiskEngine, AccountRiskState
from src.ledger.charges import IndianRegulatoryChargesCalculator, TradeCharges
from src.ledger.journal import ImmutableDoubleEntryLedger
from src.portfolio.position_manager import PositionManager
from src.portfolio.models import Position
from src.events.bus import InMemoryEventBus, default_event_bus
from src.events.models import DomainEvent, DomainEventType


class TradeExecutionResult(BaseModel):
    """Summarizes the outcome of an executed order placement."""
    order: Order
    match_result: MatchResult
    trade_charges: List[TradeCharges]
    positions: List[Position]
    account_running_balance: Decimal


class TradeExecutionService:
    """
    Orchestrates the deterministic trading flow:
    Order -> Risk Validation -> Matching Engine -> Charges -> Position & P&L -> Double-Entry Ledger.
    Publishes domain events to the in-memory Event Bus non-blockingly.
    """

    def __init__(
        self,
        matching_engine: Optional[DeterministicMatchingEngine] = None,
        risk_engine: Optional[PreTradeRiskEngine] = None,
        charges_calculator: Optional[IndianRegulatoryChargesCalculator] = None,
        position_manager: Optional[PositionManager] = None,
        ledger: Optional[ImmutableDoubleEntryLedger] = None,
        event_bus: Optional[InMemoryEventBus] = None,
    ):
        self.matching_engine = matching_engine or DeterministicMatchingEngine()
        self.risk_engine = risk_engine or PreTradeRiskEngine()
        self.charges_calculator = charges_calculator or IndianRegulatoryChargesCalculator()
        self.position_manager = position_manager or PositionManager()
        self.ledger = ledger or ImmutableDoubleEntryLedger()
        self.event_bus = event_bus if event_bus is not None else default_event_bus

        self._accounts: Dict[str, AccountRiskState] = {}
        self._orders: Dict[str, Order] = {}
        self._trades: List[TradeEvent] = []

    def reset_state(self) -> None:
        """Simulates clean shutdown or crash by resetting in-memory execution structures."""
        self._accounts.clear()
        self._orders.clear()
        self._trades.clear()
        self.matching_engine = DeterministicMatchingEngine()
        self.risk_engine = PreTradeRiskEngine()
        self.position_manager = PositionManager()
        self.ledger = ImmutableDoubleEntryLedger()

    def _emit(
        self,
        event_type: str,
        entity_type: str,
        entity_id: str,
        account_id: Optional[str],
        payload: Dict,
    ) -> None:
        """Helper to publish events non-blockingly to event bus."""
        if self.event_bus:
            event = DomainEvent(
                event_id=f"EVT_{uuid.uuid4().hex[:12]}",
                event_type=event_type,
                entity_type=entity_type,
                entity_id=entity_id,
                account_id=account_id,
                payload=payload,
            )
            self.event_bus.publish_nowait(event)

    def register_account(self, account_id: str, initial_deposit: Decimal = Decimal("0.00")) -> AccountRiskState:
        """Registers a trading account and records initial cash deposit in ledger."""
        state = AccountRiskState(account_id=account_id)
        self._accounts[account_id] = state
        if initial_deposit > Decimal("0.00"):
            self.ledger.deposit_cash(account_id, initial_deposit, reference_id="INITIAL_FUNDING")
            state.cash_balance = self.ledger.get_running_balance(account_id)
        return state

    def get_account(self, account_id: str) -> AccountRiskState:
        if account_id not in self._accounts:
            return self.register_account(account_id)
        return self._accounts[account_id]

    def get_order(self, order_id: str) -> Optional[Order]:
        return self._orders.get(order_id)

    def get_orders(self, account_id: str, status: Optional[OrderStatus] = None) -> List[Order]:
        orders = [o for o in self._orders.values() if o.account_id == account_id]
        if status is not None:
            orders = [o for o in orders if o.status == status]
        return orders

    def get_trades(self, account_id: str, symbol: Optional[str] = None) -> List[TradeEvent]:
        # Filter trades matching this account
        trades = []
        for t in self._trades:
            # Check if order belongs to account
            order = self._orders.get(t.order_id)
            if order and order.account_id == account_id:
                if symbol is None or t.symbol == symbol.upper():
                    trades.append(t)
        return trades

    def place_order(self, order: Order) -> TradeExecutionResult:
        """
        Executes end-to-end order processing:
        1. Pre-trade risk check & margin blocking.
        2. In-memory order book matching.
        3. Tax & charge deductions down to exact paisa.
        4. Real-time VWAP and P&L updates.
        5. Double-entry ledger updates.
        6. Non-blocking event bus emission.
        """
        account = self.get_account(order.account_id)

        # 1. Pre-trade risk check & margin block
        margin_req = self.risk_engine.block_margin_for_order(account, order)

        # Record in orders registry
        self._orders[order.order_id] = order

        # Emit ORDER_PLACED
        self._emit(
            event_type=DomainEventType.ORDER_PLACED,
            entity_type="ORDER",
            entity_id=order.order_id,
            account_id=account.account_id,
            payload=order.model_dump(mode="json"),
        )

        # 2. Match order against book
        match_result = self.matching_engine.place_order(order)
        taker_order = match_result.taker_order
        self._orders[taker_order.order_id] = taker_order

        collected_charges: List[TradeCharges] = []
        updated_positions: List[Position] = []

        # 3. Process execution fills
        for trade_event in match_result.trade_events:
            self._trades.append(trade_event)

            # We process the taker order leg if it belongs to this account
            if trade_event.order_id == taker_order.order_id:
                trade_charges = self.charges_calculator.calculate_trade_charges(
                    side=trade_event.side,
                    product_type=taker_order.product_type,
                    price=trade_event.price,
                    quantity=trade_event.quantity,
                )
                collected_charges.append(trade_charges)

                # Debit statutory charges from ledger
                self.ledger.record_trade_charges(
                    account_id=account.account_id,
                    trade_id=trade_event.trade_id,
                    charges=trade_charges,
                )

                # Update position & book realized P&L
                pos, realized_pnl = self.position_manager.apply_trade(
                    account_id=account.account_id,
                    product_type=taker_order.product_type,
                    trade_event=trade_event,
                    charges=trade_charges.total_charges,
                )
                updated_positions.append(pos)

                # Product specific financial settlement
                if taker_order.product_type == ProductType.MIS:
                    # Settle Realized P&L into cash ledger
                    if realized_pnl != Decimal("0.00"):
                        self.ledger.record_realized_pnl(
                            account_id=account.account_id,
                            trade_id=trade_event.trade_id,
                            realized_pnl=realized_pnl,
                        )

                    # Release pro-rata blocked margin for filled portion
                    self.risk_engine.release_partial_blocked_margin(
                        account=account,
                        order_id=taker_order.order_id,
                        filled_qty=trade_event.quantity,
                        total_order_qty=taker_order.quantity,
                    )

                    # Update position margin requirement for active position
                    if pos.is_open:
                        account.position_margin = to_money(
                            Decimal(abs(pos.quantity)) * pos.average_price * self.risk_engine.margin_calculator.config.mis_margin_rate
                        )
                    else:
                        account.position_margin = Decimal("0.00")

                else:
                    # CNC Delivery Settlement
                    turnover = to_money(trade_event.price * Decimal(trade_event.quantity))
                    self.ledger.record_cnc_settlement(
                        account_id=account.account_id,
                        trade_id=trade_event.trade_id,
                        side=trade_event.side,
                        amount=turnover,
                    )
                    self.risk_engine.release_partial_blocked_margin(
                        account=account,
                        order_id=taker_order.order_id,
                        filled_qty=trade_event.quantity,
                        total_order_qty=taker_order.quantity,
                    )

                # Emit TRADE_EXECUTED
                trade_dict = trade_event.model_dump(mode="json")
                trade_dict["charges"] = float(trade_charges.total_charges)
                self._emit(
                    event_type=DomainEventType.TRADE_EXECUTED,
                    entity_type="TRADE",
                    entity_id=trade_event.trade_id,
                    account_id=account.account_id,
                    payload=trade_dict,
                )

                # Emit POSITION_UPDATED
                self._emit(
                    event_type=DomainEventType.POSITION_UPDATED,
                    entity_type="POSITION",
                    entity_id=f"{pos.account_id}_{pos.symbol}_{pos.product_type.value}",
                    account_id=account.account_id,
                    payload=pos.model_dump(mode="json"),
                )

        # If order was partially filled or IOC cancelled unfilled remainder, release remaining margin
        if taker_order.status == OrderStatus.CANCELLED:
            self.risk_engine.release_margin_for_order(account, taker_order.order_id, taker_order.symbol)

        # Synchronize account balances with ledger running balance
        account.cash_balance = self.ledger.get_running_balance(account.account_id)

        # Emit MARGIN_UTILIZATION_CHANGED
        self._emit(
            event_type=DomainEventType.MARGIN_UTILIZATION_CHANGED,
            entity_type="ACCOUNT",
            entity_id=account.account_id,
            account_id=account.account_id,
            payload={
                "cash_balance": str(account.cash_balance),
                "available_margin": str(account.available_margin),
                "blocked_margin": str(account.blocked_margin),
                "position_margin": str(account.position_margin),
            },
        )

        return TradeExecutionResult(
            order=taker_order,
            match_result=match_result,
            trade_charges=collected_charges,
            positions=updated_positions,
            account_running_balance=account.cash_balance,
        )

    def cancel_order(self, account_id: str, symbol: str, order_id: str) -> Order:
        """Cancels resting order and releases blocked margin."""
        account = self.get_account(account_id)
        order = self._orders.get(order_id)
        if order and order.account_id != account_id:
            raise InvalidOrderError(f"Order '{order_id}' does not belong to account '{account_id}'.")

        cancelled_order = self.matching_engine.cancel_order(symbol, order_id)
        self.risk_engine.release_margin_for_order(account, order_id, symbol)
        self._orders[cancelled_order.order_id] = cancelled_order

        # Synchronize account balances with ledger running balance
        account.cash_balance = self.ledger.get_running_balance(account.account_id)

        # Emit ORDER_CANCELLED
        self._emit(
            event_type=DomainEventType.ORDER_CANCELLED,
            entity_type="ORDER",
            entity_id=cancelled_order.order_id,
            account_id=account.account_id,
            payload=cancelled_order.model_dump(mode="json"),
        )

        # Emit MARGIN_UTILIZATION_CHANGED
        self._emit(
            event_type=DomainEventType.MARGIN_UTILIZATION_CHANGED,
            entity_type="ACCOUNT",
            entity_id=account.account_id,
            account_id=account.account_id,
            payload={
                "cash_balance": str(account.cash_balance),
                "available_margin": str(account.available_margin),
                "blocked_margin": str(account.blocked_margin),
                "position_margin": str(account.position_margin),
            },
        )

        return cancelled_order

    def modify_order(
        self,
        account_id: str,
        symbol: str,
        order_id: str,
        new_quantity: Optional[int] = None,
        new_price: Optional[Decimal] = None,
    ) -> Order:
        """
        Modifies resting order quantity or price.
        Validates risk margin changes and updates matching book.
        """
        account = self.get_account(account_id)
        order = self._orders.get(order_id)
        if not order:
            raise OrderNotFoundError(f"Order '{order_id}' not found.")
        if order.account_id != account_id:
            raise InvalidOrderError(f"Order '{order_id}' does not belong to account '{account_id}'.")
        if not order.is_active:
            raise InvalidOrderError(f"Cannot modify order '{order_id}' in state '{order.status.value}'.")

        # Tentative order copy for risk margin re-calculation
        tentative_order = order.model_copy()
        if new_quantity is not None:
            if new_quantity <= order.filled_qty:
                raise InvalidOrderError(f"New quantity ({new_quantity}) must exceed filled quantity ({order.filled_qty}).")
            tentative_order.quantity = new_quantity
            tentative_order.remaining_qty = new_quantity - order.filled_qty
        if new_price is not None:
            tentative_order.price = to_money(new_price)

        # Release existing blocked margin and attempt to re-block with modified order
        self.risk_engine.release_margin_for_order(account, order_id, symbol)
        try:
            self.risk_engine.block_margin_for_order(account, tentative_order)
        except Exception:
            # Revert to original margin block on error
            self.risk_engine.block_margin_for_order(account, order)
            raise

        modified_order = self.matching_engine.modify_order(
            symbol=symbol,
            order_id=order_id,
            new_quantity=new_quantity,
            new_price=new_price,
        )
        self._orders[modified_order.order_id] = modified_order

        # Emit ORDER_MODIFIED
        self._emit(
            event_type=DomainEventType.ORDER_MODIFIED,
            entity_type="ORDER",
            entity_id=modified_order.order_id,
            account_id=account.account_id,
            payload=modified_order.model_dump(mode="json"),
        )

        # Emit MARGIN_UTILIZATION_CHANGED
        self._emit(
            event_type=DomainEventType.MARGIN_UTILIZATION_CHANGED,
            entity_type="ACCOUNT",
            entity_id=account.account_id,
            account_id=account.account_id,
            payload={
                "cash_balance": str(account.cash_balance),
                "available_margin": str(account.available_margin),
                "blocked_margin": str(account.blocked_margin),
                "position_margin": str(account.position_margin),
            },
        )

        return modified_order
