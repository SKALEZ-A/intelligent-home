import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import joblib
from datetime import datetime

class AnomalyDetectionTrainer:
    def __init__(self, model_path='models/anomaly_detection.pkl'):
        self.model_path = model_path
        self.model = None
        self.scaler = StandardScaler()
        self.feature_names = [
            'energy_consumption', 'temperature', 'humidity',
            'device_activations', 'response_time', 'error_rate',
            'network_latency', 'cpu_usage', 'memory_usage'
        ]
        
    def prepare_data(self, raw_data):
        X = []
        
        for record in raw_data:
            features = [
                record.get('energy_consumption', 0),
                record.get('temperature', 0),
                record.get('humidity', 0),
                record.get('device_activations', 0),
                record.get('response_time', 0),
                record.get('error_rate', 0),
                record.get('network_latency', 0),
                record.get('cpu_usage', 0),
                record.get('memory_usage', 0)
            ]
            X.append(features)
            
        return np.array(X)
    
    def train(self, training_data, contamination=0.1):
        print("Preparing training data...")
        X = self.prepare_data(training_data)
        
        print("Scaling features...")
        X_scaled = self.scaler.fit_transform(X)
        
        print(f"Training on {len(X)} samples...")
        self.model = IsolationForest(
            contamination=contamination,
            random_state=42,
            n_estimators=100
        )
        
        self.model.fit(X_scaled)
        
        predictions = self.model.predict(X_scaled)
        anomaly_scores = self.model.score_samples(X_scaled)
        
        anomaly_count = np.sum(predictions == -1)
        
        metrics = {
            'total_samples': len(X),
            'anomalies_detected': int(anomaly_count),
            'anomaly_rate': float(anomaly_count / len(X)),
            'mean_anomaly_score': float(np.mean(anomaly_scores)),
            'std_anomaly_score': float(np.std(anomaly_scores)),
            'trained_at': datetime.now().isoformat()
        }
        
        print(f"Training complete. Detected {anomaly_count} anomalies ({metrics['anomaly_rate']:.2%})")
        return metrics
    
    def save_model(self):
        if self.model is None:
            raise ValueError("No model to save. Train the model first.")
        
        joblib.dump({
            'model': self.model,
            'scaler': self.scaler
        }, self.model_path)
        print(f"Model saved to {self.model_path}")
        
    def load_model(self):
        data = joblib.load(self.model_path)
        self.model = data['model']
        self.scaler = data['scaler']
        print(f"Model loaded from {self.model_path}")
        
    def detect_anomaly(self, sensor_data):
        if self.model is None:
            raise ValueError("No model loaded. Load or train a model first.")
        
        features = np.array([[
            sensor_data.get('energy_consumption', 0),
            sensor_data.get('temperature', 0),
            sensor_data.get('humidity', 0),
            sensor_data.get('device_activations', 0),
            sensor_data.get('response_time', 0),
            sensor_data.get('error_rate', 0),
            sensor_data.get('network_latency', 0),
            sensor_data.get('cpu_usage', 0),
            sensor_data.get('memory_usage', 0)
        ]])
        
        features_scaled = self.scaler.transform(features)
        
        prediction = self.model.predict(features_scaled)[0]
        anomaly_score = self.model.score_samples(features_scaled)[0]
        
        return {
            'is_anomaly': bool(prediction == -1),
            'anomaly_score': float(anomaly_score),
            'severity': self.calculate_severity(anomaly_score),
            'timestamp': datetime.now().isoformat()
        }
    
    def calculate_severity(self, score):
        if score > -0.1:
            return 'low'
        elif score > -0.3:
            return 'medium'
        elif score > -0.5:
            return 'high'
        else:
            return 'critical'
