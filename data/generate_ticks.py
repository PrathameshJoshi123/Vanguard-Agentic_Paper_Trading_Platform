import json
from datetime import datetime, timezone, timedelta

base_price = 2500.00
start_time = datetime(2026, 10, 8, 9, 30, 0, tzinfo=timezone.utc)

ticks = []
for i in range(50):
    # Oscillate and trend down slightly, then bounce: 2500 -> 2492 -> 2505
    if i < 20:
        price = base_price - (i * 0.40)
    elif i < 35:
        price = 2492.00 - ((i - 20) * 0.30)
    else:
        price = 2487.50 + ((i - 35) * 1.20)
    
    price = round(price, 2)
    t = start_time + timedelta(seconds=i * 2)
    
    tick = {
        "symbol": "RELIANCE",
        "ltp": price,
        "bids": [
            {"price": round(price - 0.50, 2), "quantity": 100 + (i * 5)},
            {"price": round(price - 1.00, 2), "quantity": 200 + (i * 5)},
            {"price": round(price - 1.50, 2), "quantity": 300},
            {"price": round(price - 2.00, 2), "quantity": 400},
            {"price": round(price - 2.50, 2), "quantity": 500},
        ],
        "asks": [
            {"price": round(price + 0.50, 2), "quantity": 150 + (i * 5)},
            {"price": round(price + 1.00, 2), "quantity": 250 + (i * 5)},
            {"price": round(price + 1.50, 2), "quantity": 350},
            {"price": round(price + 2.00, 2), "quantity": 450},
            {"price": round(price + 2.50, 2), "quantity": 550},
        ],
        "total_buy_quantity": 15000 + (i * 100),
        "total_sell_quantity": 17000 + (i * 100),
        "volume": 500000 + (i * 10000),
        "timestamp": t.isoformat(),
        "sequence_id": i + 1
    }
    ticks.append(tick)

with open("data/reliance_50_ticks.jsonl", "w", encoding="utf-8") as f:
    for tick in ticks:
        f.write(json.dumps(tick) + "\n")

print(f"Generated {len(ticks)} ticks successfully.")
