import numpy as np
import pandas as pd
from scipy import stats, signal
from statsmodels.tsa.seasonal import seasonal_decompose
from statsmodels.tsa.stattools import adfuller, acf, pacf
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TimeSeriesAnalysis:
    """Advanced time series analysis utilities"""
    
    @staticmethod
    def decompose(data, period=24, model='additive'):
        """Decompose time series into trend, seasonal, and residual components"""
        try:
            result = seasonal_decompose(data, model=model, period=period)
            return {
                'trend': result.trend,
                'seasonal': result.seasonal,
                'residual': result.resid
            }
        except Exception as e:
            logger.error(f"Decomposition failed: {e}")
            return None
    
    @staticmethod
    def detect_stationarity(data, significance_level=0.05):
        """Test if time series is stationary using Augmented Dickey-Fuller test"""
        result = adfuller(data.dropna())
        
        is_stationary = result[1] < significance_level
        
        return {
            'is_stationary': is_stationary,
            'adf_statistic': result[0],
            'p_value': result[1],
            'critical_values': result[4],
            'interpretation': 'Stationary' if is_stationary else 'Non-stationary'
        }
    
    @staticmethod
    def calculate_autocorrelation(data, nlags=40):
        """Calculate autocorrelation function"""
        acf_values = acf(data.dropna(), nlags=nlags)
        pacf_values = pacf(data.dropna(), nlags=nlags)
        
        return {
            'acf': acf_values,
            'pacf': pacf_values,
            'lags': np.arange(len(acf_values))
        }
    
    @staticmethod
    def detect_outliers(data, method='iqr', threshold=1.5):
        """Detect outliers in time series data"""
        if method == 'iqr':
            Q1 = np.percentile(data, 25)
            Q3 = np.percentile(data, 75)
            IQR = Q3 - Q1
            
            lower_bound = Q1 - threshold * IQR
            upper_bound = Q3 + threshold * IQR
            
            outliers = (data < lower_bound) | (data > upper_bound)
            
        elif method == 'zscore':
            z_scores = np.abs(stats.zscore(data))
            outliers = z_scores > threshold
            
        elif method == 'mad':
            median = np.median(data)
            mad = np.median(np.abs(data - median))
            modified_z_scores = 0.6745 * (data - median) / mad
            outliers = np.abs(modified_z_scores) > threshold
            
        else:
            raise ValueError(f"Unknown outlier detection method: {method}")
        
        return {
            'outliers': outliers,
            'outlier_indices': np.where(outliers)[0],
            'outlier_values': data[outliers],
            'outlier_count': np.sum(outliers)
        }
    
    @staticmethod
    def detect_changepoints(data, penalty=1.0):
        """Detect change points in time series"""
        # Simple change point detection using cumulative sum
        cumsum = np.cumsum(data - np.mean(data))
        
        # Find local maxima and minima
        peaks, _ = signal.find_peaks(np.abs(cumsum), distance=len(data)//10)
        
        return {
            'changepoints': peaks,
            'cumsum': cumsum
        }
    
    @staticmethod
    def calculate_rolling_statistics(data, window=24):
        """Calculate rolling statistics"""
        df = pd.DataFrame({'value': data})
        
        return {
            'rolling_mean': df['value'].rolling(window=window).mean(),
            'rolling_std': df['value'].rolling(window=window).std(),
            'rolling_min': df['value'].rolling(window=window).min(),
            'rolling_max': df['value'].rolling(window=window).max(),
            'rolling_median': df['value'].rolling(window=window).median()
        }
    
    @staticmethod
    def calculate_trend(data, method='linear'):
        """Calculate trend in time series"""
        x = np.arange(len(data))
        
        if method == 'linear':
            slope, intercept, r_value, p_value, std_err = stats.linregress(x, data)
            trend = slope * x + intercept
            
            return {
                'trend': trend,
                'slope': slope,
                'intercept': intercept,
                'r_squared': r_value**2,
                'p_value': p_value
            }
        
        elif method == 'polynomial':
            degree = 2
            coeffs = np.polyfit(x, data, degree)
            trend = np.polyval(coeffs, x)
            
            return {
                'trend': trend,
                'coefficients': coeffs
            }
        
        else:
            raise ValueError(f"Unknown trend method: {method}")
    
    @staticmethod
    def detect_seasonality(data, max_period=365):
        """Detect seasonal patterns using FFT"""
        # Remove trend
        detrended = signal.detrend(data)
        
        # Apply FFT
        fft = np.fft.fft(detrended)
        frequencies = np.fft.fftfreq(len(data))
        
        # Find dominant frequencies
        power = np.abs(fft)**2
        positive_freq_idx = frequencies > 0
        
        dominant_freq_idx = np.argmax(power[positive_freq_idx])
        dominant_freq = frequencies[positive_freq_idx][dominant_freq_idx]
        
        if dominant_freq > 0:
            period = 1 / dominant_freq
        else:
            period = None
        
        return {
            'has_seasonality': period is not None and period <= max_period,
            'period': period,
            'dominant_frequency': dominant_freq,
            'power_spectrum': power[positive_freq_idx]
        }
    
    @staticmethod
    def interpolate_missing(data, method='linear'):
        """Interpolate missing values in time series"""
        df = pd.DataFrame({'value': data})
        
        if method == 'linear':
            interpolated = df['value'].interpolate(method='linear')
        elif method == 'spline':
            interpolated = df['value'].interpolate(method='spline', order=3)
        elif method == 'polynomial':
            interpolated = df['value'].interpolate(method='polynomial', order=2)
        else:
            interpolated = df['value'].fillna(method='ffill').fillna(method='bfill')
        
        return interpolated.values
    
    @staticmethod
    def calculate_volatility(data, window=24):
        """Calculate rolling volatility"""
        df = pd.DataFrame({'value': data})
        returns = df['value'].pct_change()
        volatility = returns.rolling(window=window).std() * np.sqrt(window)
        
        return volatility.values
    
    @staticmethod
    def detect_cycles(data, min_period=2, max_period=365):
        """Detect cyclical patterns in time series"""
        # Autocorrelation-based cycle detection
        acf_values = acf(data, nlags=max_period)
        
        # Find peaks in autocorrelation
        peaks, properties = signal.find_peaks(
            acf_values[min_period:],
            distance=min_period,
            prominence=0.1
        )
        
        cycles = peaks + min_period
        
        return {
            'cycles': cycles,
            'cycle_strengths': acf_values[cycles],
            'primary_cycle': cycles[0] if len(cycles) > 0 else None
        }

class PatternRecognition:
    """Pattern recognition in time series"""
    
    @staticmethod
    def find_patterns(data, pattern, threshold=0.9):
        """Find occurrences of a pattern in time series"""
        pattern_length = len(pattern)
        correlations = []
        
        for i in range(len(data) - pattern_length + 1):
            window = data[i:i + pattern_length]
            correlation = np.corrcoef(window, pattern)[0, 1]
            correlations.append(correlation)
        
        matches = np.array(correlations) > threshold
        match_indices = np.where(matches)[0]
        
        return {
            'matches': match_indices,
            'correlations': np.array(correlations),
            'match_count': len(match_indices)
        }
    
    @staticmethod
    def extract_motifs(data, motif_length=24, num_motifs=5):
        """Extract recurring motifs from time series"""
        n = len(data)
        motifs = []
        
        for i in range(n - motif_length + 1):
            motif = data[i:i + motif_length]
            
            # Find similar patterns
            similarities = []
            for j in range(n - motif_length + 1):
                if abs(i - j) > motif_length:  # Avoid trivial matches
                    window = data[j:j + motif_length]
                    similarity = np.corrcoef(motif, window)[0, 1]
                    similarities.append((j, similarity))
            
            if similarities:
                max_similarity = max(similarities, key=lambda x: x[1])
                if max_similarity[1] > 0.8:
                    motifs.append({
                        'position': i,
                        'motif': motif,
                        'similarity': max_similarity[1],
                        'match_position': max_similarity[0]
                    })
        
        # Sort by similarity and return top motifs
        motifs.sort(key=lambda x: x['similarity'], reverse=True)
        return motifs[:num_motifs]
