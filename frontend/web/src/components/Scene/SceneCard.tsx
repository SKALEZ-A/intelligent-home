import React from 'react';
import { Scene } from '../../types/scene';
import './SceneCard.css';

interface SceneCardProps {
  scene: Scene;
  onActivate: (sceneId: string) => void;
  onEdit: (sceneId: string) => void;
  onDelete: (sceneId: string) => void;
  onToggleFavorite: (sceneId: string) => void;
}

export const SceneCard: React.FC<SceneCardProps> = ({
  scene,
  onActivate,
  onEdit,
  onDelete,
  onToggleFavorite
}) => {
  const handleActivate = (e: React.MouseEvent) => {
    e.stopPropagation();
    onActivate(scene.id);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(scene.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${scene.name}"?`)) {
      onDelete(scene.id);
    }
  };

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite(scene.id);
  };

  return (
    <div className={`scene-card ${scene.isActive ? 'scene-card--active' : ''}`}>
      <div className="scene-card__header">
        <div className="scene-card__icon" style={{ backgroundColor: scene.color || '#6366f1' }}>
          {scene.icon || '🏠'}
        </div>
        <button
          className={`scene-card__favorite ${scene.isFavorite ? 'scene-card__favorite--active' : ''}`}
          onClick={handleToggleFavorite}
          aria-label="Toggle favorite"
        >
          ★
        </button>
      </div>

      <div className="scene-card__content">
        <h3 className="scene-card__name">{scene.name}</h3>
        {scene.description && (
          <p className="scene-card__description">{scene.description}</p>
        )}

        <div className="scene-card__stats">
          <div className="scene-card__stat">
            <span className="scene-card__stat-label">Actions</span>
            <span className="scene-card__stat-value">{scene.actions.length}</span>
          </div>
          <div className="scene-card__stat">
            <span className="scene-card__stat-label">Executions</span>
            <span className="scene-card__stat-value">{scene.executionCount}</span>
          </div>
        </div>

        {scene.lastExecuted && (
          <div className="scene-card__last-executed">
            Last run: {new Date(scene.lastExecuted).toLocaleString()}
          </div>
        )}
      </div>

      <div className="scene-card__actions">
        <button
          className="scene-card__action scene-card__action--primary"
          onClick={handleActivate}
          disabled={scene.isActive}
        >
          {scene.isActive ? 'Active' : 'Activate'}
        </button>
        <button
          className="scene-card__action scene-card__action--secondary"
          onClick={handleEdit}
        >
          Edit
        </button>
        <button
          className="scene-card__action scene-card__action--danger"
          onClick={handleDelete}
        >
          Delete
        </button>
      </div>
    </div>
  );
};
