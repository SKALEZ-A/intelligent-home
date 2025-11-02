import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest, RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
import joblib
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PredictiveMaintenanceTrainer:
    def __init__(self, model_path='models/predictive_maintenance.pkl'):
        self.model_path = model_path
        self.anomaly_detector = None
        self.failure_predictor = None
        self.scaler = StandardScaler()
        self.feature_names = []
        
    def prepare_features(self, df):
        """Prepare features for predictive maintenance"""
        features = pd.DataFrame()
        
        # Device age and usage
        features['device_age_days'] = df['device_age_days']
        features['total_runtime_hours'] = df['total_runtime_hours']
        features['cycles_count'] = df['cycles_count']
        
        # Performance metrics
        features['avg_response_time'] = df['avg_response_time']
        features['error_rate'] = df['error_rate']
        features['connection_drops'] = df['connection_drops']
        
        # Environmental factors
        features['avg_temperature'] = df['avg_temperature']
        features['max_temperature'] = df['max_temperature']
        features['humidity'] = df['humidity']
        
        # Power metrics
        features['power_consumption'] = df['power_consumption']
        features['power_fluctuations'] = df['power_fluctuations']
        features['voltage_variance'] = df['voltage_variance']
        
        # Signal quality
        features['signal_strength'] = df['signal_strength']
        features['packet_loss'] = df['packet_loss']
        features['latency'] = df['latency']
        
        # Maintenance history
        features['days_since_last_maintenance'] = df['days_since_last_maintenance']
        features['maintenance_count'] = df['maintenance_count']
        
        self.feature_names = features.columns.tolist()
        return features
    
    def train_anomaly_detector(self, X_train):
        """Train anomaly detection model"""
        logger.info("Training anomaly detector")
        
        self.anomaly_detector = IsolationForest(
            contamination=0.1,
            random_state=42,
            n_estimators=100
        )
        
        self.anomaly_detector.fit(X_train)
        
        # Evaluate on training data
        anomaly_scores = self.anomaly_detector.score_samples(X_train)
        predictions = self.anomaly_detector.predict(X_train)
        
        anomaly_count = np.sum(predictions == -1)
        logger.info(f"Detected {anomaly_count} anomalies in training data")
        
        return anomaly_scores
    
    def train_failure_predictor(self, X_train, y_train, X_test, y_test):
        """Train failure prediction model"""
        logger.info("Training failure predictor")
        
        self.failure_predictor = RandomForestRegressor(
            n_estimators=200,
            max_depth=20,
            min_samples_split=5,
            random_state=42,
            n_jobs=-1
        )
        
        self.failure_predictor.fit(X_train, y_train)
        
        # Evaluate
        train_score = self.failure_predictor.score(X_train, y_train)
        test_score = self.failure_predictor.score(X_test, y_test)
        
        logger.info(f"Failure Predictor R² Score:")
        logger.info(f"  Training: {train_score:.4f}")
        logger.info(f"  Testing: {test_score:.4f}")
        
        # Feature importance
        feature_importance = pd.DataFrame({
            'feature': self.feature_names,
            'importance': self.failure_predictor.feature_importances_
        }).sort_values('importance', ascending=False)
        
        logger.info("\nTop 10 Important Features:")
        logger.info(feature_importance.head(10).to_string())
        
        return train_score, test_score, feature_importance
    
    def train(self, data_path, test_size=0.2):
        """Train both models"""
        logger.info(f"Loading training data from {data_path}")
        df = pd.read_csv(data_path)
        
        # Prepare features
        X = self.prepare_features(df)
        y = df['days_until_failure']  # Target: days until device failure
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=42
        )
        
        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        # Train anomaly detector
        anomaly_scores = self.train_anomaly_detector(X_train_scaled)
        
        # Train failure predictor
        train_score, test_score, feature_importance = self.train_failure_predictor(
            X_train_scaled, y_train, X_test_scaled, y_test
        )
        
        return {
            'anomaly_detector_trained': True,
            'failure_predictor_r2_train': train_score,
            'failure_predictor_r2_test': test_score,
            'feature_importance': feature_importance.to_dict('records')
        }
    
    def save_model(self):
        """Save trained models"""
        if self.anomaly_detector is None or self.failure_predictor is None:
            raise ValueError("Models not trained")
        
        model_data = {
            'anomaly_detector': self.anomaly_detector,
            'failure_predictor': self.failure_predictor,
            'scaler': self.scaler,
            'feature_names': self.feature_names,
            'trained_at': datetime.now().isoformat()
        }
        
        joblib.dump(model_data, self.model_path)
        logger.info(f"Models saved to {self.model_path}")
    
    def load_model(self):
        """Load trained models"""
        model_data = joblib.load(self.model_path)
        self.anomaly_detector = model_data['anomaly_detector']
        self.failure_predictor = model_data['failure_predictor']
        self.scaler = model_data['scaler']
        self.feature_names = model_data['feature_names']
        logger.info(f"Models loaded from {self.model_path}")
    
    def predict(self, features):
        """Make predictions"""
        if self.anomaly_detector is None or self.failure_predictor is None:
            raise ValueError("Models not loaded")
        
        features_scaled = self.scaler.transform(features)
        
        # Detect anomalies
        is_anomaly = self.anomaly_detector.predict(features_scaled)
        anomaly_score = self.anomaly_detector.score_samples(features_scaled)
        
        # Predict days until failure
        days_until_failure = self.failure_predictor.predict(features_scaled)
        
        return {
            'is_anomaly': is_anomaly,
            'anomaly_score': anomaly_score,
            'days_until_failure': days_until_failure
        }

if __name__ == '__main__':
    trainer = PredictiveMaintenanceTrainer()
    metrics = trainer.train('data/maintenance_data.csv')
    trainer.save_model()
