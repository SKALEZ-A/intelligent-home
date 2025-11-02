import React, { useState } from 'react';
import './QuickActions.css';

interface QuickAction {
  id: string;
  label: string;
  icon: string;
  action: () => Promise<void>;
  status?: string;
  active?: boolean;
}

export const QuickActions: React.FC = () => {
  const [actions, setActions] = useState<QuickAction[]>([
    {
      id: 'all-lights',
      label: 'All Lights',
      icon: '💡',
      action: async () => toggleAllLights(),
      active: false
    },
    {
      id: 'away-mode',
      label: 'Away Mode',
      icon: '🏠',
      action: async () => toggleAwayMode(),
      active: false
    },
    {
      id: 'good-night',
      label: 'Good Night',
      icon: '🌙',
      action: async () => activateGoodNight(),
      active: false
    },
    {
      id: 'movie-mode',
      label: 'Movie Mode',
      icon: '🎬',
      action: async () => activateMovieMode(),
      active: false
    },
    {
      id: 'party-mode',
      label: 'Party Mode',
      icon: '🎉',
      action: async () => activatePartyMode(),
      active: false
    },
    {
      id: 'energy-save',
      label: 'Energy Save',
      icon: '⚡',
      action: async () => activateEnergySave(),
      active: false
    }
  ]);

  const toggleAllLights = async () => {
    console.log('Toggling all lights');
    updateActionStatus('all-lights');
  };

  const toggleAwayMode = async () => {
    console.log('Toggling away mode');
    updateActionStatus('away-mode');
  };

  const activateGoodNight = async () => {
    console.log('Activating good night mode');
    updateActionStatus('good-night');
  };

  const activateMovieMode = async () => {
    console.log('Activating movie mode');
    updateActionStatus('movie-mode');
  };

  const activatePartyMode = async () => {
    console.log('Activating party mode');
    updateActionStatus('party-mode');
  };

  const activateEnergySave = async () => {
    console.log('Activating energy save mode');
    updateActionStatus('energy-save');
  };

  const updateActionStatus = (actionId: string) => {
    setActions(actions.map(action => 
      action.id === actionId 
        ? { ...action, active: !action.active }
        : action
    ));
  };

  const handleActionClick = async (action: QuickAction) => {
    try {
      await action.action();
    } catch (error) {
      console.error('Action failed:', error);
    }
  };

  return (
    <div className="quick-actions">
      <h3>Quick Actions</h3>
      <div className="actions-grid">
        {actions.map((action) => (
          <div
            key={action.id}
            className={`action-button ${action.active ? 'active' : ''}`}
            onClick={() => handleActionClick(action)}
          >
            <div className="action-icon">{action.icon}</div>
            <div className="action-label">{action.label}</div>
            {action.status && (
              <div className="action-status">{action.status}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
