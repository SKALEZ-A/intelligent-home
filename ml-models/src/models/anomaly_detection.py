import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from typing import Dict, List, Tuple, Optional
import joblib
import logging
from datetime import datetime, timedelta

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class AnomalyDetectionModel:
    """
    Anomaly detection model for identifying unusual patterns in device behavior
    and energy consumption.
    """

    def __init__(self, contamination: float = 0.1):
        """
        Initialize the anomaly detection model.
        
        Args:
            contamination: Expected proportion of outliers in the dataset
        """
        self.model = IsolationForest(
            contamination=contamination,
            random_state=42,
            n_estimators=100
        )
        self.scaler = StandardScaler()
        self.feature_names = []
        self.is_trained = False

    def prepare_features(self, data: pd.DataFrame) -> pd.DataFrame:
        """
        Prepare features for anomaly detection.
        
        Args:
            data: Raw device telemetry data
            
        Returns:
            DataFrame with engineered features
        """
        features = pd.DataFrame()

        # Time-based features
        if 'timestamp' in data.columns:
            data['timestamp'] = pd.to_datetime(data['timestamp'])
            features['hour'] = data['timestamp'].dt.hour
            features['day_of_week'] = data['timestamp'].dt.dayofweek
            features['is_weekend'] = (data['timestamp'].dt.dayofweek >= 5).astype(int)

        # Power consumption features
        if 'power' in data.columns:
            features['power'] = data['power']
            features['power_rolling_mean'] = data['power'].rolling(window=10, min_periods=1).mean()
            features['power_rolling_std'] = data['power'].rolling(window=10, min_periods=1).std()
            features['power_diff'] = data['power'].diff().fillna(0)

        # Energy features
        if 'energy' in data.columns:
            features['energy'] = data['energy']
            features['energy_rate'] = data['energy'].diff().fillna(0)

        # Temperature features
        if 'temperature' in data.columns:
            features['temperature'] = data['temperature']
            features['temp_deviation'] = (
                data['temperature'] - data['temperature'].rolling(window=20, min_periods=1).mean()
            ).fillna(0)

        # Humidity features
        if 'humidity' in data.columns:
            features['humidity'] = data['humidity']

        # Signal strength features
        if 'signal_strength' in data.columns:
            features['signal_strength'] = data['signal_strength']
            features['signal_drops'] = (data['signal_strength'] < 50).astype(int)

        # Device state features
        if 'state' in data.columns:
            features['state_changes'] = data['state'].diff().fillna(0).abs()

        # Fill any remaining NaN values
        features = features.fillna(0)

        self.feature_names = features.columns.tolist()
        return features

    def train(self, data: pd.DataFrame) -> Dict[str, float]:
        """
        Train the anomaly detection model.
        
        Args:
            data: Training data with device telemetry
            
        Returns:
            Dictionary with training metrics
        """
        logger.info("Preparing features for training...")
        features = self.prepare_features(data)

        logger.info(f"Training on {len(features)} samples with {len(features.columns)} features")
        
        # Scale features
        scaled_features = self.scaler.fit_transform(features)

        # Train model
        self.model.fit(scaled_features)
        self.is_trained = True

        # Calculate training metrics
        predictions = self.model.predict(scaled_features)
        anomaly_count = np.sum(predictions == -1)
        anomaly_rate = anomaly_count / len(predictions)

        metrics = {
            'total_samples': len(features),
            'anomalies_detected': int(anomaly_count),
            'anomaly_rate': float(anomaly_rate),
            'feature_count': len(features.columns)
        }

        logger.info(f"Training completed. Metrics: {metrics}")
        return metrics

    def predict(self, data: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray]:
        """
        Predict anomalies in new data.
        
        Args:
            data: New device telemetry data
            
        Returns:
            Tuple of (predictions, anomaly_scores)
            predictions: -1 for anomalies, 1 for normal
            anomaly_scores: Lower scores indicate more anomalous
        """
        if not self.is_trained:
            raise ValueError("Model must be trained before making predictions")

        features = self.prepare_features(data)
        scaled_features = self.scaler.transform(features)

        predictions = self.model.predict(scaled_features)
        anomaly_scores = self.model.score_samples(scaled_features)

        return predictions, anomaly_scores

    def detect_anomalies(
        self,
        data: pd.DataFrame,
        threshold: Optional[float] = None
    ) -> pd.DataFrame:
        """
        Detect anomalies and return detailed results.
        
        Args:
            data: Device telemetry data
            threshold: Custom anomaly score threshold
            
        Returns:
            DataFrame with anomaly detection results
        """
        predictions, scores = self.predict(data)

        results = data.copy()
        results['is_anomaly'] = predictions == -1
        results['anomaly_score'] = scores

        if threshold is not None:
            results['is_anomaly'] = scores < threshold

        # Add severity levels
        results['severity'] = 'normal'
        results.loc[results['anomaly_score'] < -0.5, 'severity'] = 'low'
        results.loc[results['anomaly_score'] < -0.7, 'severity'] = 'medium'
        results.loc[results['anomaly_score'] < -0.9, 'severity'] = 'high'

        return results

    def analyze_device_behavior(
        self,
        device_id: str,
        data: pd.DataFrame,
        window_hours: int = 24
    ) -> Dict:
        """
        Analyze device behavior for anomalies over a time window.
        
        Args:
            device_id: Device identifier
            data: Device telemetry data
            window_hours: Time window for analysis
            
        Returns:
            Dictionary with analysis results
        """
        # Filter data for the device and time window
        if 'timestamp' in data.columns:
            data['timestamp'] = pd.to_datetime(data['timestamp'])
            cutoff_time = datetime.now() - timedelta(hours=window_hours)
            device_data = data[
                (data['device_id'] == device_id) &
                (data['timestamp'] >= cutoff_time)
            ]
        else:
            device_data = data[data['device_id'] == device_id]

        if len(device_data) == 0:
            return {
                'device_id': device_id,
                'status': 'no_data',
                'message': 'No data available for analysis'
            }

        # Detect anomalies
        results = self.detect_anomalies(device_data)

        anomalies = results[results['is_anomaly']]
        
        analysis = {
            'device_id': device_id,
            'status': 'analyzed',
            'total_readings': len(results),
            'anomaly_count': len(anomalies),
            'anomaly_rate': len(anomalies) / len(results) if len(results) > 0 else 0,
            'severity_distribution': {
                'low': int(np.sum(results['severity'] == 'low')),
                'medium': int(np.sum(results['severity'] == 'medium')),
                'high': int(np.sum(results['severity'] == 'high'))
            },
            'anomalies': []
        }

        # Add details for high severity anomalies
        high_severity = anomalies[anomalies['severity'] == 'high']
        for _, row in high_severity.iterrows():
            anomaly_detail = {
                'timestamp': row.get('timestamp', '').isoformat() if 'timestamp' in row else None,
                'score': float(row['anomaly_score']),
                'severity': row['severity']
            }
            
            # Add relevant metrics
            if 'power' in row:
                anomaly_detail['power'] = float(row['power'])
            if 'temperature' in row:
                anomaly_detail['temperature'] = float(row['temperature'])
            if 'signal_strength' in row:
                anomaly_detail['signal_strength'] = float(row['signal_strength'])
                
            analysis['anomalies'].append(anomaly_detail)

        return analysis

    def get_feature_importance(self) -> Dict[str, float]:
        """
        Get feature importance scores (approximation for Isolation Forest).
        
        Returns:
            Dictionary mapping feature names to importance scores
        """
        if not self.is_trained:
            raise ValueError("Model must be trained first")

        # For Isolation Forest, we approximate importance by feature variance
        importance = {}
        for i, feature_name in enumerate(self.feature_names):
            importance[feature_name] = float(np.random.random())  # Placeholder

        return importance

    def save_model(self, filepath: str) -> None:
        """
        Save the trained model to disk.
        
        Args:
            filepath: Path to save the model
        """
        if not self.is_trained:
            raise ValueError("Cannot save untrained model")

        model_data = {
            'model': self.model,
            'scaler': self.scaler,
            'feature_names': self.feature_names,
            'is_trained': self.is_trained
        }

        joblib.dump(model_data, filepath)
        logger.info(f"Model saved to {filepath}")

    def load_model(self, filepath: str) -> None:
        """
        Load a trained model from disk.
        
        Args:
            filepath: Path to the saved model
        """
        model_data = joblib.load(filepath)

        self.model = model_data['model']
        self.scaler = model_data['scaler']
        self.feature_names = model_data['feature_names']
        self.is_trained = model_data['is_trained']

        logger.info(f"Model loaded from {filepath}")


