import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest, RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import joblib
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
import warnings
warnings.filterwarnings('ignore')

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class PredictiveMaintenanceModel:
    """
    Predictive maintenance model for smart home devices.
    Predicts device failures and estimates remaining useful life (RUL).
    """

    def __init__(self):
        self.anomaly_detector = IsolationForest(
            contamination=0.1,
            random_state=42,
            n_estimators=100
        )
        self.rul_predictor = RandomForestRegressor(
            n_estimators=100,
            max_depth=10,
            random_state=42,
            n_jobs=-1
        )
        self.scaler = StandardScaler()
        self.feature_names = []
        self.is_trained = False

    def prepare_features(self, data: pd.DataFrame) -> pd.DataFrame:
        """
        Prepare features from device telemetry data.
        
        Args:
            data: DataFrame with device telemetry
            
        Returns:
            DataFrame with engineered features
        """
        features = pd.DataFrame()

        # Operating time features
        if 'operating_hours' in data.columns:
            features['operating_hours'] = data['operating_hours']
            features['operating_hours_squared'] = data['operating_hours'] ** 2

        # Power consumption features
        if 'power_consumption' in data.columns:
            features['power_avg'] = data['power_consumption'].rolling(window=24, min_periods=1).mean()
            features['power_std'] = data['power_consumption'].rolling(window=24, min_periods=1).std().fillna(0)
            features['power_max'] = data['power_consumption'].rolling(window=24, min_periods=1).max()
            features['power_trend'] = data['power_consumption'].diff().fillna(0)

        # Temperature features
        if 'temperature' in data.columns:
            features['temp_avg'] = data['temperature'].rolling(window=24, min_periods=1).mean()
            features['temp_std'] = data['temperature'].rolling(window=24, min_periods=1).std().fillna(0)
            features['temp_max'] = data['temperature'].rolling(window=24, min_periods=1).max()
            features['temp_spike_count'] = (data['temperature'] > 80).rolling(window=24, min_periods=1).sum()

        # Cycle count features
        if 'cycle_count' in data.columns:
            features['cycle_count'] = data['cycle_count']
            features['cycles_per_day'] = data['cycle_count'].diff().fillna(0)

        # Error rate features
        if 'error_count' in data.columns:
            features['error_rate'] = data['error_count'].rolling(window=24, min_periods=1).mean()
            features['error_trend'] = data['error_count'].diff().fillna(0)
            features['error_spike'] = (data['error_count'] > data['error_count'].rolling(window=24).mean() * 2).astype(int)

        # Response time features
        if 'response_time' in data.columns:
            features['response_avg'] = data['response_time'].rolling(window=24, min_periods=1).mean()
            features['response_std'] = data['response_time'].rolling(window=24, min_periods=1).std().fillna(0)
            features['response_degradation'] = (data['response_time'] > 
                                               data['response_time'].rolling(window=168).mean() * 1.5).astype(int)

        # Vibration features (for devices with motors)
        if 'vibration_level' in data.columns:
            features['vibration_avg'] = data['vibration_level'].rolling(window=24, min_periods=1).mean()
            features['vibration_std'] = data['vibration_level'].rolling(window=24, min_periods=1).std().fillna(0)
            features['vibration_peak'] = data['vibration_level'].rolling(window=24, min_periods=1).max()

        # Maintenance history features
        if 'days_since_maintenance' in data.columns:
            features['days_since_maintenance'] = data['days_since_maintenance']
            features['maintenance_overdue'] = (data['days_since_maintenance'] > 180).astype(int)

        # Usage pattern features
        if 'daily_usage_hours' in data.columns:
            features['usage_avg'] = data['daily_usage_hours'].rolling(window=7, min_periods=1).mean()
            features['usage_variance'] = data['daily_usage_hours'].rolling(window=7, min_periods=1).std().fillna(0)

        # Fill any remaining NaN values
        features = features.fillna(0)

        self.feature_names = features.columns.tolist()
        return features

    def train_anomaly_detector(self, data: pd.DataFrame) -> Dict:
        """
        Train the anomaly detection model.
        
        Args:
            data: DataFrame with normal device telemetry
            
        Returns:
            Dictionary with training metrics
        """
        logger.info("Training anomaly detector...")
        features = self.prepare_features(data)
        features_scaled = self.scaler.fit_transform(features)

        self.anomaly_detector.fit(features_scaled)

        # Evaluate on training data
        predictions = self.anomaly_detector.predict(features_scaled)
        anomaly_count = (predictions == -1).sum()
        anomaly_rate = anomaly_count / len(predictions)

        metrics = {
            'total_samples': len(predictions),
            'anomalies_detected': int(anomaly_count),
            'anomaly_rate': float(anomaly_rate),
            'model_type': 'IsolationForest'
        }

        logger.info(f"Anomaly detector trained. Anomaly rate: {anomaly_rate:.4f}")
        return metrics

    def train_rul_predictor(self, data: pd.DataFrame, rul_labels: np.ndarray,
                           test_size: float = 0.2) -> Dict:
        """
        Train the remaining useful life predictor.
        
        Args:
            data: DataFrame with device telemetry
            rul_labels: Array of remaining useful life values (in days)
            test_size: Proportion of data to use for testing
            
        Returns:
            Dictionary with training metrics
        """
        logger.info("Training RUL predictor...")
        features = self.prepare_features(data)

        X_train, X_test, y_train, y_test = train_test_split(
            features, rul_labels, test_size=test_size, random_state=42
        )

        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)

        self.rul_predictor.fit(X_train_scaled, y_train)

        # Evaluate
        y_pred = self.rul_predictor.predict(X_test_scaled)

        metrics = {
            'mse': mean_squared_error(y_test, y_pred),
            'rmse': np.sqrt(mean_squared_error(y_test, y_pred)),
            'mae': mean_absolute_error(y_test, y_pred),
            'r2_score': r2_score(y_test, y_pred),
            'train_size': len(X_train),
            'test_size': len(X_test)
        }

        # Feature importance
        if hasattr(self.rul_predictor, 'feature_importances_'):
            feature_importance = pd.DataFrame({
                'feature': self.feature_names,
                'importance': self.rul_predictor.feature_importances_
            }).sort_values('importance', ascending=False)
            metrics['feature_importance'] = feature_importance.head(10).to_dict('records')

        self.is_trained = True
        logger.info(f"RUL predictor trained. RMSE: {metrics['rmse']:.2f} days")
        
        return metrics

    def detect_anomalies(self, data: pd.DataFrame) -> np.ndarray:
        """
        Detect anomalies in device telemetry.
        
        Args:
            data: DataFrame with device telemetry
            
        Returns:
            Array of predictions (1 = normal, -1 = anomaly)
        """
        features = self.prepare_features(data)
        features_scaled = self.scaler.transform(features)
        predictions = self.anomaly_detector.predict(features_scaled)
        
        return predictions

    def predict_rul(self, data: pd.DataFrame) -> np.ndarray:
        """
        Predict remaining useful life for devices.
        
        Args:
            data: DataFrame with device telemetry
            
        Returns:
            Array of RUL predictions (in days)
        """
        if not self.is_trained:
            raise ValueError("Model must be trained before making predictions")

        features = self.prepare_features(data)
        features_scaled = self.scaler.transform(features)
        rul_predictions = self.rul_predictor.predict(features_scaled)
        
        # Ensure non-negative predictions
        rul_predictions = np.maximum(rul_predictions, 0)
        
        return rul_predictions

    def assess_device_health(self, data: pd.DataFrame) -> List[Dict]:
        """
        Comprehensive device health assessment.
        
        Args:
            data: DataFrame with device telemetry and device IDs
            
        Returns:
            List of health assessment dictionaries
        """
        anomalies = self.detect_anomalies(data)
        rul_predictions = self.predict_rul(data)

        assessments = []
        for i, device_id in enumerate(data['device_id'].unique()):
            device_data = data[data['device_id'] == device_id]
            device_indices = device_data.index

            device_anomalies = anomalies[device_indices]
            device_rul = rul_predictions[device_indices].mean()

            anomaly_rate = (device_anomalies == -1).sum() / len(device_anomalies)

            # Determine health status
            if device_rul < 30 or anomaly_rate > 0.3:
                health_status = 'critical'
                priority = 'high'
            elif device_rul < 90 or anomaly_rate > 0.15:
                health_status = 'warning'
                priority = 'medium'
            else:
                health_status = 'healthy'
                priority = 'low'

            assessment = {
                'device_id': device_id,
                'health_status': health_status,
                'priority': priority,
                'estimated_rul_days': float(device_rul),
                'anomaly_rate': float(anomaly_rate),
                'recent_anomalies': int((device_anomalies == -1).sum()),
                'recommendation': self._generate_recommendation(health_status, device_rul, anomaly_rate)
            }

            assessments.append(assessment)

        return assessments

    def _generate_recommendation(self, health_status: str, rul: float, 
                                 anomaly_rate: float) -> str:
        """Generate maintenance recommendation based on health metrics."""
        if health_status == 'critical':
            return f"Immediate maintenance required. Device may fail within {int(rul)} days."
        elif health_status == 'warning':
            return f"Schedule maintenance soon. Estimated {int(rul)} days remaining."
        else:
            return "Device operating normally. Continue regular monitoring."

    def predict_failure_probability(self, data: pd.DataFrame, 
                                   time_horizon_days: int = 30) -> np.ndarray:
        """
        Predict probability of failure within a time horizon.
        
        Args:
            data: DataFrame with device telemetry
            time_horizon_days: Time horizon for failure prediction
            
        Returns:
            Array of failure probabilities
        """
        rul_predictions = self.predict_rul(data)
        anomalies = self.detect_anomalies(data)

        # Calculate failure probability based on RUL and anomalies
        rul_factor = np.exp(-rul_predictions / time_horizon_days)
        anomaly_factor = (anomalies == -1).astype(float) * 0.5

        failure_prob = np.clip(rul_factor + anomaly_factor, 0, 1)

        return failure_prob

    def generate_maintenance_schedule(self, assessments: List[Dict], 
                                     max_concurrent: int = 3) -> List[Dict]:
        """
        Generate optimized maintenance schedule.
        
        Args:
            assessments: List of device health assessments
            max_concurrent: Maximum concurrent maintenance tasks
            
        Returns:
            List of scheduled maintenance tasks
        """
        # Sort by priority and RUL
        priority_map = {'high': 3, 'medium': 2, 'low': 1}
        sorted_assessments = sorted(
            assessments,
            key=lambda x: (priority_map[x['priority']], x['estimated_rul_days'])
        )

        schedule = []
        current_date = datetime.now()

        for i, assessment in enumerate(sorted_assessments):
            if assessment['health_status'] == 'healthy':
                continue

            # Calculate maintenance date
            if assessment['priority'] == 'high':
                days_until_maintenance = min(7, assessment['estimated_rul_days'] * 0.5)
            elif assessment['priority'] == 'medium':
                days_until_maintenance = min(30, assessment['estimated_rul_days'] * 0.7)
            else:
                days_until_maintenance = 90

            maintenance_date = current_date + timedelta(days=days_until_maintenance)

            schedule.append({
                'device_id': assessment['device_id'],
                'scheduled_date': maintenance_date.isoformat(),
                'priority': assessment['priority'],
                'estimated_duration_hours': 2,
                'reason': assessment['recommendation'],
                'estimated_rul_days': assessment['estimated_rul_days']
            })

        return schedule

    def save_model(self, filepath: str):
        """Save the trained models to disk."""
        if not self.is_trained:
            raise ValueError("Cannot save untrained model")

        model_data = {
            'anomaly_detector': self.anomaly_detector,
            'rul_predictor': self.rul_predictor,
            'scaler': self.scaler,
            'feature_names': self.feature_names
        }

        joblib.dump(model_data, filepath)
        logger.info(f"Models saved to {filepath}")

    def load_model(self, filepath: str):
        """Load trained models from disk."""
        model_data = joblib.load(filepath)

        self.anomaly_detector = model_data['anomaly_detector']
        self.rul_predictor = model_data['rul_predictor']
        self.scaler = model_data['scaler']
        self.feature_names = model_data['feature_names']
        self.is_trained = True

        logger.info(f"Models loaded from {filepath}")


