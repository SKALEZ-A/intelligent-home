import React, { useState, useEffect } from 'react';
import './DeviceAnalytics.css';

interface DeviceUsageData {
  deviceId: string;
  deviceName: string;
  totalUsageTime: number;
  activations: number;
  energyConsumed: number;
  lastUsed: Date;
}

export const DeviceAnalytics: React.FC = () => {
  const [usageData, setUsageData] = useState<DeviceUsageData[]>([]);
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month'>('week');
  const [sortBy, setSortBy] = useState<'usage' | 'energy' | 'activations'>('usage');

  useEffect(() => {
    fetchDeviceAnalytics();
  }, [timeRange]);

  const fetchDeviceAnalytics = async () => {
    const mockData: DeviceUsageData[] = [
      {
        deviceId: '1',
        deviceName: 'Living Room Light',
        totalUsageTime: 120,
        activations: 45,
        energyConsumed: 2.5,
        lastUsed: new Date()
      },
      {
        deviceId: '2',
        deviceName: 'Thermostat',
        totalUsageTime: 168,
        activations: 12,
        energyConsumed: 15.3,
        lastUsed: new Date()
      },
      {
        deviceId: '3',
        deviceName: 'Smart TV',
        totalUsageTime: 35,
        activations: 8,
        energyConsumed: 8.7,
        lastUsed: new Date()
      }
    ];
    setUsageData(mockData);
  };

  const sortedData = [...usageData].sort((a, b) => {
    switch (sortBy) {
      case 'usage':
        return b.totalUsageTime - a.totalUsageTime;
      case 'energy':
        return b.energyConsumed - a.energyConsumed;
      case 'activations':
        return b.activations - a.activations;
      default:
        return 0;
    }
  });

  return (
    <div className="device-analytics">
      <div className="analytics-header">
        <h2>Device Analytics</h2>
        <div className="controls">
          <select value={timeRange} onChange={(e) => setTimeRange(e.target.value as any)}>
            <option value="day">Last 24 Hours</option>
            <option value="week">Last Week</option>
            <option value="month">Last Month</option>
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
            <option value="usage">Sort by Usage Time</option>
            <option value="energy">Sort by Energy</option>
            <option value="activations">Sort by Activations</option>
          </select>
        </div>
      </div>

      <div className="analytics-summary">
        <div className="summary-card">
          <h3>Total Devices</h3>
          <p className="summary-value">{usageData.length}</p>
        </div>
        <div className="summary-card">
          <h3>Total Usage Time</h3>
          <p className="summary-value">
            {usageData.reduce((sum, d) => sum + d.totalUsageTime, 0)} hrs
          </p>
        </div>
        <div className="summary-card">
          <h3>Total Energy</h3>
          <p className="summary-value">
            {usageData.reduce((sum, d) => sum + d.energyConsumed, 0).toFixed(2)} kWh
          </p>
        </div>
        <div className="summary-card">
          <h3>Total Activations</h3>
          <p className="summary-value">
            {usageData.reduce((sum, d) => sum + d.activations, 0)}
          </p>
        </div>
      </div>

      <div className="device-list">
        {sortedData.map((device) => (
          <div key={device.deviceId} className="device-analytics-card">
            <div className="device-info">
              <h3>{device.deviceName}</h3>
              <p className="device-id">ID: {device.deviceId}</p>
            </div>
            <div className="device-stats">
              <div className="stat">
                <span className="stat-label">Usage Time</span>
                <span className="stat-value">{device.totalUsageTime} hrs</span>
              </div>
              <div className="stat">
                <span className="stat-label">Activations</span>
                <span className="stat-value">{device.activations}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Energy</span>
                <span className="stat-value">{device.energyConsumed.toFixed(2)} kWh</span>
              </div>
              <div className="stat">
                <span className="stat-label">Last Used</span>
                <span className="stat-value">
                  {device.lastUsed.toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
