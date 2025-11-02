import React, { useState, useEffect } from 'react';
import './UsageAnalytics.css';

interface UsageData {
  deviceId: string;
  deviceName: string;
  totalUsage: number;
  averageDaily: number;
  peakUsage: number;
  trend: 'up' | 'down' | 'stable';
}

export const UsageAnalytics: React.FC = () => {
  const [usageData, setUsageData] = useState<UsageData[]>([]);
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month'>('week');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsageData();
  }, [timeRange]);

  const fetchUsageData = async () => {
    setLoading(true);
    try {
      const mockData: UsageData[] = [
        {
          deviceId: '1',
          deviceName: 'Living Room Light',
          totalUsage: 45.5,
          averageDaily: 6.5,
          peakUsage: 12.3,
          trend: 'up'
        },
        {
          deviceId: '2',
          deviceName: 'Thermostat',
          totalUsage: 120.8,
          averageDaily: 17.3,
          peakUsage: 25.6,
          trend: 'down'
        }
      ];
      setUsageData(mockData);
    } catch (error) {
      console.error('Failed to fetch usage data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return '↑';
      case 'down': return '↓';
      default: return '→';
    }
  };

  if (loading) {
    return <div className="usage-analytics-loading">Loading analytics...</div>;
  }

  return (
    <div className="usage-analytics">
      <div className="analytics-header">
        <h2>Usage Analytics</h2>
        <div className="time-range-selector">
          <button 
            className={timeRange === 'day' ? 'active' : ''}
            onClick={() => setTimeRange('day')}
          >
            Day
          </button>
          <button 
            className={timeRange === 'week' ? 'active' : ''}
            onClick={() => setTimeRange('week')}
          >
            Week
          </button>
          <button 
            className={timeRange === 'month' ? 'active' : ''}
            onClick={() => setTimeRange('month')}
          >
            Month
          </button>
        </div>
      </div>

      <div className="usage-grid">
        {usageData.map(device => (
          <div key={device.deviceId} className="usage-card">
            <h3>{device.deviceName}</h3>
            <div className="usage-stats">
              <div className="stat">
                <span className="label">Total Usage</span>
                <span className="value">{device.totalUsage} kWh</span>
              </div>
              <div className="stat">
                <span className="label">Daily Average</span>
                <span className="value">{device.averageDaily} kWh</span>
              </div>
              <div className="stat">
                <span className="label">Peak Usage</span>
                <span className="value">{device.peakUsage} kWh</span>
              </div>
              <div className={`trend trend-${device.trend}`}>
                {getTrendIcon(device.trend)} {device.trend}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
