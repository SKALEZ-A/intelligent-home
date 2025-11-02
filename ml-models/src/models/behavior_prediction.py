"""
Behavior Prediction Model for Intelligent Home Automation
Uses LSTM neural networks to predict user behavior patterns and device usage
"""

import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from tensorflow.keras.models import Sequential, load_model
from tensorflow.keras.layers import LSTM, Dense, Dropout, Bidirectional, Attention
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau
from sklearn.preprocessing import MinMaxScaler, LabelEncoder
from sklearn.model_selection import train_test_split
from datetime import datetime, timedelta
import joblib
import logging
from typing import List, Dict, Tuple, Optional
import json

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class BehaviorPredictionModel:
    """
    LSTM-based model for predicting user behavior patterns
    Predicts device states for the next 24 hours based on historical data
    """
    
    def __init__(self, sequence_length: int = 168, prediction_horizon: int = 24):
        """
        Initialize the behavior prediction model
        
        Args:
            sequence_length: Number of hours of historical data to use (default: 168 = 1 week)
            prediction_horizon: Number of hours to predict ahead (default: 24)
        """
        self.sequence_length = sequence_length
        self.prediction_horizon = prediction_horizon
        self.model = None
        self.scaler = MinMaxScaler()
        self.label_encoder = LabelEncoder()
        self.feature_columns = []
        self.device_encoders = {}
        self.is_trained = False
        
    def build_model(self, input_shape: Tuple[int, int], num_devices: int) -> keras.Model:
        """
        Build the LSTM neural network architecture
        
        Args:
            input_shape: Shape of input data (sequence_length, num_features)
            num_devices: Number of devices to predict
            
        Returns:
            Compiled Keras model
        """
        model = Sequential([
            # First LSTM layer with return sequences
            Bidirectional(LSTM(
                units=128,
                return_sequences=True,
                dropout=0.2,
                recurrent_dropout=0.2
            ), input_shape=input_shape),
            
            # Second LSTM layer
            Bidirectional(LSTM(
                units=64,
                return_sequences=True,
                dropout=0.2,
                recurrent_dropout=0.2
            )),
            
            # Third LSTM layer
            LSTM(
                units=32,
                dropout=0.2,
                recurrent_dropout=0.2
            ),
            
            # Dense layers
            Dense(64, activation='relu'),
            Dropout(0.3),
            Dense(32, activation='relu'),
            Dropout(0.2),
            
            # Output layer - predict device states for next 24 hours
            Dense(num_devices * self.prediction_horizon, activation='sigmoid'),
        ])
        
        # Compile model
        model.compile(
            optimizer=keras.optimizers.Adam(learning_rate=0.001),
            loss='binary_crossentropy',
            metrics=['accuracy', 'precision', 'recall']
        )
        
        logger.info(f"Model built with input shape: {input_shape}, output size: {num_devices * self.prediction_horizon}")
        return model
    
    def prepare_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Prepare features from raw device usage data
        
        Args:
            df: DataFrame with columns: timestamp, device_id, state, user_id
            
        Returns:
            DataFrame with engineered features
        """
        df = df.copy()
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df = df.sort_values('timestamp')
        
        # Extract temporal features
        df['hour'] = df['timestamp'].dt.hour
        df['day_of_week'] = df['timestamp'].dt.dayofweek
        df['day_of_month'] = df['timestamp'].dt.day
        df['month'] = df['timestamp'].dt.month
        df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)
        df['is_morning'] = df['hour'].between(6, 11).astype(int)
        df['is_afternoon'] = df['hour'].between(12, 17).astype(int)
        df['is_evening'] = df['hour'].between(18, 22).astype(int)
        df['is_night'] = (~df['hour'].between(6, 22)).astype(int)
        
        # Cyclical encoding for time features
        df['hour_sin'] = np.sin(2 * np.pi * df['hour'] / 24)
        df['hour_cos'] = np.cos(2 * np.pi * df['hour'] / 24)
        df['day_sin'] = np.sin(2 * np.pi * df['day_of_week'] / 7)
        df['day_cos'] = np.cos(2 * np.pi * df['day_of_week'] / 7)
        df['month_sin'] = np.sin(2 * np.pi * df['month'] / 12)
        df['month_cos'] = np.cos(2 * np.pi * df['month'] / 12)
        
        # Pivot device states
        device_pivot = df.pivot_table(
            index='timestamp',
            columns='device_id',
            values='state',
            aggfunc='last',
            fill_value=0
        )
        
        # Merge temporal features
        temporal_features = df[['timestamp', 'hour', 'day_of_week', 'is_weekend',
                                'is_morning', 'is_afternoon', 'is_evening', 'is_night',
                                'hour_sin', 'hour_cos', 'day_sin', 'day_cos',
                                'month_sin', 'month_cos']].drop_duplicates('timestamp')
        
        result = device_pivot.merge(temporal_features, on='timestamp', how='left')
        result = result.sort_values('timestamp')
        
        # Add rolling statistics
        for col in device_pivot.columns:
            result[f'{col}_rolling_mean_24h'] = result[col].rolling(window=24, min_periods=1).mean()
            result[f'{col}_rolling_std_24h'] = result[col].rolling(window=24, min_periods=1).std().fillna(0)
            result[f'{col}_rolling_mean_168h'] = result[col].rolling(window=168, min_periods=1).mean()
        
        # Add lag features
        for col in device_pivot.columns:
            result[f'{col}_lag_1h'] = result[col].shift(1).fillna(0)
            result[f'{col}_lag_24h'] = result[col].shift(24).fillna(0)
            result[f'{col}_lag_168h'] = result[col].shift(168).fillna(0)
        
        self.feature_columns = [col for col in result.columns if col != 'timestamp']
        
        logger.info(f"Prepared {len(self.feature_columns)} features from raw data")
        return result
    
    def create_sequences(self, data: np.ndarray, target: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """
        Create sequences for LSTM training
        
        Args:
            data: Feature array
            target: Target array
            
        Returns:
            Tuple of (X, y) sequences
        """
        X, y = [], []
        
        for i in range(len(data) - self.sequence_length - self.prediction_horizon + 1):
            X.append(data[i:i + self.sequence_length])
            y.append(target[i + self.sequence_length:i + self.sequence_length + self.prediction_horizon])
        
        return np.array(X), np.array(y)
    
    def train(self, df: pd.DataFrame, validation_split: float = 0.2, epochs: int = 100, batch_size: int = 32):
        """
        Train the behavior prediction model
        
        Args:
            df: Training data DataFrame
            validation_split: Fraction of data to use for validation
            epochs: Number of training epochs
            batch_size: Batch size for training
        """
        logger.info("Starting model training...")
        
        # Prepare features
        features_df = self.prepare_features(df)
        
        # Get device columns
        device_columns = [col for col in features_df.columns if col.startswith('device_')]
        device_columns = [col for col in device_columns if not any(x in col for x in ['rolling', 'lag'])]
        
        # Prepare data
        X_data = features_df[self.feature_columns].values
        y_data = features_df[device_columns].values
        
        # Scale features
        X_scaled = self.scaler.fit_transform(X_data)
        
        # Create sequences
        X_seq, y_seq = self.create_sequences(X_scaled, y_data)
        
        # Flatten y for prediction
        y_seq = y_seq.reshape(y_seq.shape[0], -1)
        
        # Split data
        X_train, X_val, y_train, y_val = train_test_split(
            X_seq, y_seq, test_size=validation_split, shuffle=False
        )
        
        logger.info(f"Training data shape: X={X_train.shape}, y={y_train.shape}")
        logger.info(f"Validation data shape: X={X_val.shape}, y={y_val.shape}")
        
        # Build model
        self.model = self.build_model(
            input_shape=(X_train.shape[1], X_train.shape[2]),
            num_devices=len(device_columns)
        )
        
        # Callbacks
        callbacks = [
            EarlyStopping(
                monitor='val_loss',
                patience=10,
                restore_best_weights=True,
                verbose=1
            ),
            ModelCheckpoint(
                'models/behavior_prediction_best.h5',
                monitor='val_loss',
                save_best_only=True,
                verbose=1
            ),
            ReduceLROnPlateau(
                monitor='val_loss',
                factor=0.5,
                patience=5,
                min_lr=0.00001,
                verbose=1
            )
        ]
        
        # Train model
        history = self.model.fit(
            X_train, y_train,
            validation_data=(X_val, y_val),
            epochs=epochs,
            batch_size=batch_size,
            callbacks=callbacks,
            verbose=1
        )
        
        self.is_trained = True
        
        # Evaluate
        train_loss, train_acc, train_prec, train_rec = self.model.evaluate(X_train, y_train, verbose=0)
        val_loss, val_acc, val_prec, val_rec = self.model.evaluate(X_val, y_val, verbose=0)
        
        logger.info(f"Training - Loss: {train_loss:.4f}, Accuracy: {train_acc:.4f}, Precision: {train_prec:.4f}, Recall: {train_rec:.4f}")
        logger.info(f"Validation - Loss: {val_loss:.4f}, Accuracy: {val_acc:.4f}, Precision: {val_prec:.4f}, Recall: {val_rec:.4f}")
        
        return history
    
    def predict(self, recent_data: pd.DataFrame) -> Dict[str, List[float]]:
        """
        Predict device states for the next 24 hours
        
        Args:
            recent_data: Recent device usage data (at least sequence_length hours)
            
        Returns:
            Dictionary mapping device IDs to predicted states for next 24 hours
        """
        if not self.is_trained:
            raise ValueError("Model must be trained before making predictions")
        
        # Prepare features
        features_df = self.prepare_features(recent_data)
        
        # Get last sequence
        X_data = features_df[self.feature_columns].values[-self.sequence_length:]
        X_scaled = self.scaler.transform(X_data)
        X_seq = X_scaled.reshape(1, self.sequence_length, -1)
        
        # Predict
        predictions = self.model.predict(X_seq, verbose=0)
        
        # Reshape predictions
        device_columns = [col for col in features_df.columns if col.startswith('device_')]
        device_columns = [col for col in device_columns if not any(x in col for x in ['rolling', 'lag'])]
        
        predictions = predictions.reshape(len(device_columns), self.prediction_horizon)
        
        # Create result dictionary
        result = {}
        for i, device_id in enumerate(device_columns):
            result[device_id] = predictions[i].tolist()
        
        return result
    
    def predict_with_confidence(self, recent_data: pd.DataFrame, num_samples: int = 10) -> Dict[str, Dict]:
        """
        Predict device states with confidence intervals using Monte Carlo dropout
        
        Args:
            recent_data: Recent device usage data
            num_samples: Number of Monte Carlo samples
            
        Returns:
            Dictionary with predictions, confidence intervals, and uncertainty
        """
        if not self.is_trained:
            raise ValueError("Model must be trained before making predictions")
        
        # Prepare features
        features_df = self.prepare_features(recent_data)
        X_data = features_df[self.feature_columns].values[-self.sequence_length:]
        X_scaled = self.scaler.transform(X_data)
        X_seq = X_scaled.reshape(1, self.sequence_length, -1)
        
        # Get device columns
        device_columns = [col for col in features_df.columns if col.startswith('device_')]
        device_columns = [col for col in device_columns if not any(x in col for x in ['rolling', 'lag'])]
        
        # Monte Carlo sampling
        predictions = []
        for _ in range(num_samples):
            pred = self.model.predict(X_seq, verbose=0)
            predictions.append(pred)
        
        predictions = np.array(predictions)
        
        # Calculate statistics
        mean_pred = predictions.mean(axis=0)
        std_pred = predictions.std(axis=0)
        
        # Reshape
        mean_pred = mean_pred.reshape(len(device_columns), self.prediction_horizon)
        std_pred = std_pred.reshape(len(device_columns), self.prediction_horizon)
        
        # Create result dictionary
        result = {}
        for i, device_id in enumerate(device_columns):
            result[device_id] = {
                'prediction': mean_pred[i].tolist(),
                'confidence': (1 - std_pred[i]).tolist(),
                'uncertainty': std_pred[i].tolist(),
                'lower_bound': (mean_pred[i] - 1.96 * std_pred[i]).tolist(),
                'upper_bound': (mean_pred[i] + 1.96 * std_pred[i]).tolist(),
            }
        
        return result
    
    def detect_patterns(self, df: pd.DataFrame, confidence_threshold: float = 0.8) -> List[Dict]:
        """
        Detect recurring behavior patterns
        
        Args:
            df: Historical device usage data
            confidence_threshold: Minimum confidence for pattern detection
            
        Returns:
            List of detected patterns
        """
        patterns = []
        
        # Group by hour and day of week
        df['hour'] = pd.to_datetime(df['timestamp']).dt.hour
        df['day_of_week'] = pd.to_datetime(df['timestamp']).dt.dayofweek
        
        # Analyze patterns for each device
        for device_id in df['device_id'].unique():
            device_data = df[df['device_id'] == device_id]
            
            # Find frequent activation times
            activation_times = device_data[device_data['state'] == 1].groupby(['day_of_week', 'hour']).size()
            total_occurrences = device_data.groupby(['day_of_week', 'hour']).size()
            
            activation_rate = activation_times / total_occurrences
            frequent_patterns = activation_rate[activation_rate >= confidence_threshold]
            
            for (day, hour), confidence in frequent_patterns.items():
                patterns.append({
                    'device_id': device_id,
                    'day_of_week': int(day),
                    'hour': int(hour),
                    'confidence': float(confidence),
                    'type': 'recurring_activation',
                    'description': f"Device {device_id} is typically activated on {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][day]} at {hour}:00"
                })
        
        logger.info(f"Detected {len(patterns)} behavior patterns")
        return patterns
    
    def suggest_automations(self, patterns: List[Dict]) -> List[Dict]:
        """
        Suggest automations based on detected patterns
        
        Args:
            patterns: List of detected behavior patterns
            
        Returns:
            List of automation suggestions
        """
        suggestions = []
        
        for pattern in patterns:
            if pattern['confidence'] >= 0.85:
                suggestion = {
                    'name': f"Auto-activate {pattern['device_id']}",
                    'description': pattern['description'],
                    'confidence': pattern['confidence'],
                    'trigger': {
                        'type': 'time',
                        'day_of_week': pattern['day_of_week'],
                        'hour': pattern['hour'],
                    },
                    'action': {
                        'type': 'device',
                        'device_id': pattern['device_id'],
                        'command': 'turn_on',
                    },
                    'priority': 'medium' if pattern['confidence'] >= 0.9 else 'low',
                }
                suggestions.append(suggestion)
        
        logger.info(f"Generated {len(suggestions)} automation suggestions")
        return suggestions
    
    def save(self, path: str):
        """Save model and preprocessing objects"""
        if not self.is_trained:
            raise ValueError("Model must be trained before saving")
        
        # Save model
        self.model.save(f"{path}/behavior_model.h5")
        
        # Save preprocessing objects
        joblib.dump(self.scaler, f"{path}/scaler.pkl")
        joblib.dump(self.feature_columns, f"{path}/feature_columns.pkl")
        
        # Save metadata
        metadata = {
            'sequence_length': self.sequence_length,
            'prediction_horizon': self.prediction_horizon,
            'is_trained': self.is_trained,
        }
        with open(f"{path}/metadata.json", 'w') as f:
            json.dump(metadata, f)
        
        logger.info(f"Model saved to {path}")
    
    def load(self, path: str):
        """Load model and preprocessing objects"""
        # Load model
        self.model = load_model(f"{path}/behavior_model.h5")
        
        # Load preprocessing objects
        self.scaler = joblib.load(f"{path}/scaler.pkl")
        self.feature_columns = joblib.load(f"{path}/feature_columns.pkl")
        
        # Load metadata
        with open(f"{path}/metadata.json", 'r') as f:
            metadata = json.load(f)
        
        self.sequence_length = metadata['sequence_length']
        self.prediction_horizon = metadata['prediction_horizon']
        self.is_trained = metadata['is_trained']
        
        logger.info(f"Model loaded from {path}")


class OccupancyPredictionModel:
    """
    Model for predicting room occupancy based on sensor data
    Uses Random Forest classifier for real-time occupancy detection
    """
    
    def __init__(self):
        from sklearn.ensemble import RandomForestClassifier
        self.model = RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            min_samples_split=5,
            min_samples_leaf=2,
            random_state=42
        )
        self.scaler = MinMaxScaler()
        self.feature_columns = []
        self.is_trained = False
    
    def prepare_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Prepare features from sensor data
        
        Args:
            df: DataFrame with sensor readings
            
        Returns:
            DataFrame with engineered features
        """
        df = df.copy()
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        
        # Temporal features
        df['hour'] = df['timestamp'].dt.hour
        df['day_of_week'] = df['timestamp'].dt.dayofweek
        df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)
        
        # Aggregate sensor data by room and time window
        features = df.groupby(['room_id', pd.Grouper(key='timestamp', freq='5min')]).agg({
            'motion_detected': 'max',
            'door_opened': 'sum',
            'light_on': 'max',
            'temperature': 'mean',
            'co2_level': 'mean',
            'sound_level': 'mean',
        }).reset_index()
        
        # Add rolling features
        for col in ['motion_detected', 'door_opened', 'sound_level']:
            features[f'{col}_rolling_mean'] = features.groupby('room_id')[col].rolling(window=6, min_periods=1).mean().reset_index(0, drop=True)
        
        self.feature_columns = [col for col in features.columns if col not in ['room_id', 'timestamp', 'occupied']]
        
        return features
    
    def train(self, df: pd.DataFrame):
        """Train the occupancy prediction model"""
        logger.info("Training occupancy prediction model...")
        
        features_df = self.prepare_features(df)
        
        X = features_df[self.feature_columns].values
        y = features_df['occupied'].values
        
        X_scaled = self.scaler.fit_transform(X)
        
        X_train, X_test, y_train, y_test = train_test_split(
            X_scaled, y, test_size=0.2, random_state=42
        )
        
        self.model.fit(X_train, y_train)
        self.is_trained = True
        
        # Evaluate
        train_score = self.model.score(X_train, y_train)
        test_score = self.model.score(X_test, y_test)
        
        logger.info(f"Training accuracy: {train_score:.4f}")
        logger.info(f"Test accuracy: {test_score:.4f}")
        
        return train_score, test_score
    
    def predict(self, sensor_data: pd.DataFrame) -> Dict[str, float]:
        """
        Predict occupancy for each room
        
        Args:
            sensor_data: Recent sensor readings
            
        Returns:
            Dictionary mapping room IDs to occupancy probabilities
        """
        if not self.is_trained:
            raise ValueError("Model must be trained before making predictions")
        
        features_df = self.prepare_features(sensor_data)
        X = features_df[self.feature_columns].values
        X_scaled = self.scaler.transform(X)
        
        probabilities = self.model.predict_proba(X_scaled)[:, 1]
        
        result = {}
        for room_id, prob in zip(features_df['room_id'], probabilities):
            result[room_id] = float(prob)
        
        return result
