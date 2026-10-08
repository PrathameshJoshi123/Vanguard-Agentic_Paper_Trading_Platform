from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional
from src.api.dependencies import (
    get_risk_engine,
    get_market_gateway,
    get_position_manager,
    get_ledger,
    get_trade_service,
)
from src.agentic.graph import build_agentic_graph
from src.risk.engine import PreTradeRiskEngine
from src.market_data.gateway import MarketDataGateway
from src.portfolio.position_manager import PositionManager
from src.ledger.journal import ImmutableDoubleEntryLedger
from src.core.trade_service import TradeExecutionService

router = APIRouter(prefix="/agent", tags=["Agentic Intelligence"])

class AgentChatRequest(BaseModel):
    query: Optional[str] = Field(default=None, description="Natural language prompt for the trading agent")
    prompt: Optional[str] = Field(default=None, description="Alias for query")
    account_id: str = Field(default="DEFAULT", description="Trading account ID")

class AgentChatResponse(BaseModel):
    response: str
    agent_routed: str = "research"
    specialist_data: Optional[Dict[str, Any]] = None
    citations: list[Dict[str, Any]] = Field(default_factory=list)
    policy_result: Optional[Dict[str, Any]] = None
    proposed_order: Optional[Dict[str, Any]] = None

@router.post("/chat", response_model=AgentChatResponse)
async def chat_with_agent(
    payload: AgentChatRequest,
    risk_engine: PreTradeRiskEngine = Depends(get_risk_engine),
    trade_service: TradeExecutionService = Depends(get_trade_service),
    market_gateway: MarketDataGateway = Depends(get_market_gateway),
    position_manager: PositionManager = Depends(get_position_manager),
    ledger: ImmutableDoubleEntryLedger = Depends(get_ledger)
):
    """
    Natural Language Chat Endpoint:
    Processes user queries using LangGraph Multi-Agent Supervisor plane.
    Enforces Tool Policy Gateway guardrails on any proposed trades.
    """
    effective_query = (payload.query or payload.prompt or "").strip()
    if not effective_query:
        return AgentChatResponse(
            response="Please provide a query or command for the trading assistant.",
            agent_routed="supervisor"
        )

    graph = build_agentic_graph(
        risk_engine=risk_engine,
        trade_service=trade_service,
        market_gateway=market_gateway,
        position_manager=position_manager,
        ledger=ledger
    )

    initial_state = {
        "messages": [],
        "account_id": payload.account_id,
        "current_query": effective_query,
        "next_worker": None,
        "specialist_data": {},
        "final_response": None
    }

    result = await graph.ainvoke(initial_state)
    specialist_data = result.get("specialist_data", {})

    agent_routed = "research"
    citations = []
    policy_result = None
    proposed_order = None

    if "proposer" in specialist_data:
        agent_routed = "proposer"
        p_info = specialist_data.get("proposer", {})
        policy_result = p_info.get("policy_result")
        if isinstance(policy_result, dict):
            proposed_order = policy_result.get("order_payload")
    elif "portfolio" in specialist_data:
        agent_routed = "portfolio"
    elif "research" in specialist_data:
        agent_routed = "research"
        r_info = specialist_data.get("research", {})
        citations = r_info.get("catalysts", [])

    return AgentChatResponse(
        response=result.get("final_response", "Request processed."),
        agent_routed=agent_routed,
        specialist_data=specialist_data,
        citations=citations,
        policy_result=policy_result,
        proposed_order=proposed_order,
    )


class ExecuteProposedRequest(BaseModel):
    account_id: str = Field(default="DEFAULT")
    symbol: str
    side: str
    quantity: int
    order_type: str = "LIMIT"
    price: Optional[float] = None
    product_type: str = "CNC"


@router.post("/execute-proposed")
def execute_proposed_order(
    req: ExecuteProposedRequest,
):
    from decimal import Decimal
    import uuid
    from src.api.dependencies import get_trade_service
    from src.common.types import Side, OrderType, ProductType
    from src.core.models import Order

    trade_service = get_trade_service()
    domain_order = Order(
        order_id=f"ORD_{uuid.uuid4().hex[:10]}",
        account_id=req.account_id,
        symbol=req.symbol.upper(),
        side=Side(req.side.upper()),
        order_type=OrderType(req.order_type.upper()),
        product_type=ProductType(req.product_type.upper()),
        quantity=req.quantity,
        price=Decimal(str(req.price)) if req.price is not None else None,
    )
    result = trade_service.place_order(domain_order)
    return {
        "status": domain_order.status.value,
        "order_id": domain_order.order_id,
        "symbol": domain_order.symbol,
        "side": domain_order.side.value,
        "filled_qty": domain_order.filled_qty,
        "remaining_qty": domain_order.remaining_qty,
        "average_fill_price": str(domain_order.average_fill_price) if domain_order.average_fill_price else None,
        "trades_count": len(result.match_result.trade_events),
    }
