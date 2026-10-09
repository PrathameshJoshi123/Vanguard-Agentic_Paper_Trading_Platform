from src.api.routers.orders import router as orders_router
from src.api.routers.portfolio import router as portfolio_router
from src.api.routers.ledger import router as ledger_router
from src.api.routers.margin import router as margin_router
from src.api.routers.agent import router as agent_router
from src.api.routers.simulation import router as simulation_router
from src.api.routers.settlement import router as settlement_router
from src.api.routers.market import router as market_router
from src.api.routers.system import router as system_router
from src.api.routers.zero21_contract import router as zero21_router

__all__ = [
    "orders_router",
    "portfolio_router",
    "ledger_router",
    "margin_router",
    "agent_router",
    "simulation_router",
    "settlement_router",
    "market_router",
    "system_router",
    "zero21_router",
]

