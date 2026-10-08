import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from src.api.websocket.manager import ws_manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["WebSocket"])


@router.websocket("/ws/{account_id}")
async def websocket_endpoint(websocket: WebSocket, account_id: str):
    """
    Unified WebSocket endpoint streaming ticks, order executions, and MTM changes.
    """
    await ws_manager.connect(account_id, websocket)
    try:
        # Send initial connected confirmation
        await ws_manager.send_personal_message(
            {
                "type": "CONNECTION_ESTABLISHED",
                "account_id": account_id,
                "message": f"Connected to trading engine event stream for account '{account_id}'.",
            },
            websocket,
        )

        while True:
            data_text = await websocket.receive_text()
            try:
                msg = json.loads(data_text)
                action = msg.get("action")

                if action == "subscribe_market":
                    symbols = msg.get("symbols", [])
                    ws_manager.subscribe_market(websocket, symbols)
                    await ws_manager.send_personal_message(
                        {"type": "SUBSCRIBED_MARKET", "symbols": symbols},
                        websocket,
                    )

                elif action == "unsubscribe_market":
                    symbols = msg.get("symbols", [])
                    ws_manager.unsubscribe_market(websocket, symbols)
                    await ws_manager.send_personal_message(
                        {"type": "UNSUBSCRIBED_MARKET", "symbols": symbols},
                        websocket,
                    )

                elif action == "ping":
                    await ws_manager.send_personal_message(
                        {"action": "pong"},
                        websocket,
                    )

            except json.JSONDecodeError:
                await ws_manager.send_personal_message(
                    {"error": "Invalid JSON format"},
                    websocket,
                )

    except WebSocketDisconnect:
        await ws_manager.disconnect(account_id, websocket)
    except Exception as e:
        logger.warning(f"WebSocket connection exception for '{account_id}': {e}")
        await ws_manager.disconnect(account_id, websocket)
