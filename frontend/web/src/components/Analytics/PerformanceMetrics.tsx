import React, { useState, useEffect } from 'react';
import './PerformanceMetrics.css';

interface MetricData {
  label: string;
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  trendValue: number;
  status: 'good' | 'warning' | 'critical';
}

interface SystemMetrics {
  cpu: MetricData;
  memory: MetricData;
  network: MetricData;
  storage: MetricData;
  responseTime: MetricData;
  uptime: MetricData;
}

interface PerformanceMetricsProps {
  refreshInterval?: number;
  onAlert?: (metric: string, value: number) => void;
}

export const PerformanceMetrics: React.FC<PerformanceMetricsProps> = ({
  refreshInterval = 5000,
  onAlert
}) => {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('1h');

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval, selectedTimeRange]);

  const fetchMetrics = async () => {
    try {
      // Simulated API call
      const data = await simulateMetricsFetch();
      setMetrics(data);
      setIsLoading(false);
      setError(null);

      // Check for alerts
      checkAlerts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
      setIsLoading(false);
    }
  };

  const simulateMetricsFetch = async (): Promise<SystemMetrics> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    return {
      cpu: {
        label: 'CPU Usage',
        value: Math.random() * 100,
        unit: '%',
        trend: Math.random() > 0.5 ? 'up' : 'down',
        trendValue: Math.random() * 10,
        status: Math.random() > 0.7 ? 'warning' : 'good'
      },
      memory: {
        label: 'Memory Usage',
        value: 60 + Math.random() * 30,
        unit: '%',
        trend: Math.random() > 0.5 ? 'up' : 'down',
        trendValue: Math.random() * 5,
        status: Math.random() > 0.8 ? 'warning' : 'good'
      },
      network: {
        label: 'Network Traffic',
        value: Math.random() * 1000,
        unit: 'Mbps',
        trend: 'stable',
        trendValue: 0,
        status: 'good'
      },
      storage: {
        label: 'Storage Used',
        value: 45 + Math.random() * 40,
        unit: '%',
        trend: 'up',
        trendValue: Math.random() * 2,
        status: Math.random() > 0.9 ? 'critical' : 'good'
      },
      responseTime: {
        label: 'Avg Response Time',
        value: 50 + Math.random() * 200,
        unit: 'ms',
        trend: Math.random() > 0.5 ? 'down' : 'up',
        trendValue: Math.random() * 20,
        status: Math.random() > 0.7 ? 'warning' : 'good'
      },
      uptime: {
        label: 'System Uptime',
        value: 99.5 + Math.random() * 0.5,
        unit: '%',
        trend: 'stable',
        trendValue: 0,
        status: 'good'
      }
    };
  };

  const checkAlerts = (data: SystemMetrics) => {
    if (!onAlert) return;

    Object.entries(data).forEach(([key, metric]) => {
      if (metric.status === 'critical') {
        onAlert(key, metric.value);
      }
    });
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'good':
        return '#4caf50';
      case 'warning':
        return '#ff9800';
      case 'critical':
        return '#f44336';
      default:
        return '#9e9e9e';
    }
  };

  const getTrendIcon = (trend: string): string => {
    switch (trend) {
      case 'up':
        return '↑';
      case 'down':
        return '↓';
      case 'stable':
        return '→';
      default:
        return '';
    }
  };

  const formatValue = (value: number, unit: string): string => {
    if (unit === '%') {
      return value.toFixed(1);
    } else if (unit === 'ms') {
      return Math.round(value).toString();
    } else if (unit === 'Mbps') {
      return value.toFixed(2);
    }
    return value.toFixed(2);
  };

  if (isLoading && !metrics) {
    return (
      <div className="performance-metrics loading">
        <div className="spinner"></div>
        <p>Loading metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="performance-metrics error">
        <p>Error: {error}</p>
        <button onClick={fetchMetrics}>Retry</button>
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  return (
    <div className="performance-metrics">
      <div className="metrics-header">
        <h2>System Performance</h2>
        <div className="time-range-selector">
          {(['1h', '24h', '7d', '30d'] as const).map(range => (
            <button
              key={range}
              className={selectedTimeRange === range ? 'active' : ''}
              onClick={() => setSelectedTimeRange(range)}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <div className="metrics-grid">
        {Object.entries(metrics).map(([key, metric]) => (
          <div key={key} className="metric-card">
            <div className="metric-header">
              <span className="metric-label">{metric.label}</span>
              <span
                className="metric-status"
                style={{ backgroundColor: getStatusColor(metric.status) }}
              />
            </div>

            <div className="metric-value">
              <span className="value">{formatValue(metric.value, metric.unit)}</span>
              <span className="unit">{metric.unit}</span>
            </div>

            <div className="metric-trend">
              <span className={`trend-icon ${metric.trend}`}>
                {getTrendIcon(metric.trend)}
              </span>
              <span className="trend-value">
                {metric.trendValue.toFixed(1)}% vs previous period
              </span>
            </div>

            <div className="metric-chart">
              <div
                className="progress-bar"
                style={{
                  width: `${Math.min(100, metric.value)}%`,
                  backgroundColor: getStatusColor(metric.status)
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="metrics-summary">
        <div className="summary-card">
          <h3>Overall Health</h3>
          <div className="health-score">
            <div className="score-circle">
              <svg viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="#e0e0e0"
                  strokeWidth="10"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="#4caf50"
                  strokeWidth="10"
                  strokeDasharray={`${2 * Math.PI * 45}`}
                  strokeDashoffset={`${2 * Math.PI * 45 * (1 - 0.85)}`}
                  transform="rotate(-90 50 50)"
                />
              </svg>
              <div className="score-text">85%</div>
            </div>
            <p>System is performing well</p>
          </div>
        </div>

        <div className="summary-card">
          <h3>Active Alerts</h3>
          <div className="alerts-list">
            {Object.entries(metrics)
              .filter(([_, metric]) => metric.status !== 'good')
              .map(([key, metric]) => (
                <div key={key} className={`alert-item ${metric.status}`}>
                  <span className="alert-icon">⚠</span>
                  <span className="alert-text">
                    {metric.label}: {formatValue(metric.value, metric.unit)}{metric.unit}
                  </span>
                </div>
              ))}
            {Object.values(metrics).every(m => m.status === 'good') && (
              <p className="no-alerts">No active alerts</p>
            )}
          </div>
        </div>

        <div className="summary-card">
          <h3>Quick Stats</h3>
          <div className="quick-stats">
            <div className="stat">
              <span className="stat-label">Avg CPU</span>
              <span className="stat-value">
                {formatValue(metrics.cpu.value, '%')}%
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">Avg Memory</span>
              <span className="stat-value">
                {formatValue(metrics.memory.value, '%')}%
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">Response Time</span>
              <span className="stat-value">
                {formatValue(metrics.responseTime.value, 'ms')}ms
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">Uptime</span>
              <span className="stat-value">
                {formatValue(metrics.uptime.value, '%')}%
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="metrics-footer">
        <span className="last-updated">
          Last updated: {new Date().toLocaleTimeString()}
        </span>
        <button className="refresh-button" onClick={fetchMetrics}>
          Refresh
        </button>
      </div>
    </div>
  );
};
