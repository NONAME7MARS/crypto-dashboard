# Crypto-Dashboard 📈
[![CI](https://github.com/NONAME7MARS/crypto-dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/NONAME7MARS/crypto-dashboard/actions/workflows/ci.yml)

Interactive dashboard that

* scrapes top-10 crypto prices hourly (Binance API),
* shows charts, SMA/EMA/volatility,
* generates 24 h price forecasts (Prophet / HWES),
* AI-explains every quiz task (via **AIML API**),
* ⚡ lets you play a *“guess-the-next-candle”* quiz.

Built with **Next 15 / Tailwind / Recharts + Python 3.12**.

---

## Quick start (local)

```bash
git clone https://github.com/<you>/crypto-dashboard.git
cd crypto-dashboard

# 1. install deps
npm i
python -m venv .venv && . .venv/Scripts/activate
pip install -r scraper/requirements.txt

# 2. add secrets
cp .env.example app/.env.local          # and write AIML_API_KEY

# 3. seed DB (72 h history)
python scraper/fetch_prices.py

# 4. dev server
npm --prefix ./app run dev
````

Open [http://localhost:3000](http://localhost:3000)
Quiz lives at [http://localhost:3000/quiz](http://localhost:3000/quiz).

---

## Environment variables

| name               | description                                                 |
| ------------------ | ----------------------------------------------------------- |
| **AIML\_API\_KEY** | secret token for [https://aimlapi.com](https://aimlapi.com) |
| DB\_PATH           | path to `prices.db` (default `./prices.db`)                 |
| PORT               | Next.js port (default **3000**)                             |

Copy `.env.example` → `.env.local` and edit.

---

## Scripts

| command                          | runs…                 |
| -------------------------------- | --------------------- |
| `npm run dev`                    | Next.js dev server    |
| `npm run build`                  | production build      |
| `npm run lint`                   | ESLint                |
| `python scraper/fetch_prices.py` | fetch 72 h prices     |
| `python ml/train_predict.py`     | refresh 24 h forecast |

---

## Tests & CI

* **Jest / React-Testing-Library** – frontend (`npm run test`)
* **pytest** – scraper / ML (`pytest -q`)
* GitHub Actions: `.github/workflows/ci.yml` – lint + tests\\

---

## Contributing / TODO

* Improve forecasting model (LSTM or Prophet regressors)
* Web-sockets for live price stream
* Deploy on Fly.io with automated cron & alerts

PRs are welcome — feel free to open an issue first!
