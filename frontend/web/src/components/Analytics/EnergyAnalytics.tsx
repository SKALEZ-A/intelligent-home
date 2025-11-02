import React, { useState, useEffect } from 'react';
import './EnergyAnalytics.css';

interface EnergyData {
  timestamp: Date;
  consumption: number;
  cost: number;
  source: string;
}

export const EnergyAnalytics: React.FC = () => {
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month' | 'year'>('week');
  const [energyData, setEnergyData] = useState<EnergyData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEnergyData();
  }, [timeRange]);

  const fetchEnergyData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/energy/analytics?range=${timeRange}`);
      const data = await response.json();
      setEnergyData(data);
    } catch (error) {
      console.error('Failed to fetch energy data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalConsumption = () => {
    return energyData.reduce((sum, d) => sum + d.consumption, 0).toFixed(2);
  };

  const calculateTotalCost = () => {
    return energyData.reduce((sum, d) => sum + d.cost, 0).toFixed(2);
  };

  const calculateAverageDaily = () => {
    if (energyData.length === 0) return '0';
    const days = timeRange === 'day' ? 1 : timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : 365;
    return (energyData.reduce((sum, d) => sum + d.consumption, 0) / days).toFixed(2);
  };

  return (
    <div className="energy-analytics">
      <div className="energy-analytics__header">
        <h2 className="energy-analytics__title">Energy Analytics</h2>
        <div className="energy-analytics__filters">
          <button
            className={`energy-analytics__filter-button ${timeRange === 'day' ? 'energy-analytics__filter-button--active' : ''}`}
            onClick={() => setTimeRange('day')}
          >
            Day
          </button>
          <button
            className={`energy-analytics__filter-button ${timeRange === 'week' ? 'energy-analytics__filter-button--active' : ''}`}
            onClick={() => setTimeRange('week')}
          >
            Week
          </button>
          <button
            className={`energy-analytics__filter-button ${timeRange === 'month' ? 'energy-analytics__filter-button--active' : ''}`}
            onClick={() => setTimeRange('month')}
          >
            Month
          </button>
          <button
            className={`energy-analytics__filter-button ${timeRange === 'year' ? 'energy-analytics__filter-button--active' : ''}`}
            onClick={() => setTimeRange('year')}
          >
            Year
          </button>
        </div>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="energy-analytics__content">
          <div className="energy-analytics__card">
            <h3 className="energy-analytics__card-title">Consumption Overview</h3>
            <div className="energy-analytics__metric">
              <span className="energy-analytics__metric-label">Total Consumption</span>
              <span className="energy-analytics__metric-value">{calculateTotalConsumption()} kWh</span>
            </div>
            <div className="energy-analytics__metric">
              <span className="energy-analytics__metric-label">Total Cost</span>
              <span className="energy-analytics__metric-value">${calculateTotalCost()}</span>
            </div>
            <div className="energy-analytics__metric">
              <span className="energy-analytics__metric-label">Average Daily</span>
              <span className="energy-analytics__metric-value">{calculateAverageDaily()} kWh</span>
            </div>
          </div>

          <div className="energy-analytics__card">
            <h3 className="energy-analytics__card-title">Comparison</h3>
            <div className="energy-analytics__comparison">
              <div className="energy-analytics__comparison-item">
                <div className="energy-analytics__comparison-label">vs Last Period</div>
                <div className="energy-analytics__comparison-value">-12%</div>
              </div>
              <div className="energy-analytics__comparison-item">
                <div className="energy-analytics__comparison-label">vs Average</div>
                <div className="energy-analytics__comparison-value">+5%</div>
              </div>
            </div>
          </div>

          <div className="energy-analytics__card">
            <h3 className="energy-analytics__card-title">Peak Hours</h3>
            <div className="energy-analytics__metric">
              <span className="energy-analytics__metric-label">Morning Peak</span>
              <span className="energy-analytics__metric-value">7:00 AM - 9:00 AM</span>
            </div>
            <div className="energy-analytics__metric">
              <span className="energy-analytics__metric-label">Evening Peak</span>
              <span className="energy-analytics__metric-value">6:00 PM - 9:00 PM</span>
            </div>
          </div>
        </div>
      )}

      <div className="energy-analytics__recommendations">
        <h3 className="energy-analytics__recommendations-title">Energy Saving Recommendations</h3>
        <div className="energy-analytics__recommendation-item">
          Shift high-energy tasks to off-peak hours to save up to 20% on energy costs
        </div>
        <div className="energy-analytics__recommendation-item">
          Your HVAC system is consuming 35% more than average - consider maintenance
        </div>
        <div className="energy-analytics__recommendation-item">
          Enable smart scheduling for your water heater to reduce consumption by 15%
        </div>
      </div>
    </div>
  );
};
