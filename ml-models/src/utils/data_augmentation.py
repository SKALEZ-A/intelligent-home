import numpy as np
from typing import List, Tuple, Optional
import random

class DataAugmentation:
    def __init__(self, seed: Optional[int] = None):
        if seed is not None:
            np.random.seed(seed)
            random.seed(seed)
    
    def add_noise(self, data: np.ndarray, noise_level: float = 0.01) -> np.ndarray:
        noise = np.random.normal(0, noise_level, data.shape)
        return data + noise
    
    def time_shift(self, data: np.ndarray, shift_range: int = 5) -> np.ndarray:
        shift = random.randint(-shift_range, shift_range)
        return np.roll(data, shift, axis=0)
    
    def scale(self, data: np.ndarray, scale_range: Tuple[float, float] = (0.9, 1.1)) -> np.ndarray:
        scale_factor = random.uniform(*scale_range)
        return data * scale_factor
    
    def window_slice(self, data: np.ndarray, window_size: int) -> np.ndarray:
        if len(data) <= window_size:
            return data
        
        start_idx = random.randint(0, len(data) - window_size)
        return data[start_idx:start_idx + window_size]
    
    def interpolate(self, data: np.ndarray, factor: float = 1.5) -> np.ndarray:
        original_length = len(data)
        new_length = int(original_length * factor)
        
        indices = np.linspace(0, original_length - 1, new_length)
        interpolated = np.interp(indices, np.arange(original_length), data)
        
        return interpolated
    
    def add_dropout(self, data: np.ndarray, dropout_rate: float = 0.1) -> np.ndarray:
        mask = np.random.random(data.shape) > dropout_rate
        return data * mask
    
    def mixup(self, data1: np.ndarray, data2: np.ndarray, alpha: float = 0.2) -> np.ndarray:
        lam = np.random.beta(alpha, alpha)
        return lam * data1 + (1 - lam) * data2
    
    def augment_batch(self, data: np.ndarray, augmentation_factor: int = 2) -> np.ndarray:
        augmented_data = [data]
        
        for _ in range(augmentation_factor - 1):
            aug_choice = random.choice(['noise', 'shift', 'scale'])
            
            if aug_choice == 'noise':
                augmented_data.append(self.add_noise(data))
            elif aug_choice == 'shift':
                augmented_data.append(self.time_shift(data))
            elif aug_choice == 'scale':
                augmented_data.append(self.scale(data))
        
        return np.concatenate(augmented_data, axis=0)
    
    def create_synthetic_samples(self, data: np.ndarray, labels: np.ndarray, 
                                 num_samples: int) -> Tuple[np.ndarray, np.ndarray]:
        synthetic_data = []
        synthetic_labels = []
        
        for _ in range(num_samples):
            idx1, idx2 = random.sample(range(len(data)), 2)
            
            if np.array_equal(labels[idx1], labels[idx2]):
                synthetic_sample = self.mixup(data[idx1], data[idx2])
                synthetic_data.append(synthetic_sample)
                synthetic_labels.append(labels[idx1])
        
        return np.array(synthetic_data), np.array(synthetic_labels)

def augment_time_series(data: np.ndarray, method: str = 'all') -> List[np.ndarray]:
    augmenter = DataAugmentation()
    augmented = []
    
    if method in ['noise', 'all']:
        augmented.append(augmenter.add_noise(data))
    
    if method in ['shift', 'all']:
        augmented.append(augmenter.time_shift(data))
    
    if method in ['scale', 'all']:
        augmented.append(augmenter.scale(data))
    
    return augmented if augmented else [data]
