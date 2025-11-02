import json
import os
import shutil
from datetime import datetime
from typing import Dict, List, Optional, Any
import hashlib

class ModelVersion:
    def __init__(self, version: str, model_path: str, metadata: Dict[str, Any]):
        self.version = version
        self.model_path = model_path
        self.metadata = metadata
        self.created_at = datetime.now().isoformat()
        self.checksum = self._calculate_checksum()
    
    def _calculate_checksum(self) -> str:
        """Calculate SHA256 checksum of model file"""
        sha256_hash = hashlib.sha256()
        with open(self.model_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "version": self.version,
            "model_path": self.model_path,
            "metadata": self.metadata,
            "created_at": self.created_at,
            "checksum": self.checksum
        }

class ModelVersioningService:
    def __init__(self, base_path: str = "./models"):
        self.base_path = base_path
        self.versions_file = os.path.join(base_path, "versions.json")
        self.versions: Dict[str, List[ModelVersion]] = {}
        self._load_versions()
    
    def _load_versions(self):
        """Load version history from file"""
        if os.path.exists(self.versions_file):
            with open(self.versions_file, 'r') as f:
                data = json.load(f)
                for model_name, versions in data.items():
                    self.versions[model_name] = [
                        ModelVersion(v['version'], v['model_path'], v['metadata'])
                        for v in versions
                    ]
    
    def _save_versions(self):
        """Save version history to file"""
        os.makedirs(self.base_path, exist_ok=True)
        data = {
            model_name: [v.to_dict() for v in versions]
            for model_name, versions in self.versions.items()
        }
        with open(self.versions_file, 'w') as f:
            json.dump(data, f, indent=2)
    
    def register_version(
        self,
        model_name: str,
        model_path: str,
        version: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> ModelVersion:
        """Register a new model version"""
        if version is None:
            version = self._generate_version(model_name)
        
        if metadata is None:
            metadata = {}
        
        metadata['model_name'] = model_name
        metadata['registered_at'] = datetime.now().isoformat()
        
        version_obj = ModelVersion(version, model_path, metadata)
        
        if model_name not in self.versions:
            self.versions[model_name] = []
        
        self.versions[model_name].append(version_obj)
        self._save_versions()
        
        return version_obj
    
    def _generate_version(self, model_name: str) -> str:
        """Generate next version number"""
        if model_name not in self.versions or len(self.versions[model_name]) == 0:
            return "1.0.0"
        
        latest = self.versions[model_name][-1]
        major, minor, patch = map(int, latest.version.split('.'))
        return f"{major}.{minor}.{patch + 1}"
    
    def get_version(self, model_name: str, version: str) -> Optional[ModelVersion]:
        """Get specific model version"""
        if model_name not in self.versions:
            return None
        
        for v in self.versions[model_name]:
            if v.version == version:
                return v
        
        return None
    
    def get_latest_version(self, model_name: str) -> Optional[ModelVersion]:
        """Get latest version of a model"""
        if model_name not in self.versions or len(self.versions[model_name]) == 0:
            return None
        
        return self.versions[model_name][-1]
    
    def list_versions(self, model_name: str) -> List[ModelVersion]:
        """List all versions of a model"""
        return self.versions.get(model_name, [])
    
    def compare_versions(
        self,
        model_name: str,
        version1: str,
        version2: str
    ) -> Dict[str, Any]:
        """Compare two model versions"""
        v1 = self.get_version(model_name, version1)
        v2 = self.get_version(model_name, version2)
        
        if not v1 or not v2:
            raise ValueError("One or both versions not found")
        
        return {
            "version1": v1.to_dict(),
            "version2": v2.to_dict(),
            "metadata_diff": self._diff_metadata(v1.metadata, v2.metadata),
            "checksum_match": v1.checksum == v2.checksum
        }
    
    def _diff_metadata(self, meta1: Dict, meta2: Dict) -> Dict[str, Any]:
        """Calculate difference between metadata"""
        all_keys = set(meta1.keys()) | set(meta2.keys())
        diff = {}
        
        for key in all_keys:
            val1 = meta1.get(key)
            val2 = meta2.get(key)
            
            if val1 != val2:
                diff[key] = {"old": val1, "new": val2}
        
        return diff
    
    def rollback(self, model_name: str, version: str) -> ModelVersion:
        """Rollback to a specific version"""
        target_version = self.get_version(model_name, version)
        
        if not target_version:
            raise ValueError(f"Version {version} not found")
        
        current_path = os.path.join(self.base_path, model_name, "current")
        
        if os.path.exists(current_path):
            backup_path = os.path.join(
                self.base_path,
                model_name,
                f"backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            )
            shutil.copy2(current_path, backup_path)
        
        shutil.copy2(target_version.model_path, current_path)
        
        return target_version
    
    def delete_version(self, model_name: str, version: str) -> bool:
        """Delete a specific version"""
        if model_name not in self.versions:
            return False
        
        self.versions[model_name] = [
            v for v in self.versions[model_name] if v.version != version
        ]
        
        self._save_versions()
        return True
    
    def get_version_stats(self, model_name: str) -> Dict[str, Any]:
        """Get statistics about model versions"""
        versions = self.list_versions(model_name)
        
        if not versions:
            return {"total_versions": 0}
        
        return {
            "total_versions": len(versions),
            "latest_version": versions[-1].version,
            "first_version": versions[0].version,
            "total_size_bytes": sum(
                os.path.getsize(v.model_path) for v in versions if os.path.exists(v.model_path)
            ),
            "creation_dates": [v.created_at for v in versions]
        }

model_versioning_service = ModelVersioningService()
