import React, { useState, useEffect } from 'react';
import './SecurityDashboard.css';

interface SecurityEvent {
  id: string;
  type: 'motion' | 'door' | 'window' | 'alarm' | 'camera';
  severity: 'low' | 'medium' | 'high';
  message: string;
  location: string;
  timestamp: Date;
  resolved: boolean;
}

interface SecurityDevice {
  id: string;
  name: string;
  type: string;
  status: 'armed' | 'disarmed' | 'triggered' | 'offline';
  battery?: number;
  lastActivity?: Date;
}

export const SecurityDashboard: React.FC = () => {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [devices, setDevices] = useState<SecurityDevice[]>([]);
  const [systemStatus, setSystemStatus] = useState<'armed' | 'disarmed'>('disarmed');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSecurityData();
    const interval = setInterval(loadSecurityData, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadSecurityData = async () => {
    try {
      // In production, fetch from API
      setLoading(false);
    } catch (error) {
      console.error('Failed to load security data:', error);
    }
  };

  const handleArmSystem = async () => {
    try {
      // In production, call API to arm system
      setSystemStatus('armed');
    } catch (error) {
      console.error('Failed to arm system:', error);
    }
  };

  const handleDisarmSystem = async () => {
    try {
      // In production, call API to disarm system
      setSystemStatus('disarmed');
    } catch (error) {
      console.error('Failed to disarm system:', error);
    }
  };

  const handleResolveEvent = async (eventId: string) => {
    try {
      // In production, call API to resolve event
      setEvents(prev => prev.map(e => 
        e.id === eventId ? { ...e, resolved: true } : e
      ));
    } catch (error) {
      console.error('Failed to resolve event:', error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return '#f44336';
      case 'medium': return '#ff9800';
      case 'low': return '#4CAF50';
      default: return '#999';
    }
  };

  if (loading) {
    return <div className="security-dashboard loading">Loading security dashboard...</div>;
  }

  return (
    <div className="security-dashboard">
      <div className="dashboard-header">
        <h2>Security Dashboard</h2>
        <div className="system-controls">
          <div className={`system-status ${systemStatus}`}>
            System {systemStatus.toUpperCase()}
          </div>
          {systemStatus === 'disarmed' ? (
            <button onClick={handleArmSystem} className="btn-arm">
              Arm System
            </button>
          ) : (
            <button onClick={handleDisarmSystem} className="btn-disarm">
              Disarm System
            </button>
          )}
        </div>
      </div>

      <div className="security-overview">
        <div className="overview-card">
          <h3>Active Alerts</h3>
          <div className="stat-value">{events.filter(e => !e.resolved).length}</div>
        </div>

        <div className="overview-card">
          <h3>Armed Devices</h3>
          <div className="stat-value">
            {devices.filter(d => d.status === 'armed').length}
          </div>
        </div>

        <div className="overview-card">
          <h3>Offline Devices</h3>
          <div className="stat-value">
            {devices.filter(d => d.status === 'offline').length}
          </div>
        </div>

        <div className="overview-card">
          <h3>Low Battery</h3>
          <div className="stat-value">
            {devices.filter(d => d.battery && d.battery < 20).length}
          </div>
        </div>
      </div>

      <div className="security-content">
        <div className="events-section">
          <h3>Recent Events</h3>
          <div className="events-list">
            {events.length === 0 ? (
              <div className="no-events">No security events</div>
            ) : (
              events.map(event => (
                <div 
                  key={event.id} 
                  className={`event-card ${event.resolved ? 'resolved' : ''}`}
                  style={{ borderLeftColor: getSeverityColor(event.severity) }}
                >
                  <div className="event-header">
                    <span className="event-type">{event.type}</span>
                    <span className="event-time">
                      {event.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="event-message">{event.message}</div>
                  <div className="event-location">{event.location}</div>
                  {!event.resolved && (
                    <button 
                      onClick={() => handleResolveEvent(event.id)}
                      className="btn-resolve"
                    >
                      Resolve
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="devices-section">
          <h3>Security Devices</h3>
          <div className="devices-grid">
            {devices.map(device => (
              <div key={device.id} className="device-card">
                <div className="device-header">
                  <span className="device-name">{device.name}</span>
                  <span className={`device-status ${device.status}`}>
                    {device.status}
                  </span>
                </div>
                <div className="device-type">{device.type}</div>
                {device.battery !== undefined && (
                  <div className="device-battery">
                    Battery: {device.battery}%
                  </div>
                )}
                {device.lastActivity && (
                  <div className="device-activity">
                    Last activity: {device.lastActivity.toLocaleString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
