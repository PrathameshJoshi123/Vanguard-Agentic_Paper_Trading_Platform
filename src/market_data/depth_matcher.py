from decimal import Decimal
from typing import Dict, List, Optional
from pydantic import BaseModel

from src.common.types import Side, OrderType, OrderStatus
from src.common.money import to_money
from src.core.models import Order
from src.core.trade_service import TradeExecutionService, TradeExecutionResult
from src.market_data.models import MarketDepth


class TriggeredOrderResult(BaseModel):
    order: Order
    execution_result: Optional[TradeExecutionResult] = None
    trigger_message: str


class MarketDepthMatcher:
    """
    Bridges incoming MarketDepth updates to the Trading Engine:
      1. Evaluates resting Stop-Loss (SL) and Stop-Loss Market (SL-M) orders.
         - Promotes SL to active LIMIT orders resting on the book.
         - Promotes SL-M to MARKET orders and executes them against available depth.
      2. Crosses resting Limit orders against incoming market depth liquidity.
         - If market moves to or past the limit price, fills the resting order against depth.
      3. Walks market orders across L2 depth levels with exact partial fills and slippage.
    """

    def __init__(self, trade_service: TradeExecutionService):
        self.trade_service = trade_service
        # symbol -> list of resting SL / SL-M orders awaiting trigger price
        self._trigger_orders: Dict[str, List[Order]] = {}

    def register_trigger_order(self, order: Order) -> None:
        """Registers an SL or SL-M order in TRIGGER_PENDING state."""
        symbol = order.symbol.upper()
        if symbol not in self._trigger_orders:
            self._trigger_orders[symbol] = []
        
        # Transition order to TRIGGER_PENDING
        if order.status == OrderStatus.PENDING:
            self.trade_service.matching_engine.state_machine.transition(
                order,
                target_status=OrderStatus.TRIGGER_PENDING,
                reason="Resting in trigger monitor awaiting market price.",
            )
        self._trigger_orders[symbol].append(order)

    def get_pending_triggers(self, symbol: str) -> List[Order]:
        return [o for o in self._trigger_orders.get(symbol.upper(), []) if o.status == OrderStatus.TRIGGER_PENDING]

    def on_market_depth(self, depth: MarketDepth) -> List[TriggeredOrderResult]:
        """
        Processes an incoming MarketDepth update:
          1. Evaluates Stop-Loss trigger conditions against LTP.
          2. Fills resting limit orders crossed by the new market depth.
        """
        results: List[TriggeredOrderResult] = []
        symbol = depth.symbol.upper()

        # Step 1: Evaluate Stop-Loss Orders
        results.extend(self._evaluate_stop_loss_triggers(depth))

        # Step 2: Cross resting limit orders against market depth
        results.extend(self._cross_resting_limit_orders(depth))

        return results

    def _evaluate_stop_loss_triggers(self, depth: MarketDepth) -> List[TriggeredOrderResult]:
        """Evaluates pending SL and SL-M orders for the symbol against the latest LTP."""
        symbol = depth.symbol.upper()
        pending = self._trigger_orders.get(symbol, [])
        if not pending:
            return []

        remaining_triggers: List[Order] = []
        triggered_results: List[TriggeredOrderResult] = []

        for order in pending:
            if order.status != OrderStatus.TRIGGER_PENDING:
                continue

            triggered = False
            # Buy SL/SL-M triggers when LTP >= trigger_price
            if order.side == Side.BUY and depth.ltp >= order.trigger_price:
                triggered = True
            # Sell SL/SL-M triggers when LTP <= trigger_price
            elif order.side == Side.SELL and depth.ltp <= order.trigger_price:
                triggered = True

            if triggered:
                if order.order_type == OrderType.SL:
                    # Promotes to active LIMIT order
                    order.status = OrderStatus.PENDING
                    order.order_type = OrderType.LIMIT
                    exec_res = self.trade_service.place_order(order)
                    triggered_results.append(
                        TriggeredOrderResult(
                            order=order,
                            execution_result=exec_res,
                            trigger_message=f"SL order triggered at LTP {depth.ltp}. Converted to LIMIT @ {order.price}.",
                        )
                    )
                elif order.order_type == OrderType.SL_M:
                    # Promotes to MARKET order
                    order.status = OrderStatus.PENDING
                    order.order_type = OrderType.MARKET
                    exec_res = self.trade_service.place_order(order)
                    triggered_results.append(
                        TriggeredOrderResult(
                            order=order,
                            execution_result=exec_res,
                            trigger_message=f"SL-M order triggered at LTP {depth.ltp}. Executed at MARKET.",
                        )
                    )
            else:
                remaining_triggers.append(order)

        self._trigger_orders[symbol] = remaining_triggers
        return triggered_results

    def _cross_resting_limit_orders(self, depth: MarketDepth) -> List[TriggeredOrderResult]:
        """
        Crosses resting limit orders in the in-memory book against incoming external depth.
        If a resting Buy Limit >= best ask, or Sell Limit <= best bid, executes it against depth.
        """
        results: List[TriggeredOrderResult] = []
        symbol = depth.symbol.upper()
        book = self.trade_service.matching_engine.get_or_create_book(symbol)

        # 1. Check resting Buy Limit Orders against Asks
        while depth.asks and book.peek_best_bid():
            best_bid_order = book.peek_best_bid()
            best_ask = depth.asks[0]

            if best_bid_order.price < best_ask.price:
                break  # Market ask is higher than highest resting buy limit

            # Crossing occurred: Market sold down into the resting limit order!
            fill_qty = min(best_bid_order.remaining_qty, best_ask.quantity)
            exec_price = best_bid_order.price  # Limit maker price guaranteed

            # Synthesize external counterparty match
            counterparty_order = Order(
                order_id=f"MKT-ASK-{depth.sequence_id}",
                symbol=symbol,
                side=Side.SELL,
                order_type=OrderType.LIMIT,
                price=exec_price,
                quantity=fill_qty,
                account_id="EXCHANGE_LIQUIDITY",
                status=OrderStatus.PENDING,
            )
            # Execute match through matching engine
            match_res = self.trade_service.matching_engine.place_order(counterparty_order)

            # Apply financial settlement for the resting order through trade service
            for trade_event in match_res.trade_events:
                if trade_event.order_id == best_bid_order.order_id:
                    self._apply_fill_to_trade_service(best_bid_order, trade_event)

            results.append(
                TriggeredOrderResult(
                    order=best_bid_order,
                    trigger_message=f"Resting BUY limit order filled against incoming market depth ask @ {exec_price}.",
                )
            )

            # Consume external depth level
            best_ask.quantity -= fill_qty
            if best_ask.quantity <= 0:
                depth.asks.pop(0)

        # 2. Check resting Sell Limit Orders against Bids
        while depth.bids and book.peek_best_ask():
            best_ask_order = book.peek_best_ask()
            best_bid = depth.bids[0]

            if best_ask_order.price > best_bid.price:
                break  # Market bid is lower than lowest resting sell limit

            # Crossing occurred: Market bought up into the resting sell limit order!
            fill_qty = min(best_ask_order.remaining_qty, best_bid.quantity)
            exec_price = best_ask_order.price

            counterparty_order = Order(
                order_id=f"MKT-BID-{depth.sequence_id}",
                symbol=symbol,
                side=Side.BUY,
                order_type=OrderType.LIMIT,
                price=exec_price,
                quantity=fill_qty,
                account_id="EXCHANGE_LIQUIDITY",
                status=OrderStatus.PENDING,
            )
            match_res = self.trade_service.matching_engine.place_order(counterparty_order)

            for trade_event in match_res.trade_events:
                if trade_event.order_id == best_ask_order.order_id:
                    self._apply_fill_to_trade_service(best_ask_order, trade_event)

            results.append(
                TriggeredOrderResult(
                    order=best_ask_order,
                    trigger_message=f"Resting SELL limit order filled against incoming market depth bid @ {exec_price}.",
                )
            )

            best_bid.quantity -= fill_qty
            if best_bid.quantity <= 0:
                depth.bids.pop(0)

        return results

    def _apply_fill_to_trade_service(self, order: Order, trade_event) -> None:
        """Applies financial updates (charges, positions, ledger) to the filled resting order."""
        account = self.trade_service.get_account(order.account_id)
        trade_charges = self.trade_service.charges_calculator.calculate_trade_charges(
            side=trade_event.side,
            product_type=order.product_type,
            price=trade_event.price,
            quantity=trade_event.quantity,
        )
        self.trade_service.ledger.record_trade_charges(
            account_id=account.account_id,
            trade_id=trade_event.trade_id,
            charges=trade_charges,
        )
        pos, realized_pnl = self.trade_service.position_manager.apply_trade(
            account_id=account.account_id,
            product_type=order.product_type,
            trade_event=trade_event,
            charges=trade_charges.total_charges,
        )
        if realized_pnl != Decimal("0.00"):
            self.trade_service.ledger.record_realized_pnl(
                account_id=account.account_id,
                trade_id=trade_event.trade_id,
                realized_pnl=realized_pnl,
            )
        self.trade_service.risk_engine.release_partial_blocked_margin(
            account=account,
            order_id=order.order_id,
            filled_qty=trade_event.quantity,
            total_order_qty=order.quantity,
        )
        account.cash_balance = self.trade_service.ledger.get_running_balance(account.account_id)
