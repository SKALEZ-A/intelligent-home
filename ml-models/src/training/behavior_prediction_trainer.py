import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
from sklearn.preprocessing import StandardScaler
import joblib
import logging
from datetime import datetime, timedelta

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class BehaviorPredictionTrainer:
    def __init__(self, model_path='models/behavior_prediction.pkl'):
        self.model_path = model_path
        self.model = None
        self.scaler = StandardScaler()
        self.feature_names = []
        
    def prepare_features(self, df):
        """Prepare features for behavior prediction"""
        features = pd.DataFrame()
        
        # Time-based features
        features['hour'] = df['timestamp'].dt.hour
        features['day_of_week'] = df['timestamp'].dt.dayofweek
        features['is_weekend'] = (df['timestamp'].dt.dayofweek >= 5).astype(int)
        features['month'] = df['timestamp'].dt.month
        
        # Device usage patterns
        features['devices_active'] = df['devices_active']
        features['avg_device_usage'] = df['avg_device_usage']
        features['peak_usage_hour'] = df['peak_usage_hour']
        
        # Historical patterns
        features['usage_last_hour'] = df['usage_last_hour']
        features['usage_same_time_yesterday'] = df['usage_same_time_yesterday']
        features['usage_same_time_last_week'] = df['usage_same_time_last_week']
        
        # Environmental factors
        features['temperature'] = df['temperature']
        features['humidity'] = df['humidity']
        features['is_daylight'] = df['is_daylight']
        
        # User presence indicators
        features['motion_detected'] = df['motion_detected']
        features['doors_opened'] = df['doors_opened']
        features['lights_on'] = df['lights_on']
        
        self.feature_names = features.columns.tolist()
        return features
    
    def train(self, data_path, test_size=0.2, random_state=42):
        """Train the behavior prediction model"""
        logger.info(f"Loading training data from {data_path}")
        df = pd.read_csv(data_path)
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        
        # Prepare features and target
        X = self.prepare_features(df)
        y = df['behavior_class']  # e.g., 'home', 'away', 'sleeping', 'active'
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=random_state, stratify=y
        )
        
        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        # Train model
        logger.info("Training Random Forest model")
        self.model = RandomForestClassifier(
            n_estimators=200,
            max_depth=15,
            min_samples_split=10,
            min_samples_leaf=5,
            random_state=random_state,
            n_jobs=-1
        )
        
        self.model.fit(X_train_scaled, y_train)
        
        # Evaluate
        y_pred = self.model.predict(X_test_scaled)
        
        accuracy = accuracy_score(y_test, y_pred)
        precision = precision_score(y_test, y_pred, average='weighted')
        recall = recall_score(y_test, y_pred, average='weighted')
        f1 = f1_score(y_test, y_pred, average='weighted')
        
        logger.info(f"Model Performance:")
        logger.info(f"  Accuracy: {accuracy:.4f}")
        logger.info(f"  Precision: {precision:.4f}")
        logger.info(f"  Recall: {recall:.4f}")
        logger.info(f"  F1 Score: {f1:.4f}")
        
        # Feature importance
        feature_importance = pd.DataFrame({
            'feature': self.feature_names,
            'importance': self.model.feature_importances_
        }).sort_values('importance', ascending=False)
        
        logger.info("\nTop 10 Important Features:")
        logger.info(feature_importance.head(10).to_string())
        
        # Cross-validation
        cv_scores = cross_val_score(self.model, X_train_scaled, y_train, cv=5)
        logger.info(f"\nCross-validation scores: {cv_scores}")
        logger.info(f"Mean CV score: {cv_scores.mean():.4f} (+/- {cv_scores.std() * 2:.4f})")
        
        return {
            'accuracy': accuracy,
            'precision': precision,
            'recall': recall,
            'f1_score': f1,
            'cv_scores': cv_scores.tolist(),
            'feature_importance': feature_importance.to_dict('records')
        }
    
    def save_model(self):
        """Save the trained model"""
        if self.model is None:
            raise ValueError("No model to save. Train the model first.")
        
        model_data = {
            'model': self.model,
            'scaler': self.scaler,
            'feature_names': self.feature_names,
            'trained_at': datetime.now().isoformat()
        }
        
        joblib.dump(model_data, self.model_path)
        logger.info(f"Model saved to {self.model_path}")
    
    def load_model(self):
        """Load a trained model"""
        model_data = joblib.load(self.model_path)
        self.model = model_data['model']
        self.scaler = model_data['scaler']
        self.feature_names = model_data['feature_names']
        logger.info(f"Model loaded from {self.model_path}")
        
    def predict(self, features):
        """Make predictions"""
        if self.model is None:
            raise ValueError("No model loaded. Load or train a model first.")
        
        features_scaled = self.scaler.transform(features)
        predictions = self.model.predict(features_scaled)
        probabilities = self.model.predict_proba(features_scaled)
        
        return predictions, probabilities

if __name__ == '__main__':
    trainer = BehaviorPredictionTrainer()
    metrics = trainer.train('data/behavior_data.csv')
    trainer.save_model()
