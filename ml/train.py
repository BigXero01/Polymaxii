"""
Offline training script for the XGBoost BTC price direction predictor.
Uses historical 15m Binance candles.

Usage:
    python ml/train.py --symbol BTCUSDT --interval 15m --limit 5000
"""
import argparse
import asyncio
import json
from pathlib import Path
import numpy as np
import pandas as pd
import ta
import xgboost as xgb
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import classification_report, accuracy_score
from predictor import BTCPredictor

MODEL_DIR = Path(__file__).parent / "model_weights"
MODEL_DIR.mkdir(exist_ok=True)

async def fetch_candles(symbol: str, interval: str, limit: int) -> pd.DataFrame:
    import httpx
    url = f"https://api.binance.com/api/v3/klines"
    params = {"symbol": symbol, "interval": interval, "limit": limit}
    async with httpx.AsyncClient() as client:
        r = await client.get(url, params=params)
        r.raise_for_status()
        data = r.json()
    df = pd.DataFrame(data, columns=[
        "time", "open", "high", "low", "close", "volume",
        "close_time", "quote_volume", "trades", "taker_buy_vol",
        "taker_buy_quote_vol", "ignore"
    ])
    df = df.astype({
        "time": int, "open": float, "high": float,
        "low": float, "close": float, "volume": float,
    })
    return df.set_index("time")

def build_features(df: pd.DataFrame) -> pd.DataFrame:
    predictor = BTCPredictor()
    feature_rows = []
    target = []

    for i in range(100, len(df) - 1):
        sub = df.iloc[:i+1].copy()
        try:
            signals, _ = predictor._compute_features(sub)
            row = {k: v["score"] / 100.0 for k, v in signals.items()}
            feature_rows.append(row)
            # Label: 1 if next close > current close, else 0
            target.append(1 if df["close"].iloc[i+1] > df["close"].iloc[i] else 0)
        except Exception:
            continue

    X = pd.DataFrame(feature_rows)
    y = np.array(target)
    return X, y

def train(symbol: str, interval: str, limit: int):
    print(f"Fetching {limit} {interval} candles for {symbol}...")
    df = asyncio.run(fetch_candles(symbol, interval, limit))
    print(f"Got {len(df)} candles")

    print("Building features...")
    X, y = build_features(df)
    print(f"Feature matrix: {X.shape}, labels: {y.sum()} UP / {len(y) - y.sum()} DOWN")

    # Time-series cross-validation
    tscv = TimeSeriesSplit(n_splits=5)
    accs = []
    for fold, (train_idx, test_idx) in enumerate(tscv.split(X)):
        X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
        y_train, y_test = y[train_idx], y[test_idx]
        model = xgb.XGBClassifier(
            n_estimators=200, max_depth=4, learning_rate=0.05,
            subsample=0.8, colsample_bytree=0.8,
            use_label_encoder=False, eval_metric="logloss",
            random_state=42,
        )
        model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)
        preds = model.predict(X_test)
        acc = accuracy_score(y_test, preds)
        accs.append(acc)
        print(f"  Fold {fold+1}: {acc:.4f}")

    print(f"CV Accuracy: {np.mean(accs):.4f} ± {np.std(accs):.4f}")

    # Final model on full data
    final_model = xgb.XGBClassifier(
        n_estimators=300, max_depth=4, learning_rate=0.05,
        subsample=0.8, colsample_bytree=0.8,
        use_label_encoder=False, eval_metric="logloss",
        random_state=42,
    )
    final_model.fit(X, y)
    out_path = MODEL_DIR / "btc_predictor.json"
    final_model.save_model(str(out_path))
    print(f"Model saved to {out_path}")
    print(classification_report(y, final_model.predict(X)))

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--symbol", default="BTCUSDT")
    parser.add_argument("--interval", default="15m")
    parser.add_argument("--limit", type=int, default=5000)
    args = parser.parse_args()
    train(args.symbol, args.interval, args.limit)
