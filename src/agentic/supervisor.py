from typing import Dict, Any
from langchain_core.language_models.chat_models import BaseChatModel
from src.agentic.state import AgentState

class SupervisorRouter:
    """
    Supervisor Node:
    Inspects user intent and decides which specialist worker to activate.
    Routes to:
    - 'research': For symbol news, catalysts, prices.
    - 'portfolio': For portfolio losses, concentration, P&L.
    - 'proposer': For buying, selling, or trade proposals.
    """
    def __init__(self, llm: BaseChatModel):
        self.llm = llm

    async def route(self, state: AgentState) -> Dict[str, Any]:
        query = state["current_query"].lower()
        
        # Determine intent based on keywords
        if any(term in query for term in ["buy", "sell", "place order", "propose order", "shares of"]):
            next_worker = "proposer"
        elif any(term in query for term in ["portfolio", "lost money", "loss", "pnl", "concentration", "loser"]):
            next_worker = "portfolio"
        elif any(term in query for term in ["news", "catalyst", "research", "price", "quote", "reliance", "tcs"]):
            next_worker = "research"
        else:
            # Default fallback
            next_worker = "research"

        return {
            "next_worker": next_worker
        }
