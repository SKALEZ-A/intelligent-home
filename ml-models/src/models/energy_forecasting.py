import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from typing import Dict, List, Tuple, Optional
import joblib
import logging
from datetime import datetime, timedelta

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class EnergyForecastingModel:
    """
    Energy consumption forecasting model using ensemble methods.
    Predicts future energy usage based on historical patterns and external factors.
    """

    def __init__(self, model_type: str = 'random_forest'):
        """
        Initialize the energy forecasting model.
        
        Args:
            model_type: Type of model ('random_forest' or 'gradient_boosting')
        """
        if model_type == 'random_forest':
            self.model = RandomForestRegressor(
                n_estimators=100,
                max_depth=15,
                min_samples_split=5,
                random_state=42,
                n_jobs=-1
            )
        elif model_type == 'gradient_boosting':
            self.model = GradientBoostingRegressor(
                n_estimators=100,
                max_depth=5,
                learning_rate=0.1,
                random_state=42
            )
        else:
            raise ValueError(f"Unknown model type: {model_type}")

        self.scaler = StandardScaler()
        self.feature_names = []
        self.is_trained = False
        self.model_type = model_type

    def engineer_features(self, data: pd.DataFrame) -> pd.DataFrame:
        """
        Engineer features for energy forecasting.
        
        Args:
            data: Raw energy consumption data
            
        Returns:
            DataFrame with engineered features
        """
        features = pd.DataFrame()

        # Ensure timestamp is datetime
        if 'timestamp' in data.columns:
            data['timestamp'] = pd.to_datetime(data['timestamp'])
            
            # Time-based features
            features['hour'] = data['timestamp'].dt.hour
            features['day_of_week'] = data['timestamp'].dt.dayofweek
            features['day_of_month'] = data['timestamp'].dt.day
            features['month'] = data['timestamp'].dt.month
            features['quarter'] = data['timestamp'].dt.quarter
            features['is_weekend'] = (data['timestamp'].dt.dayofweek >= 5).astype(int)
            features['is_business_hours'] = (
                (data['timestamp'].dt.hour >= 9) & 
                (data['timestamp'].dt.hour <= 17)
            ).astype(int)

            # Cyclical encoding for time features
            features['hour_sin'] = np.sin(2 * np.pi * features['hour'] / 24)
            features['hour_cos'] = np.cos(2 * np.pi * features['hour'] / 24)
            features['day_sin'] = np.sin(2 * np.pi * features['day_of_week'] / 7)
            features['day_cos'] = np.cos(2 * np.pi * features['day_of_week'] / 7)
            features['month_sin'] = np.sin(2 * np.pi * features['month'] / 12)
            features['month_cos'] = np.cos(2 * np.pi * features['month'] / 12)

        # Historical energy features
        if 'energy' in data.columns:
            # Lag features
            for lag in [1, 2, 3, 6, 12, 24]:
                features[f'energy_lag_{lag}'] = data['energy'].shift(lag)

            # Rolling statistics
            for window in [3, 6, 12, 24]:
                features[f'energy_rolling_mean_{window}'] = (
                    data['energy'].rolling(window=window, min_periods=1).mean()
                )
                features[f'energy_rolling_std_{window}'] = (
                    data['energy'].rolling(window=window, min_periods=1).std()
                )
                features[f'energy_rolling_max_{window}'] = (
                    data['energy'].rolling(window=window, min_periods=1).max()
                )
                features[f'energy_rolling_min_{window}'] = (
                    data['energy'].rolling(window=window, min_periods=1).min()
                )

            # Exponential moving average
            features['energy_ema_12'] = data['energy'].ewm(span=12, adjust=False).mean()
            features['energy_ema_24'] = data['energy'].ewm(span=24, adjust=False).mean()

        # Power features
        if 'power' in data.columns:
            features['power'] = data['power']
            features['power_rolling_mean_6'] = (
                data['power'].rolling(window=6, min_periods=1).mean()
            )

        # Weather features
        if 'temperature' in data.columns:
            features['temperature'] = data['temperature']
            features['temp_squared'] = data['temperature'] ** 2
            features['temp_rolling_mean'] = (
                data['temperature'].rolling(window=6, min_periods=1).mean()
            )

        if 'humidity' in data.columns:
            features['humidity'] = data['humidity']

        # Device count features
        if 'active_devices' in data.columns:
            features['active_devices'] = data['active_devices']

        # Occupancy features
        if 'occupancy' in data.columns:
            features['occupancy'] = data['occupancy']

        # Fill NaN values
        features = features.fillna(method='bfill').fillna(0)

        self.feature_names = features.columns.tolist()
        return features

    def train(
        self,
        data: pd.DataFrame,
        target_column: str = 'energy',
        test_size: float = 0.2
    ) -> Dict[str, float]:
        """
        Train the energy forecasting model.
        
        Args:
            data: Training data with energy consumption
            target_column: Name of the target variable column
            test_size: Proportion of data to use for testing
            
        Returns:
            Dictionary with training metrics
        """
        logger.info("Engineering features for training...")
        features = self.engineer_features(data)
        
        if target_column not in data.columns:
            raise ValueError(f"Target column '{target_column}' not found in data")

        target = data[target_column].values

        # Remove rows with NaN in target
        valid_indices = ~np.isnan(target)
        features = features[valid_indices]
        target = target[valid_indices]

        logger.info(f"Training on {len(features)} samples with {len(features.columns)} features")

        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            features, target, test_size=test_size, random_state=42, shuffle=False
        )

        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)

        # Train model
        self.model.fit(X_train_scaled, y_train)
        self.is_trained = True

        # Evaluate
        train_pred = self.model.predict(X_train_scaled)
        test_pred = self.model.predict(X_test_scaled)

        metrics = {
            'train_mae': float(mean_absolute_error(y_train, train_pred)),
            'train_rmse': float(np.sqrt(mean_squared_error(y_train, train_pred))),
            'train_r2': float(r2_score(y_train, train_pred)),
            'test_mae': float(mean_absolute_error(y_test, test_pred)),
            'test_rmse': float(np.sqrt(mean_squared_error(y_test, test_pred))),
            'test_r2': float(r2_score(y_test, test_pred)),
            'feature_count': len(features.columns)
        }

        # Cross-validation
        cv_scores = cross_val_score(
            self.model, X_train_scaled, y_train, cv=5, scoring='neg_mean_absolute_error'
        )
        metrics['cv_mae_mean'] = float(-cv_scores.mean())
        metrics['cv_mae_std'] = float(cv_scores.std())

        logger.info(f"Training completed. Test MAE: {metrics['test_mae']:.2f}, R²: {metrics['test_r2']:.3f}")
        return metrics

    def predict(self, data: pd.DataFrame) -> np.ndarray:
        """
        Predict energy consumption for new data.
        
        Args:
            data: New data for prediction
            
        Returns:
            Array of predictions
        """
        if not self.is_trained:
            raise ValueError("Model must be trained before making predictions")

        features = self.engineer_features(data)
        scaled_features = self.scaler.transform(features)
        predictions = self.model.predict(scaled_features)

        return predictions

    def forecast_future(
        self,
        historical_data: pd.DataFrame,
        hours_ahead: int = 24,
        external_features: Optional[pd.DataFrame] = None
    ) -> pd.DataFrame:
        """
        Forecast energy consumption for future time periods.
        
        Args:
            historical_data: Historical energy data
            hours_ahead: Number of hours to forecast
            external_features: Optional external features (weather, etc.)
            
        Returns:
            DataFrame with forecasted values
        """
        if not self.is_trained:
            raise ValueError("Model must be trained before forecasting")

        # Get the last timestamp
        last_timestamp = pd.to_datetime(historical_data['timestamp'].max())
        
        # Create future timestamps
        future_timestamps = pd.date_range(
            start=last_timestamp + timedelta(hours=1),
            periods=hours_ahead,
            freq='H'
        )

        # Create future data structure
        future_data = pd.DataFrame({'timestamp': future_timestamps})

        # Add external features if provided
        if external_features is not None:
            future_data = future_data.merge(
                external_features,
                on='timestamp',
                how='left'
            )

        # For features that depend on historical data, we'll use the last known values
        # This is a simplified approach; in production, you'd want more sophisticated methods
        last_energy = historical_data['energy'].iloc[-1]
        future_data['energy'] = last_energy

        if 'power' in historical_data.columns:
            future_data['power'] = historical_data['power'].iloc[-1]

        # Make predictions iteratively
        predictions = []
        for i in range(hours_ahead):
            # Prepare features for this time step
            current_data = pd.concat([historical_data, future_data.iloc[:i+1]])
            
            # Predict
            pred = self.predict(current_data.iloc[[-1]])
            predictions.append(pred[0])
            
            # Update future_data with prediction for next iteration
            if i < hours_ahead - 1:
                future_data.loc[i, 'energy'] = pred[0]

        # Create forecast DataFrame
        forecast = pd.DataFrame({
            'timestamp': future_timestamps,
            'predicted_energy': predictions
        })

        # Add confidence intervals (simplified)
        forecast['lower_bound'] = forecast['predicted_energy'] * 0.9
        forecast['upper_bound'] = forecast['predicted_energy'] * 1.1

        return forecast

    def get_feature_importance(self) -> Dict[str, float]:
        """
        Get feature importance scores.
        
        Returns:
            Dictionary mapping feature names to importance scores
        """
        if not self.is_trained:
            raise ValueError("Model must be trained first")

        if hasattr(self.model, 'feature_importances_'):
            importance = dict(zip(
                self.feature_names,
                self.model.feature_importances_
            ))
            # Sort by importance
            importance = dict(sorted(
                importance.items(),
                key=lambda x: x[1],
                reverse=True
            ))
            return importance
        else:
            return {}

    def analyze_consumption_patterns(
        self,
        data: pd.DataFrame
    ) -> Dict:
        """
        Analyze energy consumption patterns.
        
        Args:
            data: Historical energy data
            
        Returns:
            Dictionary with pattern analysis
        """
        data['timestamp'] = pd.to_datetime(data['timestamp'])
        data['hour'] = data['timestamp'].dt.hour
        data['day_of_week'] = data['timestamp'].dt.dayofweek

        analysis = {
            'total_consumption': float(data['energy'].sum()),
            'average_consumption': float(data['energy'].mean()),
            'peak_consumption': float(data['energy'].max()),
            'min_consumption': float(data['energy'].min()),
            'hourly_pattern': data.groupby('hour')['energy'].mean().to_dict(),
            'daily_pattern': data.groupby('day_of_week')['energy'].mean().to_dict(),
            'peak_hours': data.groupby('hour')['energy'].mean().nlargest(3).index.tolist(),
            'off_peak_hours': data.groupby('hour')['energy'].mean().nsmallest(3).index.tolist()
        }

        return analysis

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
            'is_trained': self.is_trained,
            'model_type': self.model_type
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
        self.model_type = model_data['model_type']

        logger.info(f"Model loaded from {filepath}")


