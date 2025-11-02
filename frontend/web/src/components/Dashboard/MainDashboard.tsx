import React, { useState, useEffect } from 'react';
import { useDevices } from '../../hooks/useDevices';
import { useEnergy } from '../../hooks/useEnergy';
import { useAutomation } from '../../hooks/useAutomation';
import { DeviceCard } from '../Device/DeviceCard';
import { EnergyDashboard } from './EnergyDashboard';
import { AutomationBuilder } from '../Automation/AutomationBuilder';
import { SceneBuilder } from '../Scene/SceneBuilder';
import './MainDashboard.css';

interface DashboardTab {
  id: string;
  label: string;
  icon: string;
}

const tabs: DashboardTab[] = [
  { id: 'overview', label: 'Overview', icon: '🏠' },
  { id: 'devices', label: 'Devices', icon: '💡' },
  { id: 'energy', label: 'Energy', icon: '⚡' },
  { id: 'automations', label: 'Automations', icon: '🤖' },
  { id: 'scenes', label: 'Scenes', icon: '🎬' },
];

export const MainDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);

  const { devices, loading: devicesLoading, error: devicesError, sendCommand } = useDevices({
    autoRefresh: true,
    refreshInterval: 30000,
  });

  const { stats, realTimePower, loading: energyLoading } = useEnergy({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date().toISOString(),
    autoRefresh: true,
    refreshInterval: 60000,
  });

  const {
    automations,
    scenes,
    loading: automationLoading,
    toggleAutomation,
    executeScene,
  } = useAutomation();

  const rooms = Array.from(new Set(devices.map(d => d.room).filter(Boolean)));

  const filteredDevices = selectedRoom
    ? devices.filter(d => d.room === selectedRoom)
    : devices;

  const activeDevices = devices.filter(d => d.status === 'online').length;
  const totalDevices = devices.length;
  const activeAutomations = automations.filter(a => a.enabled).length;

  const handleDeviceCommand = async (deviceId: string, command: string, parameters?: any) => {
    try {
      await sendCommand(deviceId, command, parameters);
    } catch (error) {
      console.error('Failed to send command:', error);
    }
  };

  const handleToggleAutomation = async (automationId: string, enabled: boolean) => {
    try {
      await toggleAutomation(automationId, enabled);
    } catch (error) {
      console.error('Failed to toggle automation:', error);
    }
  };

  const handleExecuteScene = async (sceneId: string) => {
    try {
      await executeScene(sceneId);
    } catch (error) {
      console.error('Failed to execute scene:', error);
    }
  };

  const renderOverview = () => (
    <div className="overview-container">
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">💡</div>
          <div className="stat-content">
            <div className="stat-value">{activeDevices}/{totalDevices}</div>
            <div className="stat-label">Active Devices</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">⚡</div>
          <div className="stat-content">
            <div className="stat-value">{realTimePower.toFixed(0)}W</div>
            <div className="stat-label">Current Power</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🤖</div>
          <div className="stat-content">
            <div className="stat-value">{activeAutomations}</div>
            <div className="stat-label">Active Automations</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🎬</div>
          <div className="stat-content">
            <div className="stat-value">{scenes.length}</div>
            <div className="stat-label">Scenes</div>
          </div>
        </div>
      </div>

      <div className="overview-sections">
        <div className="overview-section">
          <h3>Recent Devices</h3>
          <div className="device-grid">
            {devices.slice(0, 6).map(device => (
              <DeviceCard
                key={device.id}
                device={device}
                onCommand={handleDeviceCommand}
              />
            ))}
          </div>
        </div>

        <div className="overview-section">
          <h3>Quick Scenes</h3>
          <div className="scene-quick-actions">
            {scenes.slice(0, 4).map(scene => (
              <button
                key={scene.id}
                className="scene-quick-button"
                onClick={() => handleExecuteScene(scene.id)}
              >
                <span className="scene-icon">{scene.icon || '🎬'}</span>
                <span className="scene-name">{scene.name}</span>
              </button>
            ))}
          </div>
        </div>

        {stats && (
          <div className="overview-section">
            <h3>Energy Overview</h3>
            <div className="energy-summary">
              <div className="energy-stat">
                <span className="energy-label">Today's Usage</span>
                <span className="energy-value">
                  {stats.totalEnergy.toFixed(2)} kWh
                </span>
              </div>
              <div className="energy-stat">
                <span className="energy-label">Estimated Cost</span>
                <span className="energy-value">
                  ${stats.totalCost.toFixed(2)}
                </span>
              </div>
              <div className="energy-stat">
                <span className="energy-label">Peak Power</span>
                <span className="energy-value">
                  {stats.peakPower.toFixed(0)}W
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderDevices = () => (
    <div className="devices-container">
      <div className="devices-header">
        <h2>Devices</h2>
        <div className="room-filter">
          <button
            className={`room-button ${!selectedRoom ? 'active' : ''}`}
            onClick={() => setSelectedRoom(null)}
          >
            All Rooms
          </button>
          {rooms.map(room => (
            <button
              key={room}
              className={`room-button ${selectedRoom === room ? 'active' : ''}`}
              onClick={() => setSelectedRoom(room)}
            >
              {room}
            </button>
          ))}
        </div>
      </div>

      {devicesLoading ? (
        <div className="loading-spinner">Loading devices...</div>
      ) : devicesError ? (
        <div className="error-message">{devicesError}</div>
      ) : (
        <div className="device-grid">
          {filteredDevices.map(device => (
            <DeviceCard
              key={device.id}
              device={device}
              onCommand={handleDeviceCommand}
            />
          ))}
        </div>
      )}
    </div>
  );

  const renderEnergy = () => (
    <div className="energy-container">
      <EnergyDashboard />
    </div>
  );

  const renderAutomations = () => (
    <div className="automations-container">
      <div className="automations-header">
        <h2>Automations</h2>
        <button className="btn btn-primary">Create Automation</button>
      </div>

      {automationLoading ? (
        <div className="loading-spinner">Loading automations...</div>
      ) : (
        <div className="automations-list">
          {automations.map(automation => (
            <div key={automation.id} className="automation-card">
              <div className="automation-header">
                <h3>{automation.name}</h3>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={automation.enabled}
                    onChange={(e) => handleToggleAutomation(automation.id, e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              {automation.description && (
                <p className="automation-description">{automation.description}</p>
              )}
              <div className="automation-details">
                <span className="automation-trigger">
                  Trigger: {automation.trigger.type}
                </span>
                <span className="automation-actions">
                  {automation.actions.length} action(s)
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderScenes = () => (
    <div className="scenes-container">
      <div className="scenes-header">
        <h2>Scenes</h2>
        <button className="btn btn-primary">Create Scene</button>
      </div>

      {automationLoading ? (
        <div className="loading-spinner">Loading scenes...</div>
      ) : (
        <div className="scenes-grid">
          {scenes.map(scene => (
            <div key={scene.id} className="scene-card">
              <div className="scene-icon-large">{scene.icon || '🎬'}</div>
              <h3>{scene.name}</h3>
              {scene.description && (
                <p className="scene-description">{scene.description}</p>
              )}
              <div className="scene-stats">
                <span>{scene.actions.length} actions</span>
                {scene.executionCount && (
                  <span>Executed {scene.executionCount} times</span>
                )}
              </div>
              <button
                className="btn btn-primary btn-block"
                onClick={() => handleExecuteScene(scene.id)}
              >
                Execute Scene
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverview();
      case 'devices':
        return renderDevices();
      case 'energy':
        return renderEnergy();
      case 'automations':
        return renderAutomations();
      case 'scenes':
        return renderScenes();
      default:
        return renderOverview();
    }
  };

  return (
    <div className="main-dashboard">
      <div className="dashboard-sidebar">
        <div className="dashboard-logo">
          <h1>🏠 Smart Home</h1>
        </div>
        <nav className="dashboard-nav">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`nav-button ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="nav-icon">{tab.icon}</span>
              <span className="nav-label">{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="dashboard-content">
        <div className="dashboard-header">
          <h1>Welcome Back!</h1>
          <div className="dashboard-actions">
            <button className="btn btn-icon">🔔</button>
            <button className="btn btn-icon">⚙️</button>
            <button className="btn btn-icon">👤</button>
          </div>
        </div>

        <div className="dashboard-main">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};
