import asyncio
import json
import logging
from typing import Dict, List, Optional, Set
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WebSocketConnectionManager:
    """
    Manages active WebSocket connections for accounts and real-time market subscriptions.
    """

    def __init__(self):
        # account_id -> set of active WebSockets
        self._account_connections: Dict[str, Set[WebSocket]] = {}
        # websocket -> set of subscribed symbols
        self._market_subscriptions: Dict[WebSocket, Set[str]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, account_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            if account_id not in self._account_connections:
                self._account_connections[account_id] = set()
            self._account_connections[account_id].add(websocket)
            self._market_subscriptions[websocket] = set()
        logger.debug(f"WebSocket client connected for account '{account_id}'.")

    async def disconnect(self, account_id: str, websocket: WebSocket) -> None:
        async with self._lock:
            if account_id in self._account_connections:
                self._account_connections[account_id].discard(websocket)
                if not self._account_connections[account_id]:
                    del self._account_connections[account_id]
            if websocket in self._market_subscriptions:
                del self._market_subscriptions[websocket]
        logger.debug(f"WebSocket client disconnected for account '{account_id}'.")

    def subscribe_market(self, websocket: WebSocket, symbols: List[str]) -> None:
        if websocket in self._market_subscriptions:
            for s in symbols:
                self._market_subscriptions[websocket].add(s.upper())

    def unsubscribe_market(self, websocket: WebSocket, symbols: List[str]) -> None:
        if websocket in self._market_subscriptions:
            for s in symbols:
                self._market_subscriptions[websocket].discard(s.upper())

    async def send_personal_message(self, message: dict, websocket: WebSocket) -> None:
        try:
            await websocket.send_text(json.dumps(message))
        except Exception as e:
            logger.warning(f"Failed to send personal WebSocket message: {e}")

    async def broadcast_to_account(self, account_id: str, message: dict) -> None:
        """Broadcasts event payload to all active websockets for a specific account."""
        sockets = list(self._account_connections.get(account_id, set()))
        if not sockets:
            return
        payload = json.dumps(message)
        for ws in sockets:
            try:
                await ws.send_text(payload)
            except Exception as e:
                logger.warning(f"Error broadcasting to account '{account_id}': {e}")

    async def broadcast_tick(self, symbol: str, message: dict) -> None:
        """Broadcasts tick update to clients subscribed to this symbol (or all if none subscribed)."""
        sym = symbol.upper()
        payload = json.dumps(message)
        async with self._lock:
            all_sockets = list(self._market_subscriptions.keys())

        for ws in all_sockets:
            subs = self._market_subscriptions.get(ws, set())
            # If user specified symbols, only send matching; if none specified, broadcast ticks
            if not subs or sym in subs:
                try:
                    await ws.send_text(payload)
                except Exception:
                    pass

    async def broadcast_all(self, message: dict) -> None:
        """Broadcasts message to every connected client across all accounts."""
        payload = json.dumps(message)
        async with self._lock:
            all_sockets = list(self._market_subscriptions.keys())

        for ws in all_sockets:
            try:
                await ws.send_text(payload)
            except Exception:
                pass


ws_manager = WebSocketConnectionManager()
