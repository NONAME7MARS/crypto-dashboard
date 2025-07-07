# ml/train_predict.py
import os, time, sqlite_utils, pandas as pd, numpy as np
from tqdm import tqdm
from statsmodels.tsa.holtwinters import ExponentialSmoothing as HWES   # ① всегда есть

DB_PATH = os.getenv("DB_PATH", "prices.db")
HORIZON = 24
DB      = sqlite_utils.Database(DB_PATH)

try:
    from prophet import Prophet
    HAS_PROPHET = True
except ModuleNotFoundError:
    HAS_PROPHET = False

# ── utils ----------------------------------------------------------
def load_series(sym:str)->pd.Series:
    rows = DB.query("SELECT dt, price FROM prices WHERE symbol=? ORDER BY dt",[sym])
    if not rows: return pd.Series(dtype=float)
    df = (pd.DataFrame(rows)
            .assign(ts=lambda d: pd.to_datetime(d.dt,unit="s"))
            .set_index("ts"))
    return df["price"].asfreq("1h").ffill()

# ── Prophet forecast ----------------------------------------------
import numpy as np

def prophet_fc(s: pd.Series) -> pd.DataFrame:

    # логарифмируем для стабильности и >0
    df = (s.apply(np.log)
            .reset_index()
            .rename(columns={"ts": "ds", "price": "y"}))

    model = Prophet(
        growth="logistic",                # логистический рост
        changepoint_prior_scale=0.1,      # меньше дерганья
        n_changepoints=min(25, len(df)//2),
        weekly_seasonality=True,
        daily_seasonality=False,
    )

    # задаём cap / floor в тех же лог-единицах
    cap  = np.log(s.max() * 2)            # максимум ×2
    base = np.log(max(s.min(), 0.5))      # не даём упасть ниже $0.5
    df["cap"] = cap
    df["floor"] = base
    model.fit(df)

    future = model.make_future_dataframe(
        periods=HORIZON, freq="h", include_history=False
    )
    future["cap"] = cap
    future["floor"] = base
    fc = model.predict(future)

    # переводим обратно из log-price
    y = np.exp(fc["yhat"]).clip(lower=0.01)
    return pd.DataFrame({"t": fc["ds"].astype("int64") // 10**9,
                         "p": np.round(y, 4)})

# ── Holt-Winters fallback -----------------------------------------
def hwes_fc(s:pd.Series)->pd.DataFrame:
    m = HWES(s, trend="add", seasonal=None, initialization_method="estimated").fit()
    fc = m.forecast(HORIZON)
    return pd.DataFrame({"t":fc.index.astype("int64")//10**9,
                         "p":np.round(fc.values,4)})

# ── main -----------------------------------------------------------
def main():
    if "predict" not in DB.table_names():
        DB["predict"].create({"symbol":str,"t":int,"p":float},
                             pk=("symbol","t"), if_not_exists=True)
    DB["predict"].delete_where()                         # очистка

    syms = [r["symbol"] for r in DB.query("SELECT DISTINCT symbol FROM prices")]
    for sym in tqdm(syms, desc="forecast"):
        s = load_series(sym)
        if len(s) < 48: continue

        try:
            pred = prophet_fc(s) if HAS_PROPHET else hwes_fc(s)
        except Exception as e:
            print(f"⚠️  {sym}: Prophet err — {e}. HWES fallback.")
            pred = hwes_fc(s)

        DB["predict"].insert_all(
            pred.assign(symbol=sym).to_dict("records"),
            pk=("symbol","t"), replace=True
        )

    print("✓ forecast updated", time.strftime("%F %T"),
          "| model =", "Prophet" if HAS_PROPHET else "Holt-Winters")

if __name__ == "__main__":
    main()
