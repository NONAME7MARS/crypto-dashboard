import os, sqlite_utils, requests, math, time
from telegram import Bot

DB_PATH = os.getenv("DB_PATH", "prices.db")
THRESH  = 5.0                     # %

def main():
    db = sqlite_utils.Database(DB_PATH, read_only=True)
    rows = db.query("""
       WITH latest AS (
         SELECT symbol, price,
                ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY dt DESC) AS rn
         FROM prices
       )
       SELECT l1.symbol, l1.price AS now, l2.price AS prev
       FROM latest l1 JOIN latest l2
       ON l1.symbol = l2.symbol AND l1.rn = 1 AND l2.rn = 25  -- ~24 h ago
    """)
    alerts = []
    for r in rows:
        diff = (r["now"] - r["prev"]) / r["prev"] * 100
        if abs(diff) >= THRESH:
            alerts.append(f"⚠️ {r['symbol']} {diff:+.2f}% in 24 h")

    if alerts:
        bot = Bot(os.getenv("TG_TOKEN"))
        bot.send_message(chat_id=os.getenv("TG_CHAT"), text="\n".join(alerts))

if __name__ == "__main__":
    main()
