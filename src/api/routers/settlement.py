from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status

from src.api.dependencies import get_trade_service
from src.core.trade_service import TradeExecutionService
from src.settlement.mis_squareoff import MISSquareOffManager, MISSquareOffResult

router = APIRouter(prefix="/settlement", tags=["Settlement & MIS"])


def get_square_off_manager(
    trade_service: TradeExecutionService = Depends(get_trade_service),
) -> MISSquareOffManager:
    return MISSquareOffManager(trade_service=trade_service)


@router.post(
    "/mis-squareoff",
    response_model=List[MISSquareOffResult],
    status_code=status.HTTP_200_OK,
    summary="Trigger deterministic MIS square-off",
)
def trigger_mis_squareoff(
    account_id: Optional[str] = Query(None, description="Optional specific account ID to square off"),
    manager: MISSquareOffManager = Depends(get_square_off_manager),
) -> List[MISSquareOffResult]:
    """
    Executes immediate deterministic square-off of open MIS positions.
    """
    if account_id:
        return manager.square_off_account_mis(account_id)
    return manager.square_off_all_mis()
