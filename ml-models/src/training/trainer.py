import numpy as np
from typing import Dict, Any, Tuple
from sklearn.model_selection import train_test_split
import joblib
import os

class ModelTrainer:
    def __init__(self, model_type: str, config: Dict[str, Any]):
        self.model_type = model_type
        self.config = config
        self.model = None
        self.history = {}
        
    def prepare_data(self, X: np.ndarray, y: np.ndarray, test_size: float = 0.2) -> Tuple:
        """Split data into training and validation sets"""
        return train_test_split(X, y, test_size=test_size, random_state=42)
    
    def train(self, X_train: np.ndarray, y_train: np.ndarray, 
              X_val: np.ndarray, y_val: np.ndarray) -> Dict[str, Any]:
        """Train the model"""
        raise NotImplementedError("Subclasses must implement train method")
    
    def evaluate(self, X_test: np.ndarray, y_test: np.ndarray) -> Dict[str, float]:
        """Evaluate model performance"""
        raise NotImplementedError("Subclasses must implement evaluate method")
    
    def save_model(self, path: str) -> None:
        """Save trained model to disk"""
        os.makedirs(os.path.dirname(path), exist_ok=True)
        joblib.dump(self.model, path)
        print(f"Model saved to {path}")
    
    def load_model(self, path: str) -> None:
        """Load model from disk"""
        self.model = joblib.load(path)
        print(f"Model loaded from {path}")
    
    def get_training_history(self) -> Dict[str, Any]:
        """Get training history"""
        return self.history
