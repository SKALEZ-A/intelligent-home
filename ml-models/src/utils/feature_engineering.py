import numpy as np
import pandas as pd
from typing import List, Dict, Any
from scipy import stats
from scipy.fft import fft

class FeatureEngineering:
    @staticmethod
    def extract_statistical_features(data: np.ndarray) -> Dict[str, float]:
        return {
            'mean': np.mean(data),
            'std': np.std(data),
            'min': np.min(data),
            'max': np.max(data),
            'median': np.median(data),
            'q25': np.percentile(data, 25),
            'q75': np.percentile(data, 75),
            'skewness': stats.skew(data),
            'kurtosis': stats.kurtosis(data),
            'range': np.ptp(data)
        }
    
    @staticmethod
    def extract_time_features(timestamps: pd.Series) -> pd.DataFrame:
        df = pd.DataFrame()
        df['hour'] = timestamps.dt.hour
        df['day_of_week'] = timestamps.dt.dayofweek
        df['day_of_month'] = timestamps.dt.day
        df['month'] = timestamps.dt.month
        df['quarter'] = timestamps.dt.quarter
        df['is_weekend'] = timestamps.dt.dayofweek.isin([5, 6]).astype(int)
        df['is_business_hour'] = timestamps.dt.hour.between(9, 17).astype(int)
        
        return df
    
    @staticmethod
    def extract_frequency_features(data: np.ndarray, sample_rate: float = 1.0) -> Dict[str, float]:
        fft_values = fft(data)
        power_spectrum = np.abs(fft_values) ** 2
        frequencies = np.fft.fftfreq(len(data), 1/sample_rate)
        
        positive_freq_idx = frequencies > 0
        positive_freqs = frequencies[positive_freq_idx]
        positive_power = power_spectrum[positive_freq_idx]
        
        dominant_freq_idx = np.argmax(positive_power)
        
        return {
            'dominant_frequency': positive_freqs[dominant_freq_idx],
            'spectral_energy': np.sum(power_spectrum),
            'spectral_entropy': stats.entropy(positive_power + 1e-10),
            'spectral_centroid': np.sum(positive_freqs * positive_power) / np.sum(positive_power)
        }
    
    @staticmethod
    def create_lag_features(data: pd.Series, lags: List[int]) -> pd.DataFrame:
        df = pd.DataFrame()
        
        for lag in lags:
            df[f'lag_{lag}'] = data.shift(lag)
        
        return df
    
    @staticmethod
    def create_rolling_features(data: pd.Series, windows: List[int]) -> pd.DataFrame:
        df = pd.DataFrame()
        
        for window in windows:
            df[f'rolling_mean_{window}'] = data.rolling(window=window).mean()
            df[f'rolling_std_{window}'] = data.rolling(window=window).std()
            df[f'rolling_min_{window}'] = data.rolling(window=window).min()
            df[f'rolling_max_{window}'] = data.rolling(window=window).max()
        
        return df
    
    @staticmethod
    def create_interaction_features(df: pd.DataFrame, feature_pairs: List[tuple]) -> pd.DataFrame:
        interaction_df = pd.DataFrame()
        
        for feat1, feat2 in feature_pairs:
            if feat1 in df.columns and feat2 in df.columns:
                interaction_df[f'{feat1}_x_{feat2}'] = df[feat1] * df[feat2]
                interaction_df[f'{feat1}_div_{feat2}'] = df[feat1] / (df[feat2] + 1e-10)
        
        return interaction_df
    
    @staticmethod
    def create_polynomial_features(df: pd.DataFrame, features: List[str], degree: int = 2) -> pd.DataFrame:
        poly_df = pd.DataFrame()
        
        for feature in features:
            if feature in df.columns:
                for d in range(2, degree + 1):
                    poly_df[f'{feature}_pow_{d}'] = df[feature] ** d
        
        return poly_df
    
    @staticmethod
    def extract_change_features(data: pd.Series) -> pd.DataFrame:
        df = pd.DataFrame()
        df['diff_1'] = data.diff(1)
        df['diff_2'] = data.diff(2)
        df['pct_change'] = data.pct_change()
        df['cumsum'] = data.cumsum()
        
        return df

def engineer_features(data: pd.DataFrame, config: Dict[str, Any]) -> pd.DataFrame:
    fe = FeatureEngineering()
    feature_dfs = [data]
    
    if config.get('time_features') and 'timestamp' in data.columns:
        time_features = fe.extract_time_features(pd.to_datetime(data['timestamp']))
        feature_dfs.append(time_features)
    
    if config.get('lag_features'):
        for col in config['lag_features']['columns']:
            if col in data.columns:
                lag_features = fe.create_lag_features(data[col], config['lag_features']['lags'])
                feature_dfs.append(lag_features)
    
    if config.get('rolling_features'):
        for col in config['rolling_features']['columns']:
            if col in data.columns:
                rolling_features = fe.create_rolling_features(data[col], config['rolling_features']['windows'])
                feature_dfs.append(rolling_features)
    
    return pd.concat(feature_dfs, axis=1)