def generate_sample_energy_data(n_samples: int = 2000) -> pd.DataFrame:
    """
    Generate sample energy consumption data for testing.
    
    Args:
        n_samples: Number of samples to generate
        
    Returns:
        DataFrame with sample data
    """
    np.random.seed(42)
    
    timestamps = pd.date_range(
        start=datetime.now() - timedelta(days=30),
        periods=n_samples,
        freq='H'
    )

    # Create realistic energy patterns
    hours = timestamps.hour
    days = timestamps.dayofweek

    # Base consumption with daily and weekly patterns
    base_consumption = 50
    hourly_pattern = 30 * np.sin(2 * np.pi * hours / 24) + 20
    weekly_pattern = 10 * (days < 5).astype(int)  # Higher on weekdays
    
    energy = base_consumption + hourly_pattern + weekly_pattern
    energy += np.random.normal(0, 5, n_samples)  # Add noise
    energy = np.maximum(energy, 0)  # Ensure non-negative

    data = pd.DataFrame({
        'timestamp': timestamps,
        'energy': energy,
        'power': energy * 1.2 + np.random.normal(0, 2, n_samples),
        'temperature': 20 + 5 * np.sin(2 * np.pi * hours / 24) + np.random.normal(0, 1, n_samples),
        'humidity': 50 + 10 * np.sin(2 * np.pi * hours / 24) + np.random.normal(0, 3, n_samples),
        'active_devices': np.random.randint(5, 15, n_samples),
        'occupancy': (hours >= 18) | (hours <= 8) | (days >= 5)
    })

    return data


if __name__ == '__main__':
    # Example usage
    logger.info("Generating sample energy data...")
    sample_data = generate_sample_energy_data(2000)

    logger.info("Training energy forecasting model...")
    model = EnergyForecastingModel(model_type='random_forest')
    metrics = model.train(sample_data)

    logger.info(f"Model performance: {metrics}")

    # Forecast future consumption
    logger.info("Forecasting next 24 hours...")
    forecast = model.forecast_future(sample_data, hours_ahead=24)
    logger.info(f"Forecast:\n{forecast.head()}")

    # Analyze patterns
    patterns = model.analyze_consumption_patterns(sample_data)
    logger.info(f"Consumption patterns: {patterns}")

    # Feature importance
    importance = model.get_feature_importance()
    logger.info(f"Top 5 important features: {list(importance.items())[:5]}")
