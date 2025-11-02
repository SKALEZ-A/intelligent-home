import numpy as np
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
from typing import Dict, Any

class ModelEvaluator:
    @staticmethod
    def evaluate_regression(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
        """Evaluate regression model performance"""
        mse = mean_squared_error(y_true, y_pred)
        rmse = np.sqrt(mse)
        mae = mean_absolute_error(y_true, y_pred)
        r2 = r2_score(y_true, y_pred)
        
        mape = np.mean(np.abs((y_true - y_pred) / y_true)) * 100
        
        return {
            'mse': float(mse),
            'rmse': float(rmse),
            'mae': float(mae),
            'r2': float(r2),
            'mape': float(mape)
        }
    
    @staticmethod
    def evaluate_classification(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
        """Evaluate classification model performance"""
        accuracy = accuracy_score(y_true, y_pred)
        precision = precision_score(y_true, y_pred, average='weighted', zero_division=0)
        recall = recall_score(y_true, y_pred, average='weighted', zero_division=0)
        f1 = f1_score(y_true, y_pred, average='weighted', zero_division=0)
        
        return {
            'accuracy': float(accuracy),
            'precision': float(precision),
            'recall': float(recall),
            'f1_score': float(f1)
        }
    
    @staticmethod
    def calculate_confidence_interval(data: np.ndarray, confidence: float = 0.95) -> Dict[str, float]:
        """Calculate confidence interval for predictions"""
        mean = np.mean(data)
        std = np.std(data)
        n = len(data)
        
        z_score = 1.96 if confidence == 0.95 else 2.576
        margin = z_score * (std / np.sqrt(n))
        
        return {
            'mean': float(mean),
            'lower_bound': float(mean - margin),
            'upper_bound': float(mean + margin),
            'confidence': confidence
        }
