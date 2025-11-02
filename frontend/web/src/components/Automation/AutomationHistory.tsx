import React, { useState, useEffect } from 'react';
import './AutomationHistory.css';

interface AutomationExecution {
  id: string;
  automationName: string;
  timestamp: number;
  duration: number;
  status: 'success' | 'failed' | 'partial';
  trigger: string;
  actions: Array<{
    device: string;
    action: string;
    status: 'success' | 'failed';
  }>;
  error?: string;
}

export const AutomationHistory: React.FC = () => {
  const [executions, setExecutions] = useState<AutomationExecution[]>([]);
  const [filter, setFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [selectedExecution, setSelectedExecution] = useState<AutomationExecution | null>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await fetch('/api/automation/history');
      const data = await response.json();
      setExecutions(data.executions || []);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  };

  const filteredExecutions = executions.filter(exec => {
    if (filter === 'all') return true;
    return exec.status === filter;
  });

  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'success': return '#28a745';
      case 'failed': return '#dc3545';
      case 'partial': return '#ffc107';
      default: return '#6c757d';
    }
  };

  return (
    <div className="automation-history">
      <div className="history-header">
        <h2>Automation History</h2>
        <div className="filter-buttons">
          <button
            className={filter === 'all' ? 'active' : ''}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={filter === 'success' ? 'active' : ''}
            onClick={() => setFilter('success')}
          >
            Success
          </button>
          <button
            className={filter === 'failed' ? 'active' : ''}
            onClick={() => setFilter('failed')}
          >
            Failed
          </button>
        </div>
      </div>

      <div className="executions-list">
        {filteredExecutions.map(exec => (
          <div
            key={exec.id}
            className="execution-item"
            onClick={() => setSelectedExecution(exec)}
          >
            <div className="execution-main">
              <div className="execution-name">{exec.automationName}</div>
              <div className="execution-time">{formatTimestamp(exec.timestamp)}</div>
            </div>
            <div className="execution-details">
              <span className="execution-trigger">Trigger: {exec.trigger}</span>
              <span className="execution-duration">{exec.duration}ms</span>
              <span
                className="execution-status"
                style={{ color: getStatusColor(exec.status) }}
              >
                {exec.status.toUpperCase()}
              </span>
            </div>
          </div>
        ))}
      </div>

      {selectedExecution && (
        <div className="modal-overlay" onClick={() => setSelectedExecution(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>{selectedExecution.automationName}</h3>
            <p>Executed: {formatTimestamp(selectedExecution.timestamp)}</p>
            <p>Duration: {selectedExecution.duration}ms</p>
            <p>Trigger: {selectedExecution.trigger}</p>

            <h4>Actions:</h4>
            <ul className="actions-list">
              {selectedExecution.actions.map((action, idx) => (
                <li key={idx} className={`action-item ${action.status}`}>
                  <span>{action.device}</span>
                  <span>{action.action}</span>
                  <span>{action.status}</span>
                </li>
              ))}
            </ul>

            {selectedExecution.error && (
              <div className="error-message">
                <strong>Error:</strong> {selectedExecution.error}
              </div>
            )}

            <button onClick={() => setSelectedExecution(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};
