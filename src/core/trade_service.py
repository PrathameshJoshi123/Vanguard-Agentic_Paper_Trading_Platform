from decimal import Decimal
from typing import Optional, List, Dict
from pydantic import BaseModel

from src.common.types import Side, ProductType, OrderStatus
from src.common.money import to_money
from src.core.models import Order, TradeEvent, MatchResult
from src.core.matching_engine import DeterministicMatchingEngine
from src.risk.engine import PreTradeRiskEngine, AccountRiskState
from src.ledger.charges import IndianRegulatoryChargesCalculator, TradeCharges
from src.ledger.journal import ImmutableDoubleEntryLedger
from src.portfolio.position_manager import PositionManager
from src.portfolio.models import Position


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
    """

    def __init__(
        self,
        matching_engine: Optional[DeterministicMatchingEngine] = None,
        risk_engine: Optional[PreTradeRiskEngine] = None,
        charges_calculator: Optional[IndianRegulatoryChargesCalculator] = None,
        position_manager: Optional[PositionManager] = None,
        ledger: Optional[ImmutableDoubleEntryLedger] = None,
    ):
        self.matching_engine = matching_engine or DeterministicMatchingEngine()
        self.risk_engine = risk_engine or PreTradeRiskEngine()
        self.charges_calculator = charges_calculator or IndianRegulatoryChargesCalculator()
        self.position_manager = position_manager or PositionManager()
        self.ledger = ledger or ImmutableDoubleEntryLedger()
        self._accounts: Dict[str, AccountRiskState] = {}

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

    def place_order(self, order: Order) -> TradeExecutionResult:
        """
        Executes end-to-end order processing:
        1. Pre-trade risk check & margin blocking.
        2. In-memory order book matching.
        3. Tax & charge deductions down to exact paisa.
        4. Real-time VWAP and P&L updates.
        5. Double-entry ledger updates.
        """
        account = self.get_account(order.account_id)

        # 1. Pre-trade risk check & margin block
        margin_req = self.risk_engine.block_margin_for_order(account, order)

        # 2. Match order against book
        match_result = self.matching_engine.place_order(order)
        taker_order = match_result.taker_order

        collected_charges: List[TradeCharges] = []
        updated_positions: List[Position] = []

        # 3. Process execution fills
        for trade_event in match_result.trade_events:
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

        # If order was partially filled or IOC cancelled unfilled remainder, release remaining margin
        if taker_order.status == OrderStatus.CANCELLED:
            self.risk_engine.release_margin_for_order(account, taker_order.order_id, taker_order.symbol)

        # Synchronize account balances with ledger running balance
        account.cash_balance = self.ledger.get_running_balance(account.account_id)

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
        cancelled_order = self.matching_engine.cancel_order(symbol, order_id)
        self.risk_engine.release_margin_for_order(account, order_id, symbol)
        return cancelled_order
