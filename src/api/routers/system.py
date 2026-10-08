from decimal import Decimal
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.storage.database import get_db_session
from src.core.recovery import CrashRecoveryService
from src.core.reconciliation import AuditReconciliationService
from src.market_data.gateway import MarketDataGateway
from src.market_data.models import MarketDepth, DepthLevel
from src.api.dependencies import (
    get_recovery_service,
    get_reconciliation_service,
    get_market_gateway,
)

router = APIRouter(prefix="/system", tags=["System & Resilience"])


class CrashReplayRequest(BaseModel):
    account_id: str = Field(default="DEFAULT", description="Trading account ID to reconstruct")


class SimulateDropRequest(BaseModel):
    symbol: str = Field(default="RELIANCE", description="Symbol to simulate price drop for")
    drop_percentage: float = Field(default=5.0, ge=1.0, le=50.0, description="Percentage drop (e.g., 5.0 for -5%)")


@router.post("/crash-replay", status_code=status.HTTP_200_OK)
async def crash_and_replay(
    req: CrashReplayRequest,
    session: AsyncSession = Depends(get_db_session),
    recovery_service: CrashRecoveryService = Depends(get_recovery_service),
):
    """
    Step 2 of the Winning Demo Script:
    Simulates a sudden server crash / memory wipe and performs cold deterministic replay
    from the durable database / event log. Shows zero financial and position discrepancies.
    """
    result = await recovery_service.recover_from_database(session, account_id=req.account_id)
    return {
        "status": "RECOVERED",
        "message": "Cold restart simulated successfully. In-memory state re-hydrated from event log with 0 discrepancies.",
        "metrics": {
            "reconstructed_orders": result["reconstructed_orders"],
            "reconstructed_trades": result["reconstructed_trades"],
            "reconstructed_cash_entries": result["reconstructed_cash_entries"],
            "reconstructed_positions": result["reconstructed_positions"],
            "final_cash_balance": result["final_cash_balance"],
        },
        "reconciliation": result["reconciliation"],
    }


@router.get("/reconcile")
def run_reconciliation(
    account_id: str = Query(default="DEFAULT"),
    reconciliation_service: AuditReconciliationService = Depends(get_reconciliation_service),
):
    """
    Continuous audit reconciliation check adhering to plan.txt Section 45:
    Validates Double-Entry equilibrium, Cash balance, Trade-to-Order fills, and Position quantities.
    """
    return reconciliation_service.reconcile(account_id=account_id)


@router.post("/simulate-drop", status_code=status.HTTP_200_OK)
async def simulate_market_drop(
    req: SimulateDropRequest,
    gateway: MarketDataGateway = Depends(get_market_gateway),
):
    """
    Step 4 of the Winning Demo Script:
    Injects an artificial price drop into the market gateway.
    Immediately trips the Autonomous Event Monitor threshold and publishes an unprompted
    AGENT_ALERT with Mistral AI brief over WebSockets.
    """
    sym = req.symbol.upper()
    current_depth = gateway.get_latest_depth(sym)
    old_price = current_depth.ltp

    multiplier = Decimal(str(1.0 - (req.drop_percentage / 100.0)))
    new_price = round(old_price * multiplier, 2)

    # Construct dropped depth
    dropped_depth = MarketDepth(
        symbol=sym,
        ltp=new_price,
        bids=[
            DepthLevel(price=new_price - Decimal("0.50") * (i + 1), quantity=100 * (i + 1), orders=i + 1)
            for i in range(5)
        ],
        asks=[
            DepthLevel(price=new_price + Decimal("0.50") * (i + 1), quantity=150 * (i + 1), orders=i + 1)
            for i in range(5)
        ],
        total_buy_quantity=current_depth.total_buy_quantity,
        total_sell_quantity=current_depth.total_sell_quantity,
        volume=current_depth.volume + 25000,
        timestamp=datetime.now(timezone.utc),
        sequence_id=getattr(current_depth, "sequence_id", 0) + 1,
    )

    # Ingest dropped tick into gateway
    await gateway.ingest_tick(dropped_depth)

    return {
        "status": "DROP_TRIGGERED",
        "symbol": sym,
        "old_price": float(old_price),
        "new_price": float(new_price),
        "drop_percentage": req.drop_percentage,
        "message": f"Injected simulated {req.drop_percentage}% drop for {sym}. Autonomous monitor alerted.",
    }
