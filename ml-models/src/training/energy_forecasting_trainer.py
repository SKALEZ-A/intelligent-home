import numpy as np
import tensorflow as tf
from tensorflow import keras
from typing import Dict, Any, Tuple
from .trainer import ModelTrainer
from ..utils.data_processor import DataProcessor
from ..utils.model_evaluator import ModelEvaluator

class EnergyForecastingTrainer(ModelTrainer):
    def __init__(self, config: Dict[str, Any]):
        super().__init__('energy_forecasting', config)
        self.data_processor = DataProcessor()
        self.evaluator = ModelEvaluator()
        
    def build_model(self, input_shape: Tuple[int, int]) -> keras.Model:
        """Build LSTM model for energy forecasting"""
        model = keras.Sequential([
            keras.layers.LSTM(
                self.config['hidden_units'][0],
                return_sequences=True,
                input_shape=input_shape
            ),
            keras.layers.Dropout(self.config['dropout_rate']),
            keras.layers.LSTM(
                self.config['hidden_units'][1],
                return_sequences=True
            ),
            keras.layers.Dropout(self.config['dropout_rate']),
            keras.layers.LSTM(self.config['hidden_units'][2]),
            keras.layers.Dropout(self.config['dropout_rate']),
            keras.layers.Dense(self.config['prediction_horizon'])
        ])
        
        model.compile(
            optimizer=keras.optimizers.Adam(self.config['learning_rate']),
            loss='mse',
            metrics=['mae', 'mape']
        )
        
        return model
    
    def train(self, X_train: np.ndarray, y_train: np.ndarray,
              X_val: np.ndarray, y_val: np.ndarray) -> Dict[str, Any]:
        """Train the energy forecasting model"""
        input_shape = (X_train.shape[1], X_train.shape[2])
        self.model = self.build_model(input_shape)
        
        early_stopping = keras.callbacks.EarlyStopping(
            monitor='val_loss',
            patience=self.config['early_stopping_patience'],
            restore_best_weights=True
        )
        
        reduce_lr = keras.callbacks.ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=5,
            min_lr=1e-6
        )
        
        history = self.model.fit(
            X_train, y_train,
            validation_data=(X_val, y_val),
            epochs=self.config['epochs'],
            batch_size=self.config['batch_size'],
            callbacks=[early_stopping, reduce_lr],
            verbose=1
        )
        
        self.history = history.history
        return self.history
    
    def evaluate(self, X_test: np.ndarray, y_test: np.ndarray) -> Dict[str, float]:
        """Evaluate model performance"""
        predictions = self.model.predict(X_test)
        
        metrics = self.evaluator.evaluate_regression(
            y_test.flatten(),
            predictions.flatten()
        )
        
        return metrics
    
    def predict(self, X: np.ndarray) -> np.ndarray:
        """Make predictions"""
        return self.model.predict(X)
