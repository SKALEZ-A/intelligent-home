import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.time_series_forecasting import TimeSeriesForecaster
import numpy as np
import matplotlib.pyplot as plt

class TimeSeriesTrainer:
    def __init__(self, window_size: int = 24, forecast_horizon: int = 12):
        self.model = TimeSeriesForecaster(window_size=window_size, forecast_horizon=forecast_horizon)
        
    def generate_sample_data(self, num_points: int = 1000):
        t = np.linspace(0, 100, num_points)
        
        trend = 0.05 * t
        seasonal = 10 * np.sin(2 * np.pi * t / 24)
        noise = np.random.normal(0, 2, num_points)
        
        data = 50 + trend + seasonal + noise
        
        return data.tolist()
    
    def train_model(self, epochs: int = 100, learning_rate: float = 0.001):
        print("Generating sample time series data...")
        data = self.generate_sample_data(1000)
        
        print(f"Training time series forecaster...")
        self.model.train(data, epochs=epochs, learning_rate=learning_rate)
        
        print("\nTesting forecasts...")
        recent_data = data[-self.model.window_size:]
        forecast = self.model.forecast(recent_data)
        
        print(f"Recent data (last 5 points): {recent_data[-5:]}")
        print(f"Forecast (next {len(forecast)} points): {forecast}")
        
        trend = self.model.calculate_trend(data[-100:])
        print(f"\nTrend analysis: {trend}")
        
        seasonality = self.model.calculate_seasonality(data, period=24)
        print(f"Seasonality detected: {seasonality['has_seasonality']}")
        if seasonality['has_seasonality']:
            print(f"Seasonal strength: {seasonality['strength']:.4f}")
    
    def detect_anomalies_in_data(self, data):
        print("\nDetecting anomalies...")
        anomalies = self.model.detect_anomalies(data, threshold=2.5)
        
        if anomalies:
            print(f"Found {len(anomalies)} anomalies:")
            for idx, z_score in anomalies[:5]:
                print(f"  Index {idx}: z-score = {z_score:.4f}")
        else:
            print("No anomalies detected")
    
    def evaluate_forecast_accuracy(self, data, test_size: int = 100):
        train_data = data[:-test_size]
        test_data = data[-test_size:]
        
        self.model.train(train_data, epochs=50, learning_rate=0.001)
        
        predictions = []
        actuals = []
        
        for i in range(len(test_data) - self.model.window_size):
            recent = train_data[-(self.model.window_size - i):] + test_data[:i] if i > 0 else train_data[-self.model.window_size:]
            forecast = self.model.forecast(recent)
            predictions.append(forecast[0])
            actuals.append(test_data[i])
        
        predictions = np.array(predictions)
        actuals = np.array(actuals)
        
        mae = np.mean(np.abs(predictions - actuals))
        rmse = np.sqrt(np.mean((predictions - actuals) ** 2))
        mape = np.mean(np.abs((actuals - predictions) / (actuals + 1e-10))) * 100
        
        print(f"\nForecast Accuracy Metrics:")
        print(f"  MAE: {mae:.4f}")
        print(f"  RMSE: {rmse:.4f}")
        print(f"  MAPE: {mape:.2f}%")
        
        return mae, rmse, mape

if __name__ == "__main__":
    trainer = TimeSeriesTrainer(window_size=24, forecast_horizon=12)
    
    data = trainer.generate_sample_data(1000)
    trainer.train_model(epochs=100)
    trainer.detect_anomalies_in_data(data)
    trainer.evaluate_forecast_accuracy(data, test_size=100)
