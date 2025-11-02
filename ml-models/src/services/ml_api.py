from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
import logging
import os
from datetime import datetime
from typing import Dict, List, Any

# Import ML models
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.energy_forecasting import EnergyForecastingModel
from models.behavior_prediction import BehaviorPredictionModel
from models.anomaly_detection import AnomalyDetectionModel
from models.occupancy_detection import OccupancyDetectionModel
from models.predictive_maintenance import PredictiveMaintenanceModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Initialize models
energy_model = None
behavior_model = None
anomaly_model = None
occupancy_model = None
maintenance_model = None

MODEL_DIR = os.environ.get('MODEL_DIR', './models/saved')


def load_models():
    """Load all trained models."""
    global energy_model, behavior_model, anomaly_model, occupancy_model, maintenance_model
    
    try:
        logger.info("Loading ML models...")
        
        # Load energy forecasting model
        energy_model = EnergyForecastingModel()
        energy_model_path = os.path.join(MODEL_DIR, 'energy_forecasting_model.pkl')
        if os.path.exists(energy_model_path):
            energy_model.load_model(energy_model_path)
            logger.info("Energy forecasting model loaded")
        
        # Load behavior prediction model
        behavior_model = BehaviorPredictionModel()
        behavior_model_path = os.path.join(MODEL_DIR, 'behavior_prediction_model.pkl')
        if os.path.exists(behavior_model_path):
            behavior_model.load_model(behavior_model_path)
            logger.info("Behavior prediction model loaded")
        
        # Load anomaly detection model
        anomaly_model = AnomalyDetectionModel()
        anomaly_model_path = os.path.join(MODEL_DIR, 'anomaly_detection_model.pkl')
        if os.path.exists(anomaly_model_path):
            anomaly_model.load_model(anomaly_model_path)
            logger.info("Anomaly detection model loaded")
        
        # Load occupancy detection model
        occupancy_model = OccupancyDetectionModel()
        occupancy_model_path = os.path.join(MODEL_DIR, 'occupancy_model.pkl')
        if os.path.exists(occupancy_model_path):
            occupancy_model.load_model(occupancy_model_path)
            logger.info("Occupancy detection model loaded")
        
        # Load predictive maintenance model
        maintenance_model = PredictiveMaintenanceModel()
        maintenance_model_path = os.path.join(MODEL_DIR, 'predictive_maintenance_model.pkl')
        if os.path.exists(maintenance_model_path):
            maintenance_model.load_model(maintenance_model_path)
            logger.info("Predictive maintenance model loaded")
        
        logger.info("All models loaded successfully")
    except Exception as e:
        logger.error(f"Error loading models: {e}")


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'service': 'ml-api',
        'timestamp': datetime.now().isoformat(),
        'models_loaded': {
            'energy_forecasting': energy_model is not None and energy_model.is_trained,
            'behavior_prediction': behavior_model is not None and behavior_model.is_trained,
            'anomaly_detection': anomaly_model is not None and anomaly_model.is_trained,
            'occupancy_detection': occupancy_model is not None and occupancy_model.is_trained,
            'predictive_maintenance': maintenance_model is not None and maintenance_model.is_trained
        }
    }), 200


