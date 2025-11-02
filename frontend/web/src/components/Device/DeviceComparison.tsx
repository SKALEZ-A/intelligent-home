import React, { useState } from 'react';
import './DeviceComparison.css';

interface Device {
  id: string;
  name: string;
  type: string;
  powerConsumption: number;
  uptime: number;
  responseTime: number;
  errorRate: number;
  lastMaintenance: string;
}

interface DeviceComparisonProps {
  devices: Device[];
}

export const DeviceComparison: React.FC<DeviceComparisonProps> = ({ devices }) => {
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);

  const toggleDevice = (deviceId: string) => {
    setSelectedDevices(prev => 
      prev.includes(deviceId)
        ? prev.filter(id => id !== deviceId)
        : [...prev, deviceId]
    );
  };

  const comparedDevices = devices.filter(d => selectedDevices.includes(d.id));

  const metrics = [
    { key: 'powerConsumption', label: 'Power Consumption (W)', format: (v: number) => v.toFixed(2) },
    { key: 'uptime', label: 'Uptime (%)', format: (v: number) => v.toFixed(1) },
    { key: 'responseTime', label: 'Response Time (ms)', format: (v: number) => v.toFixed(0) },
    { key: 'errorRate', label: 'Error Rate (%)', format: (v: number) => v.toFixed(2) },
    { key: 'lastMaintenance', label: 'Last Maintenance', format: (v: string) => v }
  ];

  return (
    <div className="device-comparison">
      <h2>Device Comparison</h2>
      
      <div className="device-selector">
        <h3>Select Devices to Compare</h3>
        <div className="device-list">
          {devices.map(device => (
            <label key={device.id} className="device-checkbox">
              <input
                type="checkbox"
                checked={selectedDevices.includes(device.id)}
                onChange={() => toggleDevice(device.id)}
              />
              <span>{device.name}</span>
            </label>
          ))}
        </div>
      </div>

      {comparedDevices.length > 0 && (
        <div className="comparison-table">
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                {comparedDevices.map(device => (
                  <th key={device.id}>{device.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.map(metric => (
                <tr key={metric.key}>
                  <td className="metric-label">{metric.label}</td>
                  {comparedDevices.map(device => (
                    <td key={device.id}>
                      {metric.format((device as any)[metric.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
