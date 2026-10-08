from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.storage.database import init_db
from src.events.bus import default_event_bus
from src.events.consumers.ws_broadcaster import WebSocketBroadcasterWorker
from src.events.consumers.persistence import DatabasePersistenceWorker
from src.api.routers import (
    orders_router,
    portfolio_router,
    ledger_router,
    margin_router,
    agent_router,
    simulation_router,
    settlement_router,
    market_router,
    system_router,
)
from src.api.websocket import websocket_router, ws_manager
from src.api.dependencies import get_trade_service, get_market_gateway
from src.agentic.monitor.event_monitor import AutonomousEventMonitor
from src.settlement.mis_squareoff import MISSquareOffManager
from src.scheduler.service import TradingSchedulerService


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize database and start event background workers
    await init_db()

    trade_service = get_trade_service()
    market_gateway = get_market_gateway()
    ws_worker = WebSocketBroadcasterWorker(event_bus=default_event_bus, manager=ws_manager)
    db_worker = DatabasePersistenceWorker(event_bus=default_event_bus)
    monitor_worker = AutonomousEventMonitor(
        event_bus=default_event_bus,
        position_manager=trade_service.position_manager,
    )
    square_off_mgr = MISSquareOffManager(trade_service=trade_service)
    scheduler_service = TradingSchedulerService(square_off_manager=square_off_mgr)

    await ws_worker.start()
    await db_worker.start()
    await monitor_worker.start()
    scheduler_service.start()
    await market_gateway.start(["RELIANCE"])

    app.state.monitor_worker = monitor_worker
    app.state.scheduler_service = scheduler_service
    app.state.market_gateway = market_gateway

    yield

    # Shutdown: gracefully stop workers
    await market_gateway.stop()
    scheduler_service.stop()
    await monitor_worker.stop()
    await ws_worker.stop()
    await db_worker.stop()


def create_app() -> FastAPI:
    app = FastAPI(
        title="Agentic Paper Trading Platform API",
        description="Deterministic High-Performance Trading Engine API with Real-Time WebSockets & In-Memory Event Bus",
        version="1.0.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register REST and WebSocket routers
    app.include_router(orders_router)
    app.include_router(portfolio_router)
    app.include_router(ledger_router)
    app.include_router(margin_router)
    app.include_router(websocket_router)
    app.include_router(agent_router)
    app.include_router(simulation_router)
    app.include_router(settlement_router)
    app.include_router(market_router)
    app.include_router(system_router)

    @app.get("/health", tags=["Health"])
    def health_check():
        return {"status": "ok", "mode": "monolith", "version": "1.0.0"}

    return app


app = create_app()