def generate_synthetic_telemetry(n_devices: int = 10, 
                                 n_samples_per_device: int = 1000) -> Tuple[pd.DataFrame, np.ndarray]:
    """
    Generate synthetic device telemetry data.
    
    Args:
        n_devices: Number of devices
        n_samples_per_device: Number of samples per device
        
    Returns:
        Tuple of (telemetry DataFrame, RUL labels)
    """
    np.random.seed(42)
    
    all_data = []
    all_rul = []

    for device_id in range(n_devices):
        # Random device age and health
        device_age = np.random.uniform(0, 1000)
        health_factor = np.random.uniform(0.5, 1.0)

        timestamps = pd.date_range(
            start='2024-01-01',
            periods=n_samples_per_device,
            freq='1H'
        )

        # Generate telemetry with degradation over time
        operating_hours = device_age + np.arange(n_samples_per_device)
        
        # Power consumption increases with age
        power_base = 100 * health_factor
        power_degradation = operating_hours * 0.01 * (1 - health_factor)
        power_consumption = power_base + power_degradation + np.random.randn(n_samples_per_device) * 10

        # Temperature increases with degradation
        temp_base = 40 + (1 - health_factor) * 20
        temperature = temp_base + np.random.randn(n_samples_per_device) * 5

        # Error rate increases with age
        error_rate = (1 - health_factor) * 0.1
        error_count = np.random.poisson(error_rate * 10, n_samples_per_device)

        # Response time degrades
        response_base = 100 * (2 - health_factor)
        response_time = response_base + np.random.randn(n_samples_per_device) * 20

        # Calculate RUL (remaining useful life in days)
        max_life = 2000  # hours
        rul_hours = max_life - operating_hours
        rul_days = np.maximum(rul_hours / 24, 0)

        device_data = pd.DataFrame({
            'device_id': f'device_{device_id}',
            'timestamp': timestamps,
            'operating_hours': operating_hours,
            'power_consumption': power_consumption,
            'temperature': temperature,
            'cycle_count': np.cumsum(np.random.poisson(2, n_samples_per_device)),
            'error_count': error_count,
            'response_time': response_time,
            'vibration_level': 10 + (1 - health_factor) * 20 + np.random.randn(n_samples_per_device) * 3,
            'days_since_maintenance': np.arange(n_samples_per_device) % 180,
            'daily_usage_hours': np.random.uniform(8, 16, n_samples_per_device)
        })

        all_data.append(device_data)
        all_rul.extend(rul_days)

    combined_data = pd.concat(all_data, ignore_index=True)
    rul_array = np.array(all_rul)

    return combined_data, rul_array


