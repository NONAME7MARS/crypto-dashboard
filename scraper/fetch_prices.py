import os
import time
import requests
import sqlite_utils

# ── настройки ────────────────────────────────────────────────────────────────
DB_PATH = os.getenv("DB_PATH", "../prices.db")      # путь к БД
HOURS   = 72                                        # сколько часов истории
PAIRS   = {
    "BTC":  "BTCUSDT",
    "ETH":  "ETHUSDT",
    "BNB":  "BNBUSDT",
    "SOL":  "SOLUSDT",
    "XRP":  "XRPUSDT",
    "DOGE": "DOGEUSDT",
    "TRX":  "TRXUSDT",
    "USDC": "USDCUSDT",
    # stETH / USDT берём отдельно или пропускаем
}


# ── загрузка часовых свечей из Binance ───────────────────────────────────────
def candles(pair: str, hours: int):
    """Возвращает список словарей: symbol, name, price, dt"""
    url = (
        "https://api.binance.com/api/v3/klines"
        f"?symbol={pair}&interval=1h&limit={hours}"
    )
    data = requests.get(url, timeout=15).json()

    # Если Binance вернул объект-ошибку {"code": …}, пропускаем пару
    if isinstance(data, dict):
        print(f"⚠️  {pair} → {data.get('msg', 'error')}")
        return []

    ticker = pair[:-4].upper()         # BTC из BTCUSDT
    rows = []
    for c in data:
        price = float(c[4])            # close
        if price <= 0:                 # отфильтровать мусор
            continue
        rows.append(
            {
                "symbol": ticker,
                "name":   ticker,
                "price":  price,
                "dt":     int(c[0] / 1000),  # open-time в секундах
            }
        )
    return rows


# ── основной поток ───────────────────────────────────────────────────────────
def main():
    db = sqlite_utils.Database(DB_PATH)

    if "prices" not in db.table_names():
        db["prices"].create(
            {"symbol": str, "name": str, "price": float, "dt": int},
            pk=("symbol", "dt"),
            if_not_exists=True,
        )

    rows = []
    for pair in PAIRS.values():
        rows += candles(pair, HOURS)
        time.sleep(0.2)                # 5 req/сек << 1200/мин лимита

    # добавляем фиктивную точку для USDT = 1.0 USD
    rows.append(
        {
            "symbol": "USDT",
            "name":   "USDT",
            "price":  1.0,
            "dt":     int(time.time()),
        }
    )

    db["prices"].insert_all(rows, ignore=True)
    print(f"Inserted {len(rows)} rows — OK")


if __name__ == "__main__":
    main()
