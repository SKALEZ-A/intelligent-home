import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.recommendation_engine import RecommendationEngine
import numpy as np

class RecommendationTrainer:
    def __init__(self, num_factors: int = 20):
        self.model = RecommendationEngine(num_factors=num_factors)
        
    def generate_sample_interactions(self, num_users: int = 100, num_items: int = 50, num_interactions: int = 2000):
        interactions = []
        
        users = [f"user_{i}" for i in range(num_users)]
        items = [f"device_{i}" for i in range(num_items)]
        
        for _ in range(num_interactions):
            user = np.random.choice(users)
            item = np.random.choice(items)
            rating = np.random.uniform(1, 5)
            interactions.append((user, item, rating))
        
        return interactions
    
    def train_model(self, epochs: int = 20, learning_rate: float = 0.01, regularization: float = 0.02):
        print("Generating sample interaction data...")
        interactions = self.generate_sample_interactions()
        
        print(f"Training recommendation model with {len(interactions)} interactions...")
        self.model.fit(interactions, epochs=epochs, learning_rate=learning_rate, regularization=regularization)
        
        print("\nTesting recommendations...")
        test_user = "user_0"
        recommendations = self.model.recommend_items(test_user, n=5)
        
        print(f"\nTop 5 recommendations for {test_user}:")
        for item, score in recommendations:
            print(f"  {item}: {score:.4f}")
        
        test_item = "device_0"
        similar_items = self.model.find_similar_items(test_item, n=5)
        
        print(f"\nTop 5 similar items to {test_item}:")
        for item, similarity in similar_items:
            print(f"  {item}: {similarity:.4f}")
    
    def evaluate_model(self, test_interactions):
        predictions = []
        actuals = []
        
        for user, item, rating in test_interactions:
            prediction = self.model.predict_rating(user, item)
            predictions.append(prediction)
            actuals.append(rating)
        
        predictions = np.array(predictions)
        actuals = np.array(actuals)
        
        rmse = np.sqrt(np.mean((predictions - actuals) ** 2))
        mae = np.mean(np.abs(predictions - actuals))
        
        print(f"\nEvaluation Metrics:")
        print(f"  RMSE: {rmse:.4f}")
        print(f"  MAE: {mae:.4f}")
        
        return rmse, mae

if __name__ == "__main__":
    trainer = RecommendationTrainer(num_factors=20)
    trainer.train_model(epochs=30)
    
    test_interactions = trainer.generate_sample_interactions(num_interactions=200)
    trainer.evaluate_model(test_interactions)
