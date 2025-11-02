import React, { useState, useEffect } from 'react';
import './DeviceTimeline.css';

interface TimelineEvent {
  id: string;
  deviceId: string;
  deviceName: string;
  timestamp: number;
  type: 'state_change' | 'error' | 'maintenance' | 'update';
  description: string;
  details?: any;
}

interface DeviceTimelineProps {
  deviceId?: string;
}

export const DeviceTimeline: React.FC<DeviceTimelineProps> = ({ deviceId }) => {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    fetchEvents();
  }, [deviceId]);

  const fetchEvents = async () => {
    try {
      const url = deviceId 
        ? `/api/devices/${deviceId}/timeline`
        : '/api/devices/timeline';
      
      const response = await fetch(url);
      const data = await response.json();
      setEvents(data.events || []);
    } catch (error) {
      console.error('Failed to fetch timeline:', error);
    }
  };

  const filteredEvents = events.filter(event => {
    if (filter === 'all') return true;
    return event.type === filter;
  });

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 3600000) {
      return `${Math.floor(diff / 60000)} minutes ago`;
    } else if (diff < 86400000) {
      return `${Math.floor(diff / 3600000)} hours ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getEventIcon = (type: string): string => {
    switch (type) {
      case 'state_change': return '🔄';
      case 'error': return '⚠️';
      case 'maintenance': return '🔧';
      case 'update': return '⬆️';
      default: return '📌';
    }
  };

  const getEventColor = (type: string): string => {
    switch (type) {
      case 'state_change': return '#007bff';
      case 'error': return '#dc3545';
      case 'maintenance': return '#ffc107';
      case 'update': return '#28a745';
      default: return '#6c757d';
    }
  };

  return (
    <div className="device-timeline">
      <div className="timeline-header">
        <h2>Device Timeline</h2>
        <div className="filter-buttons">
          <button
            className={filter === 'all' ? 'active' : ''}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={filter === 'state_change' ? 'active' : ''}
            onClick={() => setFilter('state_change')}
          >
            State Changes
          </button>
          <button
            className={filter === 'error' ? 'active' : ''}
            onClick={() => setFilter('error')}
          >
            Errors
          </button>
          <button
            className={filter === 'maintenance' ? 'active' : ''}
            onClick={() => setFilter('maintenance')}
          >
            Maintenance
          </button>
        </div>
      </div>

      <div className="timeline-events">
        {filteredEvents.map(event => (
          <div key={event.id} className="timeline-event">
            <div
              className="event-marker"
              style={{ backgroundColor: getEventColor(event.type) }}
            >
              {getEventIcon(event.type)}
            </div>
            <div className="event-content">
              <div className="event-header">
                <span className="event-device">{event.deviceName}</span>
                <span className="event-time">{formatTimestamp(event.timestamp)}</span>
              </div>
              <div className="event-description">{event.description}</div>
              {event.details && (
                <div className="event-details">
                  <pre>{JSON.stringify(event.details, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
