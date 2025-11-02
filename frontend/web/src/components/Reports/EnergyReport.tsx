import React, { useState, useEffect } from 'react';
import './EnergyReport.css';

interface DeviceConsumption {
  deviceId: string;
  deviceName: string;
  icon: string;
  consumption: number;
  percentage: number;
  usageHours: number;
}

export const EnergyReport: React.FC = () => {
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('month');
  const [totalConsumption, setTotalConsumption] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  const [change, setChange] = useState(0);
  const [devices, setDevices] = useState<DeviceConsumption[]>([]);

  useEffect(() => {
    fetchEnergyData();
  }, [period]);

  const fetchEnergyData = async () => {
    const mockDevices: DeviceConsumption[] = [
      {
        deviceId: '1',
        deviceName: 'Air Conditioner',
        icon: '❄️',
        consumption: 245.5,
        percentage: 35,
        usageHours: 180
      },
      {
        deviceId: '2',
        deviceName: 'Water Heater',
        icon: '🚿',
        consumption: 180.2,
        percentage: 26,
        usageHours: 120
      },
      {
        deviceId: '3',
        deviceName: 'Refrigerator',
        icon: '🧊',
        consumption: 120.8,
        percentage: 17,
        usageHours: 720
      },
      {
        deviceId: '4',
        deviceName: 'Lighting',
        icon: '💡',
        consumption: 85.3,
        percentage: 12,
        usageHours: 300
      },
      {
        deviceId: '5',
        deviceName: 'TV & Entertainment',
        icon: '📺',
        consumption: 70.2,
        percentage: 10,
        usageHours: 150
      }
    ];

    const total = mockDevices.reduce((sum, d) => sum + d.consumption, 0);
    setTotalConsumption(total);
    setTotalCost(total * 0.12);
    setChange(-8.5);
    setDevices(mockDevices);
  };

  const exportReport = () => {
    console.log('Exporting energy report...');
  };

  return (
    <div className="energy-report">
      <div className="report-header">
        <h2>Energy Consumption Report</h2>
        <div className="report-period">
          <label>Period:</label>
          <select value={period} onChange={(e) => setPeriod(e.target.value as any)}>
            <option value="day">Last 24 Hours</option>
            <option value="week">Last Week</option>
            <option value="month">Last Month</option>
            <option value="year">Last Year</option>
          </select>
        </div>
      </div>

      <div className="report-summary">
        <div className="summary-card">
          <h3>Total Consumption</h3>
          <p className="summary-value">{totalConsumption.toFixed(1)} kWh</p>
          <div className={`summary-change ${change < 0 ? 'positive' : 'negative'}`}>
            <span>{change < 0 ? '↓' : '↑'}</span>
            <span>{Math.abs(change)}% vs last period</span>
          </div>
        </div>

        <div className="summary-card">
          <h3>Total Cost</h3>
          <p className="summary-value">${totalCost.toFixed(2)}</p>
          <div className={`summary-change ${change < 0 ? 'positive' : 'negative'}`}>
            <span>{change < 0 ? '↓' : '↑'}</span>
            <span>${(Math.abs(change) * totalCost / 100).toFixed(2)}</span>
          </div>
        </div>

        <div className="summary-card">
          <h3>Average Daily</h3>
          <p className="summary-value">{(totalConsumption / 30).toFixed(1)} kWh</p>
          <div className="summary-change positive">
            <span>↓</span>
            <span>5.2% improvement</span>
          </div>
        </div>

        <div className="summary-card">
          <h3>Peak Usage</h3>
          <p className="summary-value">18:00</p>
          <div className="summary-change">
            <span>Evening hours</span>
          </div>
        </div>
      </div>

      <div className="device-breakdown">
        <h3>Device Breakdown</h3>
        <div className="device-list">
          {devices.map((device) => (
            <div key={device.deviceId} className="device-item">
              <div className="device-info">
                <div className="device-icon">{device.icon}</div>
                <div className="device-details">
                  <h4>{device.deviceName}</h4>
                  <p className="device-usage">{device.usageHours} hours</p>
                </div>
              </div>
              <div className="device-consumption">
                <p className="consumption-value">{device.consumption.toFixed(1)} kWh</p>
                <p className="consumption-percentage">{device.percentage}% of total</p>
              </div>
            </div>
          ))}
        </div>

        <button className="export-button" onClick={exportReport}>
          Export Report
        </button>
      </div>
    </div>
  );
};