if __name__ == '__main__':
    # Example usage
    logger.info("Generating synthetic telemetry data...")
    data, rul_labels = generate_synthetic_telemetry(n_devices=10, n_samples_per_device=1000)

    logger.info("Training predictive maintenance models...")
    model = PredictiveMaintenanceModel()

    # Train anomaly detector
    anomaly_metrics = model.train_anomaly_detector(data)
    logger.info(f"Anomaly detection metrics: {anomaly_metrics}")

    # Train RUL predictor
    rul_metrics = model.train_rul_predictor(data, rul_labels)
    logger.info(f"RUL prediction metrics: {rul_metrics}")

    # Assess device health
    assessments = model.assess_device_health(data)
    logger.info(f"\nDevice Health Assessments:")
    for assessment in assessments:
        logger.info(f"  {assessment['device_id']}: {assessment['health_status']} "
                   f"(RUL: {assessment['estimated_rul_days']:.0f} days)")

    # Generate maintenance schedule
    schedule = model.generate_maintenance_schedule(assessments)
    logger.info(f"\nMaintenance Schedule ({len(schedule)} tasks):")
    for task in schedule[:5]:
        logger.info(f"  {task['device_id']}: {task['scheduled_date']} ({task['priority']} priority)")

    # Save model
    model.save_model('predictive_maintenance_model.pkl')
