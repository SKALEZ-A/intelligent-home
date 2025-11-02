import os
import json
import shutil
from typing import Dict, List, Optional, Any
from datetime import datetime
import hashlib

class ModelDeployment:
    def __init__(
        self,
        model_name: str,
        version: str,
        environment: str,
        endpoint: str
    ):
        self.model_name = model_name
        self.version = version
        self.environment = environment
        self.endpoint = endpoint
        self.deployed_at = datetime.now().isoformat()
        self.status = 'active'
        self.metrics = {
            'requests': 0,
            'errors': 0,
            'avg_latency': 0.0
        }
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'model_name': self.model_name,
            'version': self.version,
            'environment': self.environment,
            'endpoint': self.endpoint,
            'deployed_at': self.deployed_at,
            'status': self.status,
            'metrics': self.metrics
        }

class ModelDeploymentService:
    def __init__(self, base_path: str = "./deployments"):
        self.base_path = base_path
        self.deployments_file = os.path.join(base_path, "deployments.json")
        self.deployments: Dict[str, List[ModelDeployment]] = {}
        self._load_deployments()
    
    def _load_deployments(self):
        """Load deployment history from file"""
        if os.path.exists(self.deployments_file):
            with open(self.deployments_file, 'r') as f:
                data = json.load(f)
                for env, deployments in data.items():
                    self.deployments[env] = [
                        self._dict_to_deployment(d) for d in deployments
                    ]
    
    def _dict_to_deployment(self, data: Dict) -> ModelDeployment:
        """Convert dictionary to ModelDeployment object"""
        deployment = ModelDeployment(
            data['model_name'],
            data['version'],
            data['environment'],
            data['endpoint']
        )
        deployment.deployed_at = data['deployed_at']
        deployment.status = data['status']
        deployment.metrics = data['metrics']
        return deployment
    
    def _save_deployments(self):
        """Save deployment history to file"""
        os.makedirs(self.base_path, exist_ok=True)
        data = {
            env: [d.to_dict() for d in deployments]
            for env, deployments in self.deployments.items()
        }
        with open(self.deployments_file, 'w') as f:
            json.dump(data, f, indent=2)
    
    def deploy_model(
        self,
        model_name: str,
        version: str,
        environment: str,
        endpoint: str
    ) -> ModelDeployment:
        """Deploy a model to an environment"""
        deployment = ModelDeployment(model_name, version, environment, endpoint)
        
        if environment not in self.deployments:
            self.deployments[environment] = []
        
        existing = self.get_active_deployment(environment, model_name)
        if existing:
            existing.status = 'inactive'
        
        self.deployments[environment].append(deployment)
        self._save_deployments()
        
        return deployment
    
    def get_active_deployment(
        self,
        environment: str,
        model_name: str
    ) -> Optional[ModelDeployment]:
        """Get active deployment for a model in an environment"""
        if environment not in self.deployments:
            return None
        
        for deployment in reversed(self.deployments[environment]):
            if deployment.model_name == model_name and deployment.status == 'active':
                return deployment
        
        return None
    
    def list_deployments(
        self,
        environment: Optional[str] = None
    ) -> List[ModelDeployment]:
        """List all deployments, optionally filtered by environment"""
        if environment:
            return self.deployments.get(environment, [])
        
        all_deployments = []
        for deployments in self.deployments.values():
            all_deployments.extend(deployments)
        
        return all_deployments
    
    def rollback_deployment(
        self,
        environment: str,
        model_name: str
    ) -> Optional[ModelDeployment]:
        """Rollback to previous deployment"""
        if environment not in self.deployments:
            return None
        
        deployments = [
            d for d in self.deployments[environment]
            if d.model_name == model_name
        ]
        
        if len(deployments) < 2:
            return None
        
        current = deployments[-1]
        previous = deployments[-2]
        
        current.status = 'rolled_back'
        previous.status = 'active'
        
        self._save_deployments()
        
        return previous
    
    def update_metrics(
        self,
        environment: str,
        model_name: str,
        metrics: Dict[str, Any]
    ):
        """Update deployment metrics"""
        deployment = self.get_active_deployment(environment, model_name)
        
        if deployment:
            deployment.metrics.update(metrics)
            self._save_deployments()
    
    def get_deployment_stats(
        self,
        environment: str
    ) -> Dict[str, Any]:
        """Get deployment statistics for an environment"""
        deployments = self.deployments.get(environment, [])
        active = [d for d in deployments if d.status == 'active']
        
        return {
            'total_deployments': len(deployments),
            'active_deployments': len(active),
            'models_deployed': len(set(d.model_name for d in active)),
            'total_requests': sum(d.metrics['requests'] for d in active),
            'total_errors': sum(d.metrics['errors'] for d in active)
        }

model_deployment_service = ModelDeploymentService()
