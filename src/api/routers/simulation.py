from fastapi import APIRouter, Depends, status

from src.api.dependencies import get_trade_service
from src.core.trade_service import TradeExecutionService
from src.simulation.engine import WhatIfSimulationEngine
from src.simulation.models import SimulationRequest, SimulationResult

router = APIRouter(tags=["Simulation & What-If"])


def get_simulation_engine(
    trade_service: TradeExecutionService = Depends(get_trade_service),
) -> WhatIfSimulationEngine:
    return WhatIfSimulationEngine(trade_service=trade_service)


@router.post(
    "/api/v1/agent/simulate",
    response_model=SimulationResult,
    status_code=status.HTTP_200_OK,
    summary="Run in-memory What-If portfolio simulation",
)
@router.post(
    "/agent/simulate",
    response_model=SimulationResult,
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
def simulate_portfolio_scenario(
    request: SimulationRequest,
    engine: WhatIfSimulationEngine = Depends(get_simulation_engine),
) -> SimulationResult:
    """
    Creates an in-memory clone of current positions, alters prices
    (e.g., 'What if TCS falls 6%?'), runs the real margin & MTM math,
    and returns projected P&L and risk metrics.
    """
    return engine.simulate(request)
