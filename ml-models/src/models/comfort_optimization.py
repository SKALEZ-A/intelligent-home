import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
import joblib
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ComfortOptimizationModel:
    """ML model for optimizing home comfort based on user preferences and environmental factors"""
    
    def __init__(self, model_path='models/comfort_optimization.pkl'):
        self.model_path = model_path
        self.temperature_model = None
        self.lighting_model = None
        self.scaler = StandardScaler()
        self.feature_names = []
        
    def prepare_features(self, df):
        """Prepare features for comfort optimization"""
        features = pd.DataFrame()
        
        # Time features
        features['hour'] = df['timestamp'].dt.hour
        features['day_of_week'] = df['timestamp'].dt.dayofweek
        features['is_weekend'] = (df['timestamp'].dt.dayofweek >= 5).astype(int)
        features['season'] = df['timestamp'].dt.month % 12 // 3
        
        # Environmental features
        features['outdoor_temperature'] = df['outdoor_temperature']
        features['outdoor_humidity'] = df['outdoor_humidity']
        features['solar_radiation'] = df['solar_radiation']
        features['cloud_cover'] = df['cloud_cover']
        
        # Occupancy features
        features['occupancy_count'] = df['occupancy_count']
        features['activity_level'] = df['activity_level']
        features['room_type'] = df['room_type'].astype('category').cat.codes
        
        # Historical preferences
        features['preferred_temp_history'] = df['preferred_temp_history']
        features['preferred_brightness_history'] = df['preferred_brightness_history']
        
        # Energy cost
        features['energy_price'] = df['energy_price']
        
        self.feature_names = features.columns.tolist()
        return features
    
    def train(self, data_path):
        """Train comfort optimization models"""
        logger.info(f"Loading training data from {data_path}")
        df = pd.read_csv(data_path)
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        
        # Prepare features
        X = self.prepare_features(df)
        y_temperature = df['optimal_temperature']
        y_lighting = df['optimal_brightness']
        
        # Scale features
        X_scaled = self.scaler.fit_transform(X)
        
        # Train temperature model
        logger.info("Training temperature optimization model")
        self.temperature_model = RandomForestRegressor(
            n_estimators=200,
            max_depth=15,
            min_samples_split=10,
            random_state=42,
            n_jobs=-1
        )
        self.temperature_model.fit(X_scaled, y_temperature)
        
        # Train lighting model
        logger.info("Training lighting optimization model")
        self.lighting_model = RandomForestRegressor(
            n_estimators=200,
            max_depth=15,
            min_samples_split=10,
            random_state=42,
            n_jobs=-1
        )
        self.lighting_model.fit(X_scaled, y_lighting)
        
        # Evaluate models
        temp_score = self.temperature_model.score(X_scaled, y_temperature)
        light_score = self.lighting_model.score(X_scaled, y_lighting)
        
        logger.info(f"Temperature Model R² Score: {temp_score:.4f}")
        logger.info(f"Lighting Model R² Score: {light_score:.4f}")
        
        return {
            'temperature_r2': temp_score,
            'lighting_r2': light_score
        }
    
    def predict_optimal_settings(self, features):
        """Predict optimal temperature and lighting settings"""
        if self.temperature_model is None or self.lighting_model is None:
            raise ValueError("Models not trained")
        
        features_scaled = self.scaler.transform(features)
        
        optimal_temperature = self.temperature_model.predict(features_scaled)
        optimal_brightness = self.lighting_model.predict(features_scaled)
        
        return {
            'temperature': optimal_temperature,
            'brightness': optimal_brightness
        }
    
    def save_model(self):
        """Save trained models"""
        model_data = {
            'temperature_model': self.temperature_model,
            'lighting_model': self.lighting_model,
            'scaler': self.scaler,
            'feature_names': self.feature_names
        }
        joblib.dump(model_data, self.model_path)
        logger.info(f"Models saved to {self.model_path}")
    
    def load_model(self):
        """Load trained models"""
        model_data = joblib.load(self.model_path)
        self.temperature_model = model_data['temperature_model']
        self.lighting_model = model_data['lighting_model']
        self.scaler = model_data['scaler']
        self.feature_names = model_data['feature_names']
        logger.info(f"Models loaded from {self.model_path}")
