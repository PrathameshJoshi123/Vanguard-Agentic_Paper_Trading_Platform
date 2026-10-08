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
)
from src.api.websocket import websocket_router, ws_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize database and start event background workers
    await init_db()

    ws_worker = WebSocketBroadcasterWorker(event_bus=default_event_bus, manager=ws_manager)
    db_worker = DatabasePersistenceWorker(event_bus=default_event_bus)

    await ws_worker.start()
    await db_worker.start()

    yield

    # Shutdown: gracefully stop workers
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

    @app.get("/health", tags=["Health"])
    def health_check():
        return {"status": "ok", "mode": "monolith", "version": "1.0.0"}

    return app


app = create_app()
