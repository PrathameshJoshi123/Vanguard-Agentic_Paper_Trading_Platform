from typing import Dict, Any, Optional
from src.agentic.policy.engine import AgentPolicyEngine
from src.agentic.policy.models import OrderProposal

class AgentWriteTools:
    """
    Restricted Write Tools Gateway:
    The agent can only submit proposals to the Policy Engine.
    Direct execution into the matching engine is strictly forbidden.
    """
    def __init__(self, policy_engine: Optional[AgentPolicyEngine] = None):
        self.policy_engine = policy_engine or AgentPolicyEngine()

    async def propose_order(self, proposal: OrderProposal) -> Dict[str, Any]:
        """
        Evaluate order proposal against Policy Engine hard limits & margin check.
        Returns:
        - { "status": "REJECTED", "reason": "..." }
        - { "status": "NEEDS_APPROVAL", "order_payload": { ... } }
        """
        result = self.policy_engine.evaluate_proposal(proposal)
        return result.model_dump()
