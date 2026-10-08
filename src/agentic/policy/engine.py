import uuid
from decimal import Decimal
from typing import Optional, Any
from src.agentic.config import agent_settings

from src.agentic.policy.models import OrderProposal, PolicyCheckResult
from src.risk.engine import PreTradeRiskEngine, AccountRiskState
from src.market_data.gateway import MarketDataGateway
from src.core.models import Order
from src.common.types import OrderStatus
from src.common.exceptions import InsufficientMarginError


class AgentPolicyEngine:
    """
    Agent Policy Firewall:
    Enforces strict hard limits on agent-proposed orders:
    1. Max position / order size: <= ₹50,000
    2. Max single loss tolerance: <= ₹2,000 (if SL is specified)
    3. Pre-trade account margin check against actual available balance.
    
    Returns structured confirmation:
    - {status: 'REJECTED', reason: '...'}
    - {status: 'NEEDS_APPROVAL', order_payload: {...}}
    """
    def __init__(
        self,
        risk_engine: Optional[PreTradeRiskEngine] = None,
        trade_service: Optional[Any] = None,
        market_gateway: Optional[MarketDataGateway] = None,
        max_position_size: Optional[Decimal] = None,
        max_single_loss: Optional[Decimal] = None
    ):
        self.risk_engine = risk_engine
        self.trade_service = trade_service
        self.market_gateway = market_gateway
        self.max_position_size = max_position_size or Decimal(str(agent_settings.max_position_size))
        self.max_single_loss = max_single_loss or Decimal(str(agent_settings.max_single_loss))

    def evaluate_proposal(self, proposal: OrderProposal) -> PolicyCheckResult:
        # 1. Resolve Reference Execution Price
        exec_price = proposal.price
        if exec_price is None or exec_price <= Decimal("0"):
            if self.market_gateway:
                quote = self.market_gateway.get_latest_depth(proposal.symbol)
                if quote and quote.ltp > Decimal("0"):
                    exec_price = quote.ltp
            if not exec_price or exec_price <= Decimal("0"):
                # Default mock price if not found
                exec_price = Decimal("2500.00")

        order_value = Decimal(str(proposal.quantity)) * exec_price

        # 2. Hard Limit Check: Max Position / Order Size (₹50,000)
        if order_value > self.max_position_size:
            return PolicyCheckResult(
                status="REJECTED",
                reason=f"Cannot execute: Order value ₹{order_value:.2f} exceeds maximum allowed position size of ₹{self.max_position_size:.2f}. Order rejected."
            )

        # 3. Hard Limit Check: Max Single Loss (₹2,000)
        if proposal.stop_loss_price is not None:
            price_diff = abs(exec_price - proposal.stop_loss_price)
            potential_loss = price_diff * Decimal(str(proposal.quantity))
            if potential_loss > self.max_single_loss:
                return PolicyCheckResult(
                    status="REJECTED",
                    reason=f"Cannot execute: Potential loss ₹{potential_loss:.2f} exceeds maximum allowed single loss of ₹{self.max_single_loss:.2f}. Order rejected."
                )

        # 4. Deterministic Pre-Trade Margin Check
        temp_order = Order(
            order_id=f"sim_prop_{uuid.uuid4().hex[:8]}",
            account_id=proposal.account_id,
            symbol=proposal.symbol,
            side=proposal.side,
            order_type=proposal.order_type,
            product_type=proposal.product_type,
            quantity=proposal.quantity,
            price=exec_price,
            trigger_price=proposal.trigger_price,
            status=OrderStatus.PENDING
        )

        if self.trade_service:
            try:
                acc = self.trade_service.get_account(proposal.account_id)
                self.trade_service.risk_engine.validate_pre_trade(acc, temp_order)
            except InsufficientMarginError:
                return PolicyCheckResult(
                    status="REJECTED",
                    reason="Cannot execute: Order exceeds maximum allowed account margin. Order rejected."
                )
            except Exception as e:
                return PolicyCheckResult(
                    status="REJECTED",
                    reason=f"Cannot execute: Pre-trade check failed ({str(e)}). Order rejected."
                )
        elif self.risk_engine:
            try:
                acc = AccountRiskState(account_id=proposal.account_id)
                self.risk_engine.validate_pre_trade(acc, temp_order)
            except InsufficientMarginError:
                return PolicyCheckResult(
                    status="REJECTED",
                    reason="Cannot execute: Order exceeds maximum allowed account margin. Order rejected."
                )
            except Exception as e:
                return PolicyCheckResult(
                    status="REJECTED",
                    reason=f"Cannot execute: Pre-trade check failed ({str(e)}). Order rejected."
                )


        # 5. Passed all checks -> Return Structured Confirmation Schema
        proposal_id = f"prop_{uuid.uuid4().hex[:8]}"
        payload = {
            "proposal_id": proposal_id,
            "account_id": proposal.account_id,
            "symbol": proposal.symbol,
            "side": proposal.side.value if hasattr(proposal.side, "value") else str(proposal.side),
            "order_type": proposal.order_type.value if hasattr(proposal.order_type, "value") else str(proposal.order_type),
            "product_type": proposal.product_type.value if hasattr(proposal.product_type, "value") else str(proposal.product_type),
            "quantity": proposal.quantity,
            "price": float(exec_price),
            "estimated_order_value": float(order_value),
            "status": "NEEDS_APPROVAL"
        }

        return PolicyCheckResult(
            status="NEEDS_APPROVAL",
            order_payload=payload
        )
