import numpy as np
from typing import List, Dict, Tuple
import json

class SentimentAnalysisModel:
    def __init__(self):
        self.vocabulary = {}
        self.word_vectors = {}
        self.model_weights = None
        self.bias = None
        
    def preprocess_text(self, text: str) -> List[str]:
        text = text.lower()
        text = ''.join(char if char.isalnum() or char.isspace() else ' ' for char in text)
        tokens = text.split()
        return [token for token in tokens if len(token) > 2]
    
    def build_vocabulary(self, texts: List[str], max_vocab_size: int = 10000):
        word_freq = {}
        for text in texts:
            tokens = self.preprocess_text(text)
            for token in tokens:
                word_freq[token] = word_freq.get(token, 0) + 1
        
        sorted_words = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
        self.vocabulary = {word: idx for idx, (word, _) in enumerate(sorted_words[:max_vocab_size])}
    
    def text_to_vector(self, text: str, max_length: int = 100) -> np.ndarray:
        tokens = self.preprocess_text(text)
        vector = np.zeros(max_length, dtype=np.int32)
        
        for i, token in enumerate(tokens[:max_length]):
            if token in self.vocabulary:
                vector[i] = self.vocabulary[token]
        
        return vector
    
    def train(self, texts: List[str], labels: List[int], epochs: int = 10, learning_rate: float = 0.01):
        self.build_vocabulary(texts)
        
        X = np.array([self.text_to_vector(text) for text in texts])
        y = np.array(labels)
        
        vocab_size = len(self.vocabulary)
        embedding_dim = 50
        
        self.word_vectors = np.random.randn(vocab_size, embedding_dim) * 0.01
        self.model_weights = np.random.randn(embedding_dim) * 0.01
        self.bias = 0.0
        
        for epoch in range(epochs):
            total_loss = 0
            correct = 0
            
            for i in range(len(X)):
                embedded = np.mean([self.word_vectors[idx] for idx in X[i] if idx < vocab_size], axis=0)
                
                if embedded.shape[0] == 0:
                    embedded = np.zeros(embedding_dim)
                
                prediction = self.sigmoid(np.dot(embedded, self.model_weights) + self.bias)
                
                loss = -( y[i] * np.log(prediction + 1e-10) + (1 - y[i]) * np.log(1 - prediction + 1e-10))
                total_loss += loss
                
                if (prediction > 0.5 and y[i] == 1) or (prediction <= 0.5 and y[i] == 0):
                    correct += 1
                
                error = prediction - y[i]
                self.model_weights -= learning_rate * error * embedded
                self.bias -= learning_rate * error
            
            accuracy = correct / len(X)
            print(f"Epoch {epoch + 1}/{epochs}, Loss: {total_loss / len(X):.4f}, Accuracy: {accuracy:.4f}")
    
    def predict(self, text: str) -> Tuple[float, str]:
        vector = self.text_to_vector(text)
        vocab_size = len(self.vocabulary)
        embedding_dim = self.word_vectors.shape[1]
        
        embedded = np.mean([self.word_vectors[idx] for idx in vector if idx < vocab_size], axis=0)
        
        if embedded.shape[0] == 0:
            embedded = np.zeros(embedding_dim)
        
        score = self.sigmoid(np.dot(embedded, self.model_weights) + self.bias)
        sentiment = "positive" if score > 0.5 else "negative"
        
        return score, sentiment
    
    def sigmoid(self, x):
        return 1 / (1 + np.exp(-np.clip(x, -500, 500)))
    
    def save_model(self, filepath: str):
        model_data = {
            'vocabulary': self.vocabulary,
            'word_vectors': self.word_vectors.tolist(),
            'model_weights': self.model_weights.tolist(),
            'bias': float(self.bias)
        }
        with open(filepath, 'w') as f:
            json.dump(model_data, f)
    
    def load_model(self, filepath: str):
        with open(filepath, 'r') as f:
            model_data = json.load(f)
        
        self.vocabulary = model_data['vocabulary']
        self.word_vectors = np.array(model_data['word_vectors'])
        self.model_weights = np.array(model_data['model_weights'])
        self.bias = model_data['bias']
