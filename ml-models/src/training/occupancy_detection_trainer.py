import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
import joblib
import json
from datetime import datetime

class OccupancyDetectionTrainer:
    def __init__(self, model_path='models/occupancy_detection.pkl'):
        self.model_path = model_path
        self.model = None
        self.feature_names = [
            'temperature', 'humidity', 'light_level', 'co2_level',
            'sound_level', 'motion_detected', 'door_status', 'time_of_day',
            'day_of_week', 'historical_occupancy'
        ]
        
    def prepare_data(self, raw_data):
        X = []
        y = []
        
        for record in raw_data:
            features = [
                record.get('temperature', 0),
                record.get('humidity', 0),
                record.get('light_level', 0),
                record.get('co2_level', 0),
                record.get('sound_level', 0),
                1 if record.get('motion_detected') else 0,
                1 if record.get('door_status') == 'open' else 0,
                record.get('time_of_day', 0),
                record.get('day_of_week', 0),
                record.get('historical_occupancy', 0)
            ]
            X.append(features)
            y.append(1 if record.get('occupied') else 0)
            
        return np.array(X), np.array(y)
    
    def train(self, training_data, validation_split=0.2):
        print("Preparing training data...")
        X, y = self.prepare_data(training_data)
        
        X_train, X_val, y_train, y_val = train_test_split(
            X, y, test_size=validation_split, random_state=42
        )
        
        print(f"Training on {len(X_train)} samples...")
        self.model = RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            min_samples_split=5,
            random_state=42
        )
        
        self.model.fit(X_train, y_train)
        
        train_predictions = self.model.predict(X_train)
        val_predictions = self.model.predict(X_val)
        
        metrics = {
            'train_accuracy': accuracy_score(y_train, train_predictions),
            'val_accuracy': accuracy_score(y_val, val_predictions),
            'precision': precision_score(y_val, val_predictions),
            'recall': recall_score(y_val, val_predictions),
            'f1_score': f1_score(y_val, val_predictions),
            'feature_importance': dict(zip(
                self.feature_names,
                self.model.feature_importances_.tolist()
            )),
            'trained_at': datetime.now().isoformat()
        }
        
        print(f"Training complete. Validation accuracy: {metrics['val_accuracy']:.4f}")
        return metrics
    
    def save_model(self):
        if self.model is None:
            raise ValueError("No model to save. Train the model first.")
        
        joblib.dump(self.model, self.model_path)
        print(f"Model saved to {self.model_path}")
        
    def load_model(self):
        self.model = joblib.load(self.model_path)
        print(f"Model loaded from {self.model_path}")
        
    def predict(self, sensor_data):
        if self.model is None:
            raise ValueError("No model loaded. Load or train a model first.")
        
        features = np.array([[
            sensor_data.get('temperature', 0),
            sensor_data.get('humidity', 0),
            sensor_data.get('light_level', 0),
            sensor_data.get('co2_level', 0),
            sensor_data.get('sound_level', 0),
            1 if sensor_data.get('motion_detected') else 0,
            1 if sensor_data.get('door_status') == 'open' else 0,
            sensor_data.get('time_of_day', 0),
            sensor_data.get('day_of_week', 0),
            sensor_data.get('historical_occupancy', 0)
        ]])
        
        prediction = self.model.predict(features)[0]
        probability = self.model.predict_proba(features)[0]
        
        return {
            'occupied': bool(prediction),
            'confidence': float(max(probability)),
            'probability_occupied': float(probability[1]),
            'probability_vacant': float(probability[0])
        }
