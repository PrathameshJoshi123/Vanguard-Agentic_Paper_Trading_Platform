from typing import TypedDict, List, Dict, Any, Optional
from langchain_core.messages import BaseMessage

class AgentState(TypedDict):
    """
    Shared graph state across the Supervisor and Specialist worker nodes.
    """
    messages: List[BaseMessage]
    account_id: str
    current_query: str
    next_worker: Optional[str]
    specialist_data: Dict[str, Any]
    final_response: Optional[str]
