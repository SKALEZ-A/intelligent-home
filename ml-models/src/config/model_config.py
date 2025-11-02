from typing import Dict, Any

class ModelConfig:
    ENERGY_FORECASTING = {
        'sequence_length': 24,
        'prediction_horizon': 12,
        'hidden_units': [128, 64, 32],
        'dropout_rate': 0.2,
        'learning_rate': 0.001,
        'batch_size': 32,
        'epochs': 100,
        'early_stopping_patience': 10,
    }
    
    ANOMALY_DETECTION = {
        'contamination': 0.1,
        'n_estimators': 100,
        'max_samples': 256,
        'threshold': 0.8,
        'window_size': 50,
    }
    
    BEHAVIOR_PREDICTION = {
        'sequence_length': 48,
        'hidden_units': [256, 128, 64],
        'dropout_rate': 0.3,
        'learning_rate': 0.0005,
        'batch_size': 64,
        'epochs': 150,
    }
    
    OCCUPANCY_DETECTION = {
        'n_estimators': 200,
        'max_depth': 10,
        'min_samples_split': 5,
        'min_samples_leaf': 2,
        'features': ['motion', 'temperature', 'humidity', 'light', 'sound'],
    }
    
    PREDICTIVE_MAINTENANCE = {
        'sequence_length': 100,
        'threshold': 0.7,
        'warning_threshold': 0.5,
        'features': ['usage_hours', 'error_count', 'temperature', 'vibration'],
    }
    
    @classmethod
    def get_config(cls, model_type: str) -> Dict[str, Any]:
        configs = {
            'energy_forecasting': cls.ENERGY_FORECASTING,
            'anomaly_detection': cls.ANOMALY_DETECTION,
            'behavior_prediction': cls.BEHAVIOR_PREDICTION,
            'occupancy_detection': cls.OCCUPANCY_DETECTION,
            'predictive_maintenance': cls.PREDICTIVE_MAINTENANCE,
        }
        return configs.get(model_type, {})
