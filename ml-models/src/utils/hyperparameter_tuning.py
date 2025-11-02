import numpy as np
from typing import Dict, List, Tuple, Any, Callable
import json
from datetime import datetime

class HyperparameterTuner:
    def __init__(self, param_space: Dict[str, List[Any]]):
        self.param_space = param_space
        self.results = []
        self.best_params = None
        self.best_score = float('-inf')
    
    def grid_search(
        self,
        train_func: Callable,
        eval_func: Callable,
        X_train: np.ndarray,
        y_train: np.ndarray,
        X_val: np.ndarray,
        y_val: np.ndarray
    ) -> Dict[str, Any]:
        """Perform grid search over parameter space"""
        param_combinations = self._generate_combinations()
        
        for i, params in enumerate(param_combinations):
            print(f"Testing combination {i+1}/{len(param_combinations)}: {params}")
            
            model = train_func(X_train, y_train, **params)
            score = eval_func(model, X_val, y_val)
            
            result = {
                'params': params,
                'score': score,
                'timestamp': datetime.now().isoformat()
            }
            
            self.results.append(result)
            
            if score > self.best_score:
                self.best_score = score
                self.best_params = params
        
        return {
            'best_params': self.best_params,
            'best_score': self.best_score,
            'all_results': self.results
        }
    
    def random_search(
        self,
        train_func: Callable,
        eval_func: Callable,
        X_train: np.ndarray,
        y_train: np.ndarray,
        X_val: np.ndarray,
        y_val: np.ndarray,
        n_iterations: int = 20
    ) -> Dict[str, Any]:
        """Perform random search over parameter space"""
        for i in range(n_iterations):
            params = self._sample_random_params()
            print(f"Testing iteration {i+1}/{n_iterations}: {params}")
            
            model = train_func(X_train, y_train, **params)
            score = eval_func(model, X_val, y_val)
            
            result = {
                'params': params,
                'score': score,
                'timestamp': datetime.now().isoformat()
            }
            
            self.results.append(result)
            
            if score > self.best_score:
                self.best_score = score
                self.best_params = params
        
        return {
            'best_params': self.best_params,
            'best_score': self.best_score,
            'all_results': self.results
        }
    
    def _generate_combinations(self) -> List[Dict[str, Any]]:
        """Generate all combinations of parameters"""
        keys = list(self.param_space.keys())
        values = [self.param_space[k] for k in keys]
        
        combinations = []
        self._recursive_combine(keys, values, 0, {}, combinations)
        
        return combinations
    
    def _recursive_combine(
        self,
        keys: List[str],
        values: List[List[Any]],
        index: int,
        current: Dict[str, Any],
        results: List[Dict[str, Any]]
    ):
        """Recursively generate parameter combinations"""
        if index == len(keys):
            results.append(current.copy())
            return
        
        for value in values[index]:
            current[keys[index]] = value
            self._recursive_combine(keys, values, index + 1, current, results)
    
    def _sample_random_params(self) -> Dict[str, Any]:
        """Sample random parameters from space"""
        params = {}
        for key, values in self.param_space.items():
            params[key] = np.random.choice(values)
        return params
    
    def save_results(self, filepath: str):
        """Save tuning results to file"""
        with open(filepath, 'w') as f:
            json.dump({
                'best_params': self.best_params,
                'best_score': self.best_score,
                'all_results': self.results
            }, f, indent=2)
    
    def load_results(self, filepath: str):
        """Load tuning results from file"""
        with open(filepath, 'r') as f:
            data = json.load(f)
            self.best_params = data['best_params']
            self.best_score = data['best_score']
            self.results = data['all_results']
