from typing import Optional, Any
from langgraph.graph import StateGraph, END
from src.agentic.state import AgentState
from src.agentic.llm import get_mistral_llm
from src.agentic.supervisor import SupervisorRouter
from src.agentic.synthesizer import ResponseSynthesizer
from src.agentic.agents.research_agent import ResearchAgent
from src.agentic.agents.portfolio_agent import PortfolioAgent
from src.agentic.agents.proposer_agent import ProposerAgent
from src.agentic.tools.read_tools import AgentReadTools
from src.agentic.tools.write_tools import AgentWriteTools
from src.agentic.policy.engine import AgentPolicyEngine
from src.risk.engine import PreTradeRiskEngine
from src.market_data.gateway import MarketDataGateway
from src.portfolio.position_manager import PositionManager
from src.ledger.journal import ImmutableDoubleEntryLedger

def build_agentic_graph(
    risk_engine: Optional[PreTradeRiskEngine] = None,
    trade_service: Optional[Any] = None,
    market_gateway: Optional[MarketDataGateway] = None,
    position_manager: Optional[PositionManager] = None,
    ledger: Optional[ImmutableDoubleEntryLedger] = None
):
    """
    Constructs and compiles the LangGraph StateGraph Supervisor Multi-Agent network:
    
    Supervisor
       ├──> Research Agent ──> Synthesizer ──> END
       ├──> Portfolio Agent ──> Synthesizer ──> END
       └──> Proposer Agent (via Policy Gateway) ──> Synthesizer ──> END
    """
    # 1. Initialize LLM & Tool Gateways
    llm = get_mistral_llm()
    policy_engine = AgentPolicyEngine(
        risk_engine=risk_engine,
        trade_service=trade_service,
        market_gateway=market_gateway,
    )
    write_tools = AgentWriteTools(policy_engine=policy_engine)
    read_tools = AgentReadTools(
        market_gateway=market_gateway,
        position_manager=position_manager,
        ledger=ledger
    )

    # 2. Instantiate Nodes
    supervisor = SupervisorRouter(llm=llm)
    research_agent = ResearchAgent(read_tools=read_tools)
    portfolio_agent = PortfolioAgent(read_tools=read_tools)
    proposer_agent = ProposerAgent(write_tools=write_tools, read_tools=read_tools)
    synthesizer = ResponseSynthesizer(llm=llm)

    # 3. Build Graph
    builder = StateGraph(AgentState)

    # Add Nodes
    builder.add_node("supervisor", supervisor.route)
    builder.add_node("research", research_agent.run)
    builder.add_node("portfolio", portfolio_agent.run)
    builder.add_node("proposer", proposer_agent.run)
    builder.add_node("synthesizer", synthesizer.run)

    # Set Entry Point
    builder.set_entry_point("supervisor")

    # Define Conditional Routing from Supervisor
    builder.add_conditional_edges(
        "supervisor",
        lambda state: state["next_worker"],
        {
            "research": "research",
            "portfolio": "portfolio",
            "proposer": "proposer",
        }
    )

    # Edges from Specialists to Synthesizer
    builder.add_edge("research", "synthesizer")
    builder.add_edge("portfolio", "synthesizer")
    builder.add_edge("proposer", "synthesizer")

    # Edge from Synthesizer to END
    builder.add_edge("synthesizer", END)

    return builder.compile()
