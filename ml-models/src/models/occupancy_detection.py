import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
import joblib
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class OccupancyDetectionModel:
    """
    Machine learning model for detecting home occupancy based on sensor data.
    Uses multiple features including motion sensors, door sensors, temperature,
    light levels, and device usage patterns.
    """

    def __init__(self, model_type: str = 'random_forest'):
        self.model_type = model_type
        self.model = None
        self.scaler = StandardScaler()
        self.feature_names = []
        self.is_trained = False

    def prepare_features(self, data: pd.DataFrame) -> pd.DataFrame:
        """
        Prepare features from raw sensor data.
        
        Args:
            data: DataFrame with sensor readings
            
        Returns:
            DataFrame with engineered features
        """
        features = pd.DataFrame()

        # Motion sensor features
        if 'motion_detected' in data.columns:
            features['motion_count'] = data['motion_detected'].rolling(window=10, min_periods=1).sum()
            features['motion_recent'] = data['motion_detected'].rolling(window=3, min_periods=1).max()

        # Door sensor features
        if 'door_opened' in data.columns:
            features['door_events'] = data['door_opened'].rolling(window=10, min_periods=1).sum()
            features['door_recent'] = data['door_opened'].rolling(window=3, min_periods=1).max()

        # Temperature features
        if 'temperature' in data.columns:
            features['temperature'] = data['temperature']
            features['temp_change'] = data['temperature'].diff().fillna(0)
            features['temp_variance'] = data['temperature'].rolling(window=10, min_periods=1).std().fillna(0)

        # Light level features
        if 'light_level' in data.columns:
            features['light_level'] = data['light_level']
            features['light_change'] = data['light_level'].diff().fillna(0)
            features['lights_on'] = (data['light_level'] > 100).astype(int)

        # Device usage features
        if 'device_active_count' in data.columns:
            features['device_count'] = data['device_active_count']
            features['device_change'] = data['device_active_count'].diff().fillna(0)

        # Power consumption features
        if 'power_consumption' in data.columns:
            features['power'] = data['power_consumption']
            features['power_change'] = data['power_consumption'].diff().fillna(0)
            features['power_avg'] = data['power_consumption'].rolling(window=10, min_periods=1).mean()

        # Time-based features
        if 'timestamp' in data.columns:
            data['timestamp'] = pd.to_datetime(data['timestamp'])
            features['hour'] = data['timestamp'].dt.hour
            features['day_of_week'] = data['timestamp'].dt.dayofweek
            features['is_weekend'] = (data['timestamp'].dt.dayofweek >= 5).astype(int)
            features['is_night'] = ((data['timestamp'].dt.hour >= 22) | 
                                   (data['timestamp'].dt.hour <= 6)).astype(int)

        # Fill any remaining NaN values
        features = features.fillna(0)

        self.feature_names = features.columns.tolist()
        return features

    def train(self, data: pd.DataFrame, labels: np.ndarray, 
              test_size: float = 0.2, random_state: int = 42) -> Dict:
        """
        Train the occupancy detection model.
        
        Args:
            data: DataFrame with sensor data
            labels: Array of occupancy labels (0 = unoccupied, 1 = occupied)
            test_size: Proportion of data to use for testing
            random_state: Random seed for reproducibility
            
        Returns:
            Dictionary with training metrics
        """
        logger.info("Preparing features for training...")
        features = self.prepare_features(data)

        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            features, labels, test_size=test_size, random_state=random_state, stratify=labels
        )

        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)

        # Initialize model
        if self.model_type == 'random_forest':
            self.model = RandomForestClassifier(
                n_estimators=100,
                max_depth=10,
                min_samples_split=5,
                min_samples_leaf=2,
                random_state=random_state,
                n_jobs=-1
            )
        elif self.model_type == 'gradient_boosting':
            self.model = GradientBoostingClassifier(
                n_estimators=100,
                max_depth=5,
                learning_rate=0.1,
                random_state=random_state
            )
        else:
            raise ValueError(f"Unknown model type: {self.model_type}")

        # Train model
        logger.info(f"Training {self.model_type} model...")
        self.model.fit(X_train_scaled, y_train)

        # Evaluate
        y_pred = self.model.predict(X_test_scaled)
        
        metrics = {
            'accuracy': accuracy_score(y_test, y_pred),
            'precision': precision_score(y_test, y_pred),
            'recall': recall_score(y_test, y_pred),
            'f1_score': f1_score(y_test, y_pred),
            'train_size': len(X_train),
            'test_size': len(X_test)
        }

        # Cross-validation
        cv_scores = cross_val_score(self.model, X_train_scaled, y_train, cv=5)
        metrics['cv_mean'] = cv_scores.mean()
        metrics['cv_std'] = cv_scores.std()

        # Feature importance
        if hasattr(self.model, 'feature_importances_'):
            feature_importance = pd.DataFrame({
                'feature': self.feature_names,
                'importance': self.model.feature_importances_
            }).sort_values('importance', ascending=False)
            metrics['feature_importance'] = feature_importance.to_dict('records')

        self.is_trained = True
        logger.info(f"Training complete. Accuracy: {metrics['accuracy']:.4f}")
        
        return metrics

    def predict(self, data: pd.DataFrame) -> np.ndarray:
        """
        Predict occupancy for new data.
        
        Args:
            data: DataFrame with sensor data
            
        Returns:
            Array of predictions (0 = unoccupied, 1 = occupied)
        """
        if not self.is_trained:
            raise ValueError("Model must be trained before making predictions")

        features = self.prepare_features(data)
        features_scaled = self.scaler.transform(features)
        predictions = self.model.predict(features_scaled)
        
        return predictions

    def predict_proba(self, data: pd.DataFrame) -> np.ndarray:
        """
        Predict occupancy probabilities for new data.
        
        Args:
            data: DataFrame with sensor data
            
        Returns:
            Array of probability predictions
        """
        if not self.is_trained:
            raise ValueError("Model must be trained before making predictions")

        features = self.prepare_features(data)
        features_scaled = self.scaler.transform(features)
        probabilities = self.model.predict_proba(features_scaled)
        
        return probabilities

    def detect_occupancy_change(self, data: pd.DataFrame, 
                               threshold: float = 0.7) -> List[Dict]:
        """
        Detect occupancy changes in a time series.
        
        Args:
            data: DataFrame with sensor data and timestamps
            threshold: Probability threshold for occupancy detection
            
        Returns:
            List of occupancy change events
        """
        probabilities = self.predict_proba(data)
        occupied_probs = probabilities[:, 1]
        
        events = []
        current_state = None
        
        for i, (prob, timestamp) in enumerate(zip(occupied_probs, data['timestamp'])):
            is_occupied = prob >= threshold
            
            if current_state is None:
                current_state = is_occupied
                events.append({
                    'timestamp': timestamp,
                    'event': 'occupied' if is_occupied else 'unoccupied',
                    'probability': prob,
                    'confidence': abs(prob - 0.5) * 2
                })
            elif is_occupied != current_state:
                current_state = is_occupied
                events.append({
                    'timestamp': timestamp,
                    'event': 'occupied' if is_occupied else 'unoccupied',
                    'probability': prob,
                    'confidence': abs(prob - 0.5) * 2
                })
        
        return events

    def get_occupancy_patterns(self, data: pd.DataFrame, 
                              labels: np.ndarray) -> Dict:
        """
        Analyze occupancy patterns from historical data.
        
        Args:
            data: DataFrame with sensor data and timestamps
            labels: Array of occupancy labels
            
        Returns:
            Dictionary with occupancy pattern statistics
        """
        data['timestamp'] = pd.to_datetime(data['timestamp'])
        data['occupied'] = labels
        
        patterns = {
            'hourly': data.groupby(data['timestamp'].dt.hour)['occupied'].mean().to_dict(),
            'daily': data.groupby(data['timestamp'].dt.dayofweek)['occupied'].mean().to_dict(),
            'weekend_vs_weekday': {
                'weekday': data[data['timestamp'].dt.dayofweek < 5]['occupied'].mean(),
                'weekend': data[data['timestamp'].dt.dayofweek >= 5]['occupied'].mean()
            },
            'total_occupied_time': labels.sum() / len(labels),
            'average_occupancy_duration': self._calculate_avg_duration(labels),
            'peak_occupancy_hours': self._find_peak_hours(data, labels)
        }
        
        return patterns

    def _calculate_avg_duration(self, labels: np.ndarray) -> float:
        """Calculate average duration of occupancy periods."""
        durations = []
        current_duration = 0
        
        for label in labels:
            if label == 1:
                current_duration += 1
            elif current_duration > 0:
                durations.append(current_duration)
                current_duration = 0
        
        if current_duration > 0:
            durations.append(current_duration)
        
        return np.mean(durations) if durations else 0

    def _find_peak_hours(self, data: pd.DataFrame, labels: np.ndarray, 
                        top_n: int = 3) -> List[int]:
        """Find peak occupancy hours."""
        data['occupied'] = labels
        hourly_occupancy = data.groupby(data['timestamp'].dt.hour)['occupied'].mean()
        peak_hours = hourly_occupancy.nlargest(top_n).index.tolist()
        return peak_hours

    def save_model(self, filepath: str):
        """Save the trained model to disk."""
        if not self.is_trained:
            raise ValueError("Cannot save untrained model")
        
        model_data = {
            'model': self.model,
            'scaler': self.scaler,
            'feature_names': self.feature_names,
            'model_type': self.model_type
        }
        
        joblib.dump(model_data, filepath)
        logger.info(f"Model saved to {filepath}")

    def load_model(self, filepath: str):
        """Load a trained model from disk."""
        model_data = joblib.load(filepath)
        
        self.model = model_data['model']
        self.scaler = model_data['scaler']
        self.feature_names = model_data['feature_names']
        self.model_type = model_data['model_type']
        self.is_trained = True
        
        logger.info(f"Model loaded from {filepath}")


