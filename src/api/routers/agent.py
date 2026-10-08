from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional
from src.api.dependencies import (
    get_risk_engine,
    get_market_gateway,
    get_position_manager,
    get_ledger
)
from src.agentic.graph import build_agentic_graph
from src.risk.engine import PreTradeRiskEngine
from src.market_data.gateway import MarketDataGateway
from src.portfolio.position_manager import PositionManager
from src.ledger.journal import ImmutableDoubleEntryLedger

router = APIRouter(prefix="/agent", tags=["Agentic Intelligence"])

class AgentChatRequest(BaseModel):
    query: str = Field(..., description="Natural language prompt for the trading agent")
    account_id: str = Field(default="ACC_001", description="Trading account ID")

class AgentChatResponse(BaseModel):
    response: str
    specialist_data: Optional[Dict[str, Any]] = None

@router.post("/chat", response_model=AgentChatResponse)
async def chat_with_agent(
    payload: AgentChatRequest,
    risk_engine: PreTradeRiskEngine = Depends(get_risk_engine),
    market_gateway: MarketDataGateway = Depends(get_market_gateway),
    position_manager: PositionManager = Depends(get_position_manager),
    ledger: ImmutableDoubleEntryLedger = Depends(get_ledger)
):
    """
    Natural Language Chat Endpoint:
    Processes user queries using LangGraph Multi-Agent Supervisor plane.
    Enforces Tool Policy Gateway guardrails on any proposed trades.
    """
    graph = build_agentic_graph(
        risk_engine=risk_engine,
        market_gateway=market_gateway,
        position_manager=position_manager,
        ledger=ledger
    )

    initial_state = {
        "messages": [],
        "account_id": payload.account_id,
        "current_query": payload.query,
        "next_worker": None,
        "specialist_data": {},
        "final_response": None
    }

    result = await graph.ainvoke(initial_state)

    return AgentChatResponse(
        response=result.get("final_response", "Request processed."),
        specialist_data=result.get("specialist_data", {})
    )
