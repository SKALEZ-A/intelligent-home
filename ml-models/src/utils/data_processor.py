import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import List, Dict, Any

class DataProcessor:
    @staticmethod
    def normalize_data(data: np.ndarray, method='minmax'):
        if method == 'minmax':
            min_val = np.min(data, axis=0)
            max_val = np.max(data, axis=0)
            return (data - min_val) / (max_val - min_val + 1e-8)
        elif method == 'zscore':
            mean = np.mean(data, axis=0)
            std = np.std(data, axis=0)
            return (data - mean) / (std + 1e-8)
        else:
            raise ValueError(f"Unknown normalization method: {method}")
    
    @staticmethod
    def handle_missing_values(data: pd.DataFrame, strategy='mean'):
        if strategy == 'mean':
            return data.fillna(data.mean())
        elif strategy == 'median':
            return data.fillna(data.median())
        elif strategy == 'forward_fill':
            return data.fillna(method='ffill')
        elif strategy == 'backward_fill':
            return data.fillna(method='bfill')
        elif strategy == 'interpolate':
            return data.interpolate()
        else:
            raise ValueError(f"Unknown strategy: {strategy}")
    
    @staticmethod
    def create_time_features(timestamps: List[datetime]) -> Dict[str, List[float]]:
        features = {
            'hour': [],
            'day_of_week': [],
            'day_of_month': [],
            'month': [],
            'is_weekend': [],
            'is_business_hours': []
        }
        
        for ts in timestamps:
            features['hour'].append(ts.hour / 24.0)
            features['day_of_week'].append(ts.weekday() / 7.0)
            features['day_of_month'].append(ts.day / 31.0)
            features['month'].append(ts.month / 12.0)
            features['is_weekend'].append(1.0 if ts.weekday() >= 5 else 0.0)
            features['is_business_hours'].append(
                1.0 if 9 <= ts.hour <= 17 and ts.weekday() < 5 else 0.0
            )
        
        return features
    
    @staticmethod
    def create_lag_features(data: np.ndarray, lags: List[int]) -> np.ndarray:
        lagged_data = []
        
        for lag in lags:
            if lag == 0:
                lagged_data.append(data)
            else:
                padded = np.pad(data, ((lag, 0), (0, 0)), mode='edge')
                lagged_data.append(padded[:-lag])
        
        return np.concatenate(lagged_data, axis=1)
    
    @staticmethod
    def create_rolling_features(data: pd.Series, windows: List[int]) -> pd.DataFrame:
        features = pd.DataFrame()
        
        for window in windows:
            features[f'rolling_mean_{window}'] = data.rolling(window=window).mean()
            features[f'rolling_std_{window}'] = data.rolling(window=window).std()
            features[f'rolling_min_{window}'] = data.rolling(window=window).min()
            features[f'rolling_max_{window}'] = data.rolling(window=window).max()
        
        return features.fillna(method='bfill')
    
    @staticmethod
    def detect_outliers(data: np.ndarray, method='iqr', threshold=1.5):
        if method == 'iqr':
            q1 = np.percentile(data, 25, axis=0)
            q3 = np.percentile(data, 75, axis=0)
            iqr = q3 - q1
            lower_bound = q1 - threshold * iqr
            upper_bound = q3 + threshold * iqr
            return (data < lower_bound) | (data > upper_bound)
        elif method == 'zscore':
            mean = np.mean(data, axis=0)
            std = np.std(data, axis=0)
            z_scores = np.abs((data - mean) / (std + 1e-8))
            return z_scores > threshold
        else:
            raise ValueError(f"Unknown method: {method}")
    
    @staticmethod
    def remove_outliers(data: np.ndarray, outlier_mask: np.ndarray):
        return data[~np.any(outlier_mask, axis=1)]
    
    @staticmethod
    def balance_dataset(X: np.ndarray, y: np.ndarray, method='oversample'):
        unique, counts = np.unique(y, return_counts=True)
        max_count = np.max(counts)
        
        if method == 'oversample':
            balanced_X, balanced_y = [], []
            
            for label in unique:
                mask = y == label
                X_class = X[mask]
                y_class = y[mask]
                
                if len(X_class) < max_count:
                    indices = np.random.choice(len(X_class), max_count, replace=True)
                    X_class = X_class[indices]
                    y_class = y_class[indices]
                
                balanced_X.append(X_class)
                balanced_y.append(y_class)
            
            return np.vstack(balanced_X), np.hstack(balanced_y)
        
        elif method == 'undersample':
            min_count = np.min(counts)
            balanced_X, balanced_y = [], []
            
            for label in unique:
                mask = y == label
                X_class = X[mask]
                y_class = y[mask]
                
                if len(X_class) > min_count:
                    indices = np.random.choice(len(X_class), min_count, replace=False)
                    X_class = X_class[indices]
                    y_class = y_class[indices]
                
                balanced_X.append(X_class)
                balanced_y.append(y_class)
            
            return np.vstack(balanced_X), np.hstack(balanced_y)
        
        else:
            raise ValueError(f"Unknown method: {method}")
