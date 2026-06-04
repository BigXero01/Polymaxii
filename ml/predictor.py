"""
XGBoost-based BTC price direction predictor
Falls back to rule-based scoring if model not yet trained.
"""
import numpy as np
import pandas as pd
import ta
from pathlib import Path
import logging
import json

try:
    import xgboost as xgb
    XGB_AVAILABLE = True
except ImportError:
    XGB_AVAILABLE = False

logger = logging.getLogger(__name__)
MODEL_PATH = Path(__file__).parent / "model_weights" / "btc_predictor.json"

SIGNAL_WEIGHTS = {
    "RSI": 0.12,
    "MACD": 0.18,
    "EMA_Cross": 0.15,
    "Bollinger": 0.10,
    "Stochastic": 0.10,
    "Williams_R": 0.08,
    "CCI": 0.07,
    "OBV": 0.08,
    "VWAP": 0.07,
    "ATR_Trend": 0.05,
}


class BTCPredictor:
    def __init__(self):
        self.model = None
        self.is_loaded = False
        self._try_load_model()

    def _try_load_model(self):
        if not XGB_AVAILABLE:
            logger.warning("XGBoost not available — using rule-based predictor only")
            return
        if MODEL_PATH.exists():
            try:
                self.model = xgb.XGBClassifier()
                self.model.load_model(str(MODEL_PATH))
                self.is_loaded = True
                logger.info("XGBoost model loaded from %s", MODEL_PATH)
            except Exception as e:
                logger.error("Failed to load model: %s", e)

    def _compute_features(self, df: pd.DataFrame) -> dict:
        close = df["close"]
        high = df["high"]
        low = df["low"]
        volume = df["volume"]

        signals = {}

        # RSI
        rsi = ta.momentum.RSIIndicator(close, window=14).rsi()
        rsi_val = float(rsi.iloc[-1]) if not np.isnan(rsi.iloc[-1]) else 50.0
        if rsi_val < 30: rsi_score = 100.0
        elif rsi_val < 40: rsi_score = 60.0
        elif rsi_val > 70: rsi_score = -100.0
        elif rsi_val > 60: rsi_score = -60.0
        else: rsi_score = (50 - rsi_val) * 2
        signals["RSI"] = {"value": rsi_val, "score": float(np.clip(rsi_score, -100, 100))}

        # MACD
        macd_ind = ta.trend.MACD(close, window_fast=12, window_slow=26, window_sign=9)
        macd_line = macd_ind.macd()
        macd_hist = macd_ind.macd_diff()
        hist_val = float(macd_hist.iloc[-1]) if not np.isnan(macd_hist.iloc[-1]) else 0.0
        hist_prev = float(macd_hist.iloc[-2]) if len(macd_hist) > 1 and not np.isnan(macd_hist.iloc[-2]) else 0.0
        price = float(close.iloc[-1])
        macd_score = float(np.clip((hist_val / price) * 10000, -100, 100))
        if hist_val > hist_prev: macd_score = min(100, macd_score + 15)
        else: macd_score = max(-100, macd_score - 15)
        signals["MACD"] = {"value": hist_val, "score": macd_score}

        # EMA Cross
        ema9 = ta.trend.EMAIndicator(close, window=9).ema_indicator()
        ema21 = ta.trend.EMAIndicator(close, window=21).ema_indicator()
        ema50 = ta.trend.EMAIndicator(close, window=50).ema_indicator()
        e9, e21 = float(ema9.iloc[-1]), float(ema21.iloc[-1])
        e9_prev, e21_prev = float(ema9.iloc[-2]), float(ema21.iloc[-2])
        ema_diff = (e9 - e21) / price * 100
        ema_score = float(np.clip(ema_diff * 20, -100, 100))
        if e9_prev <= e21_prev and e9 > e21: ema_score = 100.0
        if e9_prev >= e21_prev and e9 < e21: ema_score = -100.0
        signals["EMA_Cross"] = {"value": e9, "score": ema_score}

        # Bollinger Bands
        bb = ta.volatility.BollingerBands(close, window=20, window_dev=2)
        bb_high = float(bb.bollinger_hband().iloc[-1])
        bb_low = float(bb.bollinger_lband().iloc[-1])
        bandwidth = bb_high - bb_low
        position = (price - bb_low) / bandwidth if bandwidth > 0 else 0.5
        bb_score = float(np.clip((1 - position) * 200 - 100, -100, 100))
        signals["Bollinger"] = {"value": price, "score": bb_score}

        # Stochastic
        stoch = ta.momentum.StochasticOscillator(high, low, close, window=14, smooth_window=3)
        k = float(stoch.stoch().iloc[-1]) if not np.isnan(stoch.stoch().iloc[-1]) else 50.0
        d = float(stoch.stoch_signal().iloc[-1]) if not np.isnan(stoch.stoch_signal().iloc[-1]) else 50.0
        if k < 20 and d < 20: stoch_score = 90.0
        elif k > 80 and d > 80: stoch_score = -90.0
        elif k > d and k < 50: stoch_score = 40.0
        elif k < d and k > 50: stoch_score = -40.0
        else: stoch_score = (50 - k)
        signals["Stochastic"] = {"value": k, "score": float(stoch_score)}

        # Williams %R
        wr = ta.momentum.WilliamsRIndicator(high, low, close, lbp=14).williams_r()
        wr_val = float(wr.iloc[-1]) if not np.isnan(wr.iloc[-1]) else -50.0
        if wr_val < -80: wr_score = 90.0
        elif wr_val > -20: wr_score = -90.0
        else: wr_score = (-wr_val - 50)
        signals["Williams_R"] = {"value": wr_val, "score": float(np.clip(wr_score, -100, 100))}

        # CCI
        cci = ta.trend.CCIIndicator(high, low, close, window=20).cci()
        cci_val = float(cci.iloc[-1]) if not np.isnan(cci.iloc[-1]) else 0.0
        if cci_val < -100: cci_score = 80.0
        elif cci_val > 100: cci_score = -80.0
        else: cci_score = -cci_val
        signals["CCI"] = {"value": cci_val, "score": float(np.clip(cci_score, -100, 100))}

        # OBV Trend
        obv = ta.volume.OnBalanceVolumeIndicator(close, volume).on_balance_volume()
        obv_ema = obv.ewm(span=20).mean()
        obv_val = float(obv.iloc[-1])
        obv_ema_val = float(obv_ema.iloc[-1])
        obv_diff = (obv_val - obv_ema_val) / (abs(obv_ema_val) + 1) * 100
        obv_score = float(np.clip(obv_diff * 10, -100, 100))
        signals["OBV"] = {"value": obv_score, "score": obv_score}

        # VWAP
        vwap = (close * volume).rolling(20).sum() / volume.rolling(20).sum()
        vwap_val = float(vwap.iloc[-1]) if not np.isnan(vwap.iloc[-1]) else price
        vwap_dev = (price - vwap_val) / vwap_val * 100
        vwap_score = float(np.clip(-vwap_dev * 20, -100, 100))
        signals["VWAP"] = {"value": vwap_val, "score": vwap_score}

        # ATR Trend
        atr = ta.volatility.AverageTrueRange(high, low, close, window=14).average_true_range()
        atr_val = float(atr.iloc[-1]) if not np.isnan(atr.iloc[-1]) else price * 0.005
        signals["ATR_Trend"] = {"value": atr_val, "score": 0.0}

        return signals, atr_val

    def predict(self, df: pd.DataFrame) -> dict:
        signals_data, atr_val = self._compute_features(df)
        price = float(df["close"].iloc[-1])

        # Composite score
        composite = sum(
            signals_data[k]["score"] * SIGNAL_WEIGHTS[k]
            for k in SIGNAL_WEIGHTS
            if k in signals_data
        )

        # ML model augmentation
        if self.model and self.is_loaded:
            try:
                features = np.array([[
                    signals_data.get(k, {}).get("score", 0) / 100.0
                    for k in SIGNAL_WEIGHTS
                ]])
                ml_prob = self.model.predict_proba(features)[0]
                # ml_prob[1] = probability of UP
                ml_score = (ml_prob[1] - 0.5) * 200  # -100 to +100
                composite = composite * 0.6 + ml_score * 0.4
            except Exception as e:
                logger.warning("ML model prediction failed: %s", e)

        confidence = min(95.0, 50 + abs(composite) * 0.45)
        direction = "UP" if composite > 15 else "DOWN" if composite < -15 else "NEUTRAL"

        stop_price = (price - atr_val * 1.5) if direction == "UP" else (price + atr_val * 1.5)
        target_price = (price + atr_val * 2.5) if direction == "UP" else (price - atr_val * 2.5)

        out_signals = []
        for name, weight in SIGNAL_WEIGHTS.items():
            if name not in signals_data:
                continue
            sd = signals_data[name]
            score = sd["score"]
            sig_signal = "BUY" if score > 20 else "SELL" if score < -20 else "NEUTRAL"
            out_signals.append({
                "name": name,
                "value": float(sd["value"]),
                "signal": sig_signal,
                "score": float(score),
                "weight": weight,
            })

        return {
            "direction": direction,
            "confidence": float(confidence),
            "entryPrice": float(price),
            "targetPrice": float(target_price),
            "stopPrice": float(stop_price),
            "signals": out_signals,
            "compositeScore": float(composite),
        }

    def get_info(self) -> dict:
        return {
            "modelLoaded": self.is_loaded,
            "xgbAvailable": XGB_AVAILABLE,
            "modelPath": str(MODEL_PATH),
        }
