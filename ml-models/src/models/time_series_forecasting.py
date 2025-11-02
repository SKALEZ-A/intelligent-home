import numpy as np
from typing import List, Tuple, Optional
from collections import deque

class TimeSeriesForecaster:
    def __init__(self, window_size: int = 24, forecast_horizon: int = 12):
        self.window_size = window_size
        self.forecast_horizon = forecast_horizon
        self.weights = None
        self.bias = None
        self.scaler_mean = 0
        self.scaler_std = 1
        
    def normalize(self, data: np.ndarray) -> np.ndarray:
        self.scaler_mean = np.mean(data)
        self.scaler_std = np.std(data)
        if self.scaler_std == 0:
            self.scaler_std = 1
        return (data - self.scaler_mean) / self.scaler_std
    
    def denormalize(self, data: np.ndarray) -> np.ndarray:
        return data * self.scaler_std + self.scaler_mean
    
    def create_sequences(self, data: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        X, y = [], []
        for i in range(len(data) - self.window_size - self.forecast_horizon + 1):
            X.append(data[i:i + self.window_size])
            y.append(data[i + self.window_size:i + self.window_size + self.forecast_horizon])
        return np.array(X), np.array(y)
    
    def train(self, data: List[float], epochs: int = 100, learning_rate: float = 0.001):
        data_array = np.array(data)
        normalized_data = self.normalize(data_array)
        
        X, y = self.create_sequences(normalized_data)
        
        if len(X) == 0:
            raise ValueError("Not enough data to create training sequences")
        
        self.weights = np.random.randn(self.window_size, self.forecast_horizon) * 0.01
        self.bias = np.zeros(self.forecast_horizon)
        
        for epoch in range(epochs):
            total_loss = 0
            
            for i in range(len(X)):
                prediction = np.dot(X[i], self.weights) + self.bias
                error = y[i] - prediction
                loss = np.mean(error ** 2)
                total_loss += loss
                
                self.weights += learning_rate * np.outer(X[i], error)
                self.bias += learning_rate * error
            
            avg_loss = total_loss / len(X)
            if (epoch + 1) % 10 == 0:
                print(f"Epoch {epoch + 1}/{epochs}, Loss: {avg_loss:.6f}")
    
    def forecast(self, recent_data: List[float]) -> List[float]:
        if len(recent_data) < self.window_size:
            raise ValueError(f"Need at least {self.window_size} data points for forecasting")
        
        recent_array = np.array(recent_data[-self.window_size:])
        normalized_recent = (recent_array - self.scaler_mean) / self.scaler_std
        
        prediction = np.dot(normalized_recent, self.weights) + self.bias
        denormalized_prediction = self.denormalize(prediction)
        
        return denormalized_prediction.tolist()
    
    def forecast_iterative(self, recent_data: List[float], steps: int) -> List[float]:
        forecasts = []
        current_window = deque(recent_data[-self.window_size:], maxlen=self.window_size)
        
        for _ in range(steps):
            window_array = np.array(list(current_window))
            normalized_window = (window_array - self.scaler_mean) / self.scaler_std
            
            next_prediction = np.dot(normalized_window, self.weights[:, 0]) + self.bias[0]
            denormalized_prediction = next_prediction * self.scaler_std + self.scaler_mean
            
            forecasts.append(denormalized_prediction)
            current_window.append(denormalized_prediction)
        
        return forecasts
    
    def detect_anomalies(self, data: List[float], threshold: float = 2.0) -> List[Tuple[int, float]]:
        anomalies = []
        
        for i in range(self.window_size, len(data)):
            recent_data = data[i - self.window_size:i]
            try:
                forecast = self.forecast(recent_data)
                actual = data[i]
                
                error = abs(actual - forecast[0])
                z_score = error / (self.scaler_std + 1e-10)
                
                if z_score > threshold:
                    anomalies.append((i, z_score))
            except:
                continue
        
        return anomalies
    
    def calculate_trend(self, data: List[float]) -> str:
        if len(data) < 2:
            return "insufficient_data"
        
        x = np.arange(len(data))
        y = np.array(data)
        
        slope = np.polyfit(x, y, 1)[0]
        
        if slope > 0.1:
            return "increasing"
        elif slope < -0.1:
            return "decreasing"
        else:
            return "stable"
    
    def calculate_seasonality(self, data: List[float], period: int = 24) -> Dict:
        if len(data) < period * 2:
            return {"has_seasonality": False}
        
        data_array = np.array(data)
        seasonal_components = []
        
        for i in range(period):
            values = data_array[i::period]
            seasonal_components.append(np.mean(values))
        
        seasonal_strength = np.std(seasonal_components) / (np.std(data_array) + 1e-10)
        
        return {
            "has_seasonality": seasonal_strength > 0.3,
            "strength": float(seasonal_strength),
            "period": period,
            "components": seasonal_components
        }