def generate_synthetic_data(n_samples: int = 10000) -> Tuple[pd.DataFrame, np.ndarray]:
    """
    Generate synthetic sensor data for testing.
    
    Args:
        n_samples: Number of samples to generate
        
    Returns:
        Tuple of (features DataFrame, labels array)
    """
    np.random.seed(42)
    
    timestamps = pd.date_range(start='2024-01-01', periods=n_samples, freq='5min')
    
    # Generate base patterns
    hours = timestamps.hour
    is_occupied = np.zeros(n_samples)
    
    # Typical occupancy pattern: home in evening/night, away during day
    for i, hour in enumerate(hours):
        if 7 <= hour <= 9:  # Morning
            is_occupied[i] = np.random.choice([0, 1], p=[0.3, 0.7])
        elif 10 <= hour <= 17:  # Day (away)
            is_occupied[i] = np.random.choice([0, 1], p=[0.9, 0.1])
        elif 18 <= hour <= 23:  # Evening (home)
            is_occupied[i] = np.random.choice([0, 1], p=[0.1, 0.9])
        else:  # Night (home)
            is_occupied[i] = np.random.choice([0, 1], p=[0.2, 0.8])
    
    # Generate sensor data based on occupancy
    data = pd.DataFrame({
        'timestamp': timestamps,
        'motion_detected': (is_occupied * np.random.rand(n_samples) > 0.3).astype(int),
        'door_opened': (is_occupied * np.random.rand(n_samples) > 0.8).astype(int),
        'temperature': 20 + is_occupied * 2 + np.random.randn(n_samples) * 0.5,
        'light_level': is_occupied * 200 + np.random.rand(n_samples) * 50,
        'device_active_count': (is_occupied * np.random.poisson(3, n_samples)).astype(int),
        'power_consumption': is_occupied * 500 + np.random.rand(n_samples) * 200
    })
    
    return data, is_occupied.astype(int)


if __name__ == '__main__':
    # Example usage
    logger.info("Generating synthetic data...")
    data, labels = generate_synthetic_data(n_samples=10000)
    
    logger.info("Training occupancy detection model...")
    model = OccupancyDetectionModel(model_type='random_forest')
    metrics = model.train(data, labels)
    
    logger.info("Training metrics:")
    for key, value in metrics.items():
        if key != 'feature_importance':
            logger.info(f"  {key}: {value}")
    
    # Save model
    model.save_model('occupancy_model.pkl')
    
    # Test prediction
    test_data, test_labels = generate_synthetic_data(n_samples=100)
    predictions = model.predict(test_data)
    accuracy = accuracy_score(test_labels, predictions)
    logger.info(f"Test accuracy: {accuracy:.4f}")
