import numpy as np
from typing import Dict, List, Tuple
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score
import joblib

class ComfortOptimizationTrainer:
    def __init__(self):
        self.model = RandomForestRegressor(
            n_estimators=100,
            max_depth=10,
            random_state=42
        )
        self.feature_names = []
        self.is_trained = False
    
    def prepare_features(self, data: Dict) -> np.ndarray:
        features = []
        self.feature_names = [
            'temperature', 'humidity', 'light_level',
            'occupancy', 'time_of_day', 'day_of_week',
            'season', 'outdoor_temp'
        ]
        
        for feature in self.feature_names:
            features.append(data.get(feature, 0))
        
        return np.array(features).reshape(1, -1)
    
    def generate_training_data(self, num_samples: int = 1000) -> Tuple[np.ndarray, np.ndarray]:
        X = []
        y = []
        
        for _ in range(num_samples):
            temperature = np.random.uniform(18, 28)
            humidity = np.random.uniform(30, 70)
            light_level = np.random.uniform(0, 1000)
            occupancy = np.random.randint(0, 5)
            time_of_day = np.random.randint(0, 24)
            day_of_week = np.random.randint(0, 7)
            season = np.random.randint(0, 4)
            outdoor_temp = np.random.uniform(10, 35)
            
            comfort_score = self.calculate_comfort_score(
                temperature, humidity, light_level, occupancy,
                time_of_day, day_of_week, season, outdoor_temp
            )
            
            X.append([temperature, humidity, light_level, occupancy,
                     time_of_day, day_of_week, season, outdoor_temp])
            y.append(comfort_score)
        
        return np.array(X), np.array(y)
    
    def calculate_comfort_score(self, temp: float, humidity: float, 
                                light: float, occupancy: int,
                                hour: int, day: int, season: int, 
                                outdoor_temp: float) -> float:
        score = 100.0
        
        ideal_temp = 22.0
        temp_diff = abs(temp - ideal_temp)
        score -= temp_diff * 5
        
        if humidity < 40 or humidity > 60:
            score -= abs(humidity - 50) * 0.5
        
        if hour >= 6 and hour <= 22:
            if light < 300:
                score -= (300 - light) * 0.05
        else:
            if light > 100:
                score -= (light - 100) * 0.05
        
        if occupancy > 0:
            score += 10
        
        return max(0, min(100, score))
    
    def train(self, X: np.ndarray, y: np.ndarray) -> Dict:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )
        
        self.model.fit(X_train, y_train)
        self.is_trained = True
        
        y_pred = self.model.predict(X_test)
        
        metrics = {
            'mse': mean_squared_error(y_test, y_pred),
            'rmse': np.sqrt(mean_squared_error(y_test, y_pred)),
            'r2': r2_score(y_test, y_pred),
            'feature_importance': dict(zip(
                self.feature_names,
                self.model.feature_importances_
            ))
        }
        
        return metrics
    
    def predict(self, features: Dict) -> float:
        if not self.is_trained:
            raise ValueError("Model must be trained before prediction")
        
        X = self.prepare_features(features)
        return float(self.model.predict(X)[0])
    
    def optimize_settings(self, current_state: Dict, 
                         constraints: Dict) -> Dict:
        best_score = -1
        best_settings = {}
        
        temp_range = constraints.get('temperature_range', (20, 24))
        humidity_range = constraints.get('humidity_range', (40, 60))
        
        for temp in np.linspace(temp_range[0], temp_range[1], 10):
            for humidity in np.linspace(humidity_range[0], humidity_range[1], 10):
                test_state = current_state.copy()
                test_state['temperature'] = temp
                test_state['humidity'] = humidity
                
                score = self.predict(test_state)
                
                if score > best_score:
                    best_score = score
                    best_settings = {
                        'temperature': temp,
                        'humidity': humidity,
                        'comfort_score': score
                    }
        
        return best_settings
    
    def save_model(self, filepath: str):
        joblib.dump(self.model, filepath)
    
    def load_model(self, filepath: str):
        self.model = joblib.load(filepath)
        self.is_trained = True