@app.route('/api/energy/forecast', methods=['POST'])
def forecast_energy():
    """Forecast energy consumption."""
    try:
        if not energy_model or not energy_model.is_trained:
            return jsonify({'error': 'Energy forecasting model not available'}), 503
        
        data = request.json
        historical_data = pd.DataFrame(data['historical_data'])
        forecast_hours = data.get('forecast_hours', 24)
        
        forecast = energy_model.forecast(historical_data, forecast_hours)
        
        return jsonify({
            'forecast': forecast.tolist(),
            'forecast_hours': forecast_hours,
            'timestamp': datetime.now().isoformat()
        }), 200
    except Exception as e:
        logger.error(f"Error in energy forecasting: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/energy/optimize', methods=['POST'])
def optimize_energy():
    """Get energy optimization recommendations."""
    try:
        if not energy_model or not energy_model.is_trained:
            return jsonify({'error': 'Energy forecasting model not available'}), 503
        
        data = request.json
        historical_data = pd.DataFrame(data['historical_data'])
        devices = data.get('devices', [])
        
        recommendations = energy_model.get_optimization_recommendations(
            historical_data,
            devices
        )
        
        return jsonify({
            'recommendations': recommendations,
            'timestamp': datetime.now().isoformat()
        }), 200
    except Exception as e:
        logger.error(f"Error in energy optimization: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/behavior/predict', methods=['POST'])
def predict_behavior():
    """Predict user behavior patterns."""
    try:
        if not behavior_model or not behavior_model.is_trained:
            return jsonify({'error': 'Behavior prediction model not available'}), 503
        
        data = request.json
        historical_data = pd.DataFrame(data['historical_data'])
        
        predictions = behavior_model.predict(historical_data)
        patterns = behavior_model.identify_patterns(historical_data)
        
        return jsonify({
            'predictions': predictions.tolist() if isinstance(predictions, np.ndarray) else predictions,
            'patterns': patterns,
            'timestamp': datetime.now().isoformat()
        }), 200
    except Exception as e:
        logger.error(f"Error in behavior prediction: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/behavior/recommendations', methods=['POST'])
def get_behavior_recommendations():
    """Get personalized automation recommendations."""
    try:
        if not behavior_model or not behavior_model.is_trained:
            return jsonify({'error': 'Behavior prediction model not available'}), 503
        
        data = request.json
        historical_data = pd.DataFrame(data['historical_data'])
        
        recommendations = behavior_model.generate_automation_recommendations(historical_data)
        
        return jsonify({
            'recommendations': recommendations,
            'timestamp': datetime.now().isoformat()
        }), 200
    except Exception as e:
        logger.error(f"Error generating recommendations: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/anomaly/detect', methods=['POST'])
def detect_anomalies():
    """Detect anomalies in device behavior."""
    try:
        if not anomaly_model or not anomaly_model.is_trained:
            return jsonify({'error': 'Anomaly detection model not available'}), 503
        
        data = request.json
        telemetry_data = pd.DataFrame(data['telemetry_data'])
        
        anomalies = anomaly_model.detect(telemetry_data)
        anomaly_scores = anomaly_model.get_anomaly_scores(telemetry_data)
        
        return jsonify({
            'anomalies': anomalies.tolist(),
            'anomaly_scores': anomaly_scores.tolist(),
            'anomaly_count': int((anomalies == -1).sum()),
            'timestamp': datetime.now().isoformat()
        }), 200
    except Exception as e:
        logger.error(f"Error in anomaly detection: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/occupancy/detect', methods=['POST'])
def detect_occupancy():
    """Detect home occupancy."""
    try:
        if not occupancy_model or not occupancy_model.is_trained:
            return jsonify({'error': 'Occupancy detection model not available'}), 503
        
        data = request.json
        sensor_data = pd.DataFrame(data['sensor_data'])
        
        predictions = occupancy_model.predict(sensor_data)
        probabilities = occupancy_model.predict_proba(sensor_data)
        
        return jsonify({
            'predictions': predictions.tolist(),
            'probabilities': probabilities.tolist(),
            'occupied_percentage': float(predictions.mean()),
            'timestamp': datetime.now().isoformat()
        }), 200
    except Exception as e:
        logger.error(f"Error in occupancy detection: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/occupancy/changes', methods=['POST'])
def detect_occupancy_changes():
    """Detect occupancy change events."""
    try:
        if not occupancy_model or not occupancy_model.is_trained:
            return jsonify({'error': 'Occupancy detection model not available'}), 503
        
        data = request.json
        sensor_data = pd.DataFrame(data['sensor_data'])
        threshold = data.get('threshold', 0.7)
        
        changes = occupancy_model.detect_occupancy_change(sensor_data, threshold)
        
        return jsonify({
            'changes': changes,
            'change_count': len(changes),
            'timestamp': datetime.now().isoformat()
        }), 200
    except Exception as e:
        logger.error(f"Error detecting occupancy changes: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/maintenance/assess', methods=['POST'])
def assess_device_health():
    """Assess device health and predict maintenance needs."""
    try:
        if not maintenance_model or not maintenance_model.is_trained:
            return jsonify({'error': 'Predictive maintenance model not available'}), 503
        
        data = request.json
        telemetry_data = pd.DataFrame(data['telemetry_data'])
        
        assessments = maintenance_model.assess_device_health(telemetry_data)
        
        return jsonify({
            'assessments': assessments,
            'devices_assessed': len(assessments),
            'critical_devices': len([a for a in assessments if a['health_status'] == 'critical']),
            'timestamp': datetime.now().isoformat()
        }), 200
    except Exception as e:
        logger.error(f"Error in device health assessment: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/maintenance/schedule', methods=['POST'])
def generate_maintenance_schedule():
    """Generate optimized maintenance schedule."""
    try:
        if not maintenance_model or not maintenance_model.is_trained:
            return jsonify({'error': 'Predictive maintenance model not available'}), 503
        
        data = request.json
        telemetry_data = pd.DataFrame(data['telemetry_data'])
        max_concurrent = data.get('max_concurrent', 3)
        
        assessments = maintenance_model.assess_device_health(telemetry_data)
        schedule = maintenance_model.generate_maintenance_schedule(assessments, max_concurrent)
        
        return jsonify({
            'schedule': schedule,
            'total_tasks': len(schedule),
            'timestamp': datetime.now().isoformat()
        }), 200
    except Exception as e:
        logger.error(f"Error generating maintenance schedule: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/maintenance/failure-probability', methods=['POST'])
def predict_failure_probability():
    """Predict device failure probability."""
    try:
        if not maintenance_model or not maintenance_model.is_trained:
            return jsonify({'error': 'Predictive maintenance model not available'}), 503
        
        data = request.json
        telemetry_data = pd.DataFrame(data['telemetry_data'])
        time_horizon_days = data.get('time_horizon_days', 30)
        
        probabilities = maintenance_model.predict_failure_probability(
            telemetry_data,
            time_horizon_days
        )
        
        return jsonify({
            'failure_probabilities': probabilities.tolist(),
            'time_horizon_days': time_horizon_days,
            'high_risk_count': int((probabilities > 0.7).sum()),
            'timestamp': datetime.now().isoformat()
        }), 200
    except Exception as e:
        logger.error(f"Error predicting failure probability: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/models/retrain', methods=['POST'])
def retrain_model():
    """Retrain a specific model with new data."""
    try:
        data = request.json
        model_type = data.get('model_type')
        training_data = pd.DataFrame(data['training_data'])
        labels = np.array(data.get('labels', []))
        
        if model_type == 'energy_forecasting':
            if not energy_model:
                return jsonify({'error': 'Energy model not initialized'}), 400
            metrics = energy_model.train(training_data, labels)
            energy_model.save_model(os.path.join(MODEL_DIR, 'energy_forecasting_model.pkl'))
        elif model_type == 'behavior_prediction':
            if not behavior_model:
                return jsonify({'error': 'Behavior model not initialized'}), 400
            metrics = behavior_model.train(training_data, labels)
            behavior_model.save_model(os.path.join(MODEL_DIR, 'behavior_prediction_model.pkl'))
        elif model_type == 'anomaly_detection':
            if not anomaly_model:
                return jsonify({'error': 'Anomaly model not initialized'}), 400
            metrics = anomaly_model.train(training_data)
            anomaly_model.save_model(os.path.join(MODEL_DIR, 'anomaly_detection_model.pkl'))
        elif model_type == 'occupancy_detection':
            if not occupancy_model:
                return jsonify({'error': 'Occupancy model not initialized'}), 400
            metrics = occupancy_model.train(training_data, labels)
            occupancy_model.save_model(os.path.join(MODEL_DIR, 'occupancy_model.pkl'))
        elif model_type == 'predictive_maintenance':
            if not maintenance_model:
                return jsonify({'error': 'Maintenance model not initialized'}), 400
            metrics = maintenance_model.train_rul_predictor(training_data, labels)
            maintenance_model.save_model(os.path.join(MODEL_DIR, 'predictive_maintenance_model.pkl'))
        else:
            return jsonify({'error': f'Unknown model type: {model_type}'}), 400
        
        return jsonify({
            'message': f'{model_type} model retrained successfully',
            'metrics': metrics,
            'timestamp': datetime.now().isoformat()
        }), 200
    except Exception as e:
        logger.error(f"Error retraining model: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/models/status', methods=['GET'])
def get_models_status():
    """Get status of all ML models."""
    try:
        status = {
            'energy_forecasting': {
                'loaded': energy_model is not None,
                'trained': energy_model.is_trained if energy_model else False,
                'model_type': energy_model.model_type if energy_model else None
            },
            'behavior_prediction': {
                'loaded': behavior_model is not None,
                'trained': behavior_model.is_trained if behavior_model else False,
                'model_type': behavior_model.model_type if behavior_model else None
            },
            'anomaly_detection': {
                'loaded': anomaly_model is not None,
                'trained': anomaly_model.is_trained if anomaly_model else False,
                'model_type': anomaly_model.model_type if anomaly_model else None
            },
            'occupancy_detection': {
                'loaded': occupancy_model is not None,
                'trained': occupancy_model.is_trained if occupancy_model else False,
                'model_type': occupancy_model.model_type if occupancy_model else None
            },
            'predictive_maintenance': {
                'loaded': maintenance_model is not None,
                'trained': maintenance_model.is_trained if maintenance_model else False
            }
        }
        
        return jsonify({
            'status': status,
            'timestamp': datetime.now().isoformat()
        }), 200
    except Exception as e:
        logger.error(f"Error getting models status: {e}")
        return jsonify({'error': str(e)}), 500


@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404


@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500


if __name__ == '__main__':
    # Create model directory if it doesn't exist
    os.makedirs(MODEL_DIR, exist_ok=True)
    
    # Load models on startup
    load_models()
    
    # Start Flask app
    port = int(os.environ.get('ML_API_PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
