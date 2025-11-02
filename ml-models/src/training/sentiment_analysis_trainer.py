import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.sentiment_analysis import SentimentAnalysisModel
import numpy as np

class SentimentAnalysisTrainer:
    def __init__(self):
        self.model = SentimentAnalysisModel()
        
    def generate_sample_data(self, num_samples: int = 1000):
        positive_templates = [
            "I love this smart home system",
            "The automation works perfectly",
            "Great energy savings with this device",
            "Excellent user interface and features",
            "Very satisfied with the performance",
            "Amazing integration with other devices",
            "The app is intuitive and easy to use",
            "Highly recommend this product",
            "Best smart home solution I've tried",
            "Outstanding customer support"
        ]
        
        negative_templates = [
            "This device is terrible",
            "Constant connectivity issues",
            "Very disappointed with the quality",
            "The app crashes frequently",
            "Poor customer service experience",
            "Not worth the money",
            "Difficult to set up and configure",
            "Unreliable and buggy",
            "Would not recommend this product",
            "Waste of time and money"
        ]
        
        texts = []
        labels = []
        
        for _ in range(num_samples // 2):
            texts.append(np.random.choice(positive_templates))
            labels.append(1)
            
            texts.append(np.random.choice(negative_templates))
            labels.append(0)
        
        return texts, labels
    
    def train_model(self, epochs: int = 20, learning_rate: float = 0.01):
        print("Generating training data...")
        texts, labels = self.generate_sample_data(1000)
        
        print("Training sentiment analysis model...")
        self.model.train(texts, labels, epochs=epochs, learning_rate=learning_rate)
        
        print("\nTesting model...")
        test_texts = [
            "This is an amazing smart home device",
            "Terrible experience with this product",
            "Works great and easy to use",
            "Very buggy and unreliable"
        ]
        
        for text in test_texts:
            score, sentiment = self.model.predict(text)
            print(f"Text: '{text}'")
            print(f"Sentiment: {sentiment} (score: {score:.4f})\n")
    
    def save_model(self, filepath: str):
        self.model.save_model(filepath)
        print(f"Model saved to {filepath}")
    
    def load_model(self, filepath: str):
        self.model.load_model(filepath)
        print(f"Model loaded from {filepath}")

if __name__ == "__main__":
    trainer = SentimentAnalysisTrainer()
    trainer.train_model(epochs=20)
    trainer.save_model("sentiment_model.json")
