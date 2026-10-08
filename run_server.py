#!/usr/bin/env python3
"""
SYRUS-7 Paper Trading Platform — Live Server Runner
Starts FastAPI with:
  - Real-Time WebSocket Event Stream (/ws/{account_id})
  - Deterministic In-Memory Matching Engine
  - Market Data Gateway (Historical L2 Replay & Live NSE Quotes)
  - Autonomous Event Monitor & Mistral AI Proactive Alerts
  - 15:20 IST Deterministic MIS Square-Off Scheduler
  - Cold Crash Recovery & Double-Entry Audit Engine
"""

import sys
import os
import argparse
import uvicorn

# Configure standard encoding for Windows terminals
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

# Ensure the root directory and src are in Python path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "src")))


def print_banner(host: str, port: int):
    url = f"http://{'localhost' if host in ('0.0.0.0', '127.0.0.1') else host}:{port}"
    ws_url = f"ws://{'localhost' if host in ('0.0.0.0', '127.0.0.1') else host}:{port}/ws/DEFAULT"
    print("\n" + "=" * 78)
    print("      SYRUS-7: PRODUCTION-GRADE AGENTIC PAPER TRADING ENGINE")
    print("=" * 78)
    print(f"  * Status:           ONLINE & RUNNING")
    print(f"  * REST API:         {url}")
    print(f"  * Interactive Docs: {url}/docs")
    print(f"  * ReDoc:            {url}/redoc")
    print(f"  * WebSocket Stream: {ws_url}")
    print("-" * 78)
    print("  * ACTIVE ENGINES & WORKERS:")
    print("    [+] Deterministic Matching Engine (<5ms in RAM)")
    print("    [+] Indian Regulatory Charges Calculator (STT, GST, Stamp, Turnover)")
    print("    [+] Double-Entry Ledger & Zero-Discrepancy Audit Engine")
    print("    [+] Real-Time WebSocket Broadcaster (<50ms latency)")
    print("    [+] Dual-Mode Market Data Gateway (Continuous L2 5-Depth Ticks)")
    print("    [+] Autonomous Event Monitor (LLM Risk Briefs on Market Drops)")
    print("    [+] Trading Scheduler Service (Deterministic 15:20 IST Square-off)")
    print("    [+] Cold Crash Recovery Service (Event Log State Rebuilder)")
    print("-" * 78)
    print("  * INTERACTIVE DEMO ENDPOINTS:")
    print(f"    - Market Depth:     GET  {url}/market/depth/RELIANCE")
    print(f"    - Demo Mode Toggle: POST {url}/market/feed-mode (LIVE vs OFFLINE)")
    print(f"    - Crash & Replay:   POST {url}/system/crash-replay")
    print(f"    - Audit Reconcile:  GET  {url}/system/reconcile")
    print(f"    - Simulate Drop:    POST {url}/system/simulate-drop")
    print(f"    - Copilot Chat:     POST {url}/agent/chat")
    print("=" * 78 + "\n")


def main():
    parser = argparse.ArgumentParser(description="Start SYRUS-7 Paper Trading Platform")
    parser.add_argument("--host", default="0.0.0.0", help="Bind host (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8000, help="Bind port (default: 8000)")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload for development")
    args = parser.parse_args()

    print_banner(args.host, args.port)

    uvicorn.run(
        "src.api.app:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        log_level="info",
    )


if __name__ == "__main__":
    main()
