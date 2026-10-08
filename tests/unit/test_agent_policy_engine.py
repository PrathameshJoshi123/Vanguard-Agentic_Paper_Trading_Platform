import pytest
from decimal import Decimal
from src.agentic.policy.engine import AgentPolicyEngine
from src.agentic.policy.models import OrderProposal
from src.risk.engine import PreTradeRiskEngine
from src.risk.margin import MarginCalculator
from src.portfolio.position_manager import PositionManager
from src.ledger.journal import ImmutableDoubleEntryLedger
from src.common.types import Side, OrderType, ProductType

def test_policy_engine_max_position_size_rejection():
    # Max size is ₹50,000. Propose 1,000,000 shares of Reliance @ ₹2,500 = ₹2,500,000,000
    policy_engine = AgentPolicyEngine()
    proposal = OrderProposal(
        account_id="ACC_001",
        symbol="RELIANCE",
        side=Side.BUY,
        order_type=OrderType.LIMIT,
        quantity=1000000,
        price=Decimal("2500.00"),
        product_type=ProductType.MIS
    )

    result = policy_engine.evaluate_proposal(proposal)
    assert result.status == "REJECTED"
    assert "exceeds maximum allowed position size" in result.reason
    assert result.order_payload is None

def test_policy_engine_insufficient_margin_rejection():
    # Setup risk engine with account containing ₹10,000 cash balance
    risk_engine = PreTradeRiskEngine()
    policy_engine = AgentPolicyEngine(risk_engine=risk_engine)

    # 100 shares @ ₹450 CNC = ₹45,000 value. Requires ₹45,000 cash upfront, but account risk state free cash is 0
    proposal = OrderProposal(
        account_id="ACC_001",
        symbol="RELIANCE",
        side=Side.BUY,
        order_type=OrderType.LIMIT,
        quantity=100,
        price=Decimal("450.00"),
        product_type=ProductType.CNC
    )

    result = policy_engine.evaluate_proposal(proposal)
    assert result.status == "REJECTED"
    assert "Cannot execute: Order exceeds maximum allowed account margin. Order rejected." == result.reason

def test_policy_engine_valid_order_needs_approval():
    policy_engine = AgentPolicyEngine()

    # 10 shares @ ₹2,500 MIS = ₹25,000 value (<= ₹50,000 limit)
    proposal = OrderProposal(
        account_id="ACC_001",
        symbol="RELIANCE",
        side=Side.BUY,
        order_type=OrderType.LIMIT,
        quantity=10,
        price=Decimal("2500.00"),
        product_type=ProductType.MIS
    )

    result = policy_engine.evaluate_proposal(proposal)
    assert result.status == "NEEDS_APPROVAL"
    assert result.order_payload is not None
    assert result.order_payload["symbol"] == "RELIANCE"
    assert result.order_payload["quantity"] == 10
    assert result.order_payload["status"] == "NEEDS_APPROVAL"

