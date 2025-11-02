import numpy as np
from typing import List, Dict, Tuple
from collections import defaultdict

class RecommendationEngine:
    def __init__(self, num_factors: int = 20):
        self.num_factors = num_factors
        self.user_factors = {}
        self.item_factors = {}
        self.user_biases = {}
        self.item_biases = {}
        self.global_mean = 0.0
        self.user_to_idx = {}
        self.item_to_idx = {}
        
    def fit(self, interactions: List[Tuple[str, str, float]], epochs: int = 20, learning_rate: float = 0.01, regularization: float = 0.02):
        users = set()
        items = set()
        ratings = []
        
        for user, item, rating in interactions:
            users.add(user)
            items.add(item)
            ratings.append(rating)
        
        self.user_to_idx = {user: idx for idx, user in enumerate(users)}
        self.item_to_idx = {item: idx for idx, item in enumerate(items)}
        
        num_users = len(users)
        num_items = len(items)
        
        self.global_mean = np.mean(ratings)
        
        self.user_factors = np.random.normal(0, 0.1, (num_users, self.num_factors))
        self.item_factors = np.random.normal(0, 0.1, (num_items, self.num_factors))
        self.user_biases = np.zeros(num_users)
        self.item_biases = np.zeros(num_items)
        
        for epoch in range(epochs):
            total_error = 0
            
            for user, item, rating in interactions:
                user_idx = self.user_to_idx[user]
                item_idx = self.item_to_idx[item]
                
                prediction = self.predict_rating(user, item)
                error = rating - prediction
                total_error += error ** 2
                
                user_factor = self.user_factors[user_idx]
                item_factor = self.item_factors[item_idx]
                
                self.user_factors[user_idx] += learning_rate * (error * item_factor - regularization * user_factor)
                self.item_factors[item_idx] += learning_rate * (error * user_factor - regularization * item_factor)
                
                self.user_biases[user_idx] += learning_rate * (error - regularization * self.user_biases[user_idx])
                self.item_biases[item_idx] += learning_rate * (error - regularization * self.item_biases[item_idx])
            
            rmse = np.sqrt(total_error / len(interactions))
            print(f"Epoch {epoch + 1}/{epochs}, RMSE: {rmse:.4f}")
    
    def predict_rating(self, user: str, item: str) -> float:
        if user not in self.user_to_idx or item not in self.item_to_idx:
            return self.global_mean
        
        user_idx = self.user_to_idx[user]
        item_idx = self.item_to_idx[item]
        
        prediction = self.global_mean
        prediction += self.user_biases[user_idx]
        prediction += self.item_biases[item_idx]
        prediction += np.dot(self.user_factors[user_idx], self.item_factors[item_idx])
        
        return prediction
    
    def recommend_items(self, user: str, n: int = 10, exclude_items: List[str] = None) -> List[Tuple[str, float]]:
        if user not in self.user_to_idx:
            return []
        
        if exclude_items is None:
            exclude_items = []
        
        exclude_indices = {self.item_to_idx[item] for item in exclude_items if item in self.item_to_idx}
        
        recommendations = []
        idx_to_item = {idx: item for item, idx in self.item_to_idx.items()}
        
        for item_idx in range(len(self.item_factors)):
            if item_idx not in exclude_indices:
                item = idx_to_item[item_idx]
                score = self.predict_rating(user, item)
                recommendations.append((item, score))
        
        recommendations.sort(key=lambda x: x[1], reverse=True)
        return recommendations[:n]
    
    def find_similar_items(self, item: str, n: int = 10) -> List[Tuple[str, float]]:
        if item not in self.item_to_idx:
            return []
        
        item_idx = self.item_to_idx[item]
        item_vector = self.item_factors[item_idx]
        
        similarities = []
        idx_to_item = {idx: itm for itm, idx in self.item_to_idx.items()}
        
        for other_idx in range(len(self.item_factors)):
            if other_idx != item_idx:
                other_vector = self.item_factors[other_idx]
                similarity = self.cosine_similarity(item_vector, other_vector)
                similarities.append((idx_to_item[other_idx], similarity))
        
        similarities.sort(key=lambda x: x[1], reverse=True)
        return similarities[:n]
    
    def cosine_similarity(self, vec1: np.ndarray, vec2: np.ndarray) -> float:
        dot_product = np.dot(vec1, vec2)
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        return dot_product / (norm1 * norm2)
    
    def get_user_profile(self, user: str) -> Dict:
        if user not in self.user_to_idx:
            return {}
        
        user_idx = self.user_to_idx[user]
        
        return {
            'factors': self.user_factors[user_idx].tolist(),
            'bias': float(self.user_biases[user_idx]),
            'top_features': self.get_top_features(self.user_factors[user_idx])
        }
    
    def get_top_features(self, factor_vector: np.ndarray, n: int = 5) -> List[int]:
        top_indices = np.argsort(np.abs(factor_vector))[-n:][::-1]
        return top_indices.tolist()
