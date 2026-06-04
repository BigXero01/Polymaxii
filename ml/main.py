"""
Polymaxii ML Service — FastAPI prediction endpoint
Provides enhanced AI predictions using XGBoost + technical indicators
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import numpy as np
import pandas as pd
from predictor import BTCPredictor
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Polymaxii ML Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

predictor = BTCPredictor()

class CandleInput(BaseModel):
    time: int
    open: float
    high: float
    low: float
    close: float
    volume: float

class PredictRequest(BaseModel):
    candles: list[CandleInput]
    symbol: str = "BTCUSDT"

class SignalOutput(BaseModel):
    name: str
    value: float
    signal: str
    score: float
    weight: float

class PredictResponse(BaseModel):
    direction: str
    confidence: float
    entryPrice: float
    targetPrice: float
    stopPrice: float
    signals: list[SignalOutput]
    compositeScore: float
    modelVersion: str = "xgboost-v1"

@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": predictor.is_loaded}

@app.post("/predict", response_model=PredictResponse)
def predict(request: PredictRequest):
    if len(request.candles) < 50:
        raise HTTPException(400, "Need at least 50 candles")

    df = pd.DataFrame([c.dict() for c in request.candles])
    df = df.set_index("time").sort_index()

    result = predictor.predict(df)
    return result

@app.get("/model-info")
def model_info():
    return predictor.get_info()