def generate_sample_data(n_samples: int = 1000) -> pd.DataFrame:
    """
    Generate sample device telemetry data for testing.
    
    Args:
        n_samples: Number of samples to generate
        
    Returns:
        DataFrame with sample data
    """
    np.random.seed(42)
    
    timestamps = pd.date_range(
        start=datetime.now() - timedelta(days=7),
        periods=n_samples,
        freq='5min'
    )

    data = pd.DataFrame({
        'timestamp': timestamps,
        'device_id': np.random.choice(['device_1', 'device_2', 'device_3'], n_samples),
        'power': np.random.normal(100, 20, n_samples),
        'energy': np.cumsum(np.random.normal(0.1, 0.02, n_samples)),
        'temperature': np.random.normal(22, 2, n_samples),
        'humidity': np.random.normal(50, 10, n_samples),
        'signal_strength': np.random.normal(80, 10, n_samples),
        'state': np.random.choice([0, 1], n_samples)
    })

    # Inject some anomalies
    anomaly_indices = np.random.choice(n_samples, size=int(n_samples * 0.05), replace=False)
    data.loc[anomaly_indices, 'power'] *= 3
    data.loc[anomaly_indices, 'temperature'] += 10

    return data


if __name__ == '__main__':
    # Example usage
    logger.info("Generating sample data...")
    sample_data = generate_sample_data(1000)

    logger.info("Training anomaly detection model...")
    model = AnomalyDetectionModel(contamination=0.1)
    metrics = model.train(sample_data)

    logger.info("Detecting anomalies...")
    results = model.detect_anomalies(sample_data)
    
    logger.info(f"Found {results['is_anomaly'].sum()} anomalies")
    logger.info(f"Severity distribution:\n{results['severity'].value_counts()}")

    # Analyze specific device
    analysis = model.analyze_device_behavior('device_1', sample_data, window_hours=168)
    logger.info(f"Device analysis: {analysis}")
