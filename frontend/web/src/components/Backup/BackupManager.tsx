import React, { useState, useEffect } from 'react';
import './BackupManager.css';

interface Backup {
  id: string;
  name: string;
  type: 'full' | 'incremental' | 'differential';
  size: number;
  createdAt: Date;
  status: 'completed' | 'in_progress' | 'failed';
  includes: string[];
  location: string;
}

interface BackupSchedule {
  id: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string;
  type: 'full' | 'incremental';
  enabled: boolean;
  lastRun?: Date;
  nextRun: Date;
}

export const BackupManager: React.FC = () => {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [schedules, setSchedules] = useState<BackupSchedule[]>([]);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchBackups();
    fetchSchedules();
  }, []);

  const fetchBackups = async () => {
    setIsLoading(true);
    try {
      // Simulated API call
      const mockBackups: Backup[] = [
        {
          id: '1',
          name: 'Full Backup - 2024-01-15',
          type: 'full',
          size: 2500000000,
          createdAt: new Date('2024-01-15T10:00:00'),
          status: 'completed',
          includes: ['devices', 'automations', 'scenes', 'users'],
          location: '/backups/full_2024-01-15.bak'
        },
        {
          id: '2',
          name: 'Incremental Backup - 2024-01-16',
          type: 'incremental',
          size: 150000000,
          createdAt: new Date('2024-01-16T10:00:00'),
          status: 'completed',
          includes: ['devices', 'automations'],
          location: '/backups/inc_2024-01-16.bak'
        }
      ];
      setBackups(mockBackups);
    } catch (error) {
      console.error('Failed to fetch backups:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSchedules = async () => {
    try {
      const mockSchedules: BackupSchedule[] = [
        {
          id: '1',
          name: 'Daily Incremental',
          frequency: 'daily',
          time: '02:00',
          type: 'incremental',
          enabled: true,
          lastRun: new Date('2024-01-16T02:00:00'),
          nextRun: new Date('2024-01-17T02:00:00')
        },
        {
          id: '2',
          name: 'Weekly Full Backup',
          frequency: 'weekly',
          time: '03:00',
          type: 'full',
          enabled: true,
          lastRun: new Date('2024-01-15T03:00:00'),
          nextRun: new Date('2024-01-22T03:00:00')
        }
      ];
      setSchedules(mockSchedules);
    } catch (error) {
      console.error('Failed to fetch schedules:', error);
    }
  };

  const createBackup = async (type: 'full' | 'incremental' | 'differential') => {
    setIsCreatingBackup(true);
    try {
      // Simulated backup creation
      await new Promise(resolve => setTimeout(resolve, 2000));
      await fetchBackups();
    } catch (error) {
      console.error('Failed to create backup:', error);
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const restoreBackup = async (backupId: string) => {
    if (!window.confirm('Are you sure you want to restore this backup? This will overwrite current data.')) {
      return;
    }

    try {
      // Simulated restore
      await new Promise(resolve => setTimeout(resolve, 3000));
      alert('Backup restored successfully');
    } catch (error) {
      console.error('Failed to restore backup:', error);
      alert('Failed to restore backup');
    }
  };

  const deleteBackup = async (backupId: string) => {
    if (!window.confirm('Are you sure you want to delete this backup?')) {
      return;
    }

    try {
      setBackups(backups.filter(b => b.id !== backupId));
    } catch (error) {
      console.error('Failed to delete backup:', error);
    }
  };

  const downloadBackup = (backup: Backup) => {
    // Simulated download
    alert(`Downloading backup: ${backup.name}`);
  };

  const formatSize = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleString();
  };

  const toggleSchedule = async (scheduleId: string) => {
    setSchedules(schedules.map(s => 
      s.id === scheduleId ? { ...s, enabled: !s.enabled } : s
    ));
  };

  if (isLoading) {
    return (
      <div className="backup-manager loading">
        <div className="spinner"></div>
        <p>Loading backups...</p>
      </div>
    );
  }

  return (
    <div className="backup-manager">
      <div className="backup-header">
        <h2>Backup & Restore</h2>
        <div className="backup-actions">
          <button
            className="btn-primary"
            onClick={() => createBackup('full')}
            disabled={isCreatingBackup}
          >
            {isCreatingBackup ? 'Creating...' : 'Create Full Backup'}
          </button>
          <button
            className="btn-secondary"
            onClick={() => createBackup('incremental')}
            disabled={isCreatingBackup}
          >
            Create Incremental
          </button>
          <button
            className="btn-secondary"
            onClick={() => setShowScheduleModal(true)}
          >
            Manage Schedules
          </button>
        </div>
      </div>

      <div className="backup-content">
        <div className="backup-section">
          <h3>Recent Backups</h3>
          <div className="backup-list">
            {backups.length === 0 ? (
              <div className="empty-state">
                <p>No backups found</p>
                <button onClick={() => createBackup('full')}>Create your first backup</button>
              </div>
            ) : (
              backups.map(backup => (
                <div key={backup.id} className="backup-item">
                  <div className="backup-info">
                    <div className="backup-name">
                      <span className={`backup-type-badge ${backup.type}`}>
                        {backup.type}
                      </span>
                      <h4>{backup.name}</h4>
                    </div>
                    <div className="backup-details">
                      <span className="backup-size">{formatSize(backup.size)}</span>
                      <span className="backup-date">{formatDate(backup.createdAt)}</span>
                      <span className={`backup-status ${backup.status}`}>
                        {backup.status}
                      </span>
                    </div>
                    <div className="backup-includes">
                      <strong>Includes:</strong> {backup.includes.join(', ')}
                    </div>
                  </div>
                  <div className="backup-actions-menu">
                    <button
                      className="btn-action"
                      onClick={() => restoreBackup(backup.id)}
                      disabled={backup.status !== 'completed'}
                    >
                      Restore
                    </button>
                    <button
                      className="btn-action"
                      onClick={() => downloadBackup(backup)}
                      disabled={backup.status !== 'completed'}
                    >
                      Download
                    </button>
                    <button
                      className="btn-action"
                      onClick={() => setSelectedBackup(backup)}
                    >
                      Details
                    </button>
                    <button
                      className="btn-danger"
                      onClick={() => deleteBackup(backup.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="backup-section">
          <h3>Backup Schedules</h3>
          <div className="schedule-list">
            {schedules.map(schedule => (
              <div key={schedule.id} className="schedule-item">
                <div className="schedule-info">
                  <h4>{schedule.name}</h4>
                  <div className="schedule-details">
                    <span>Frequency: {schedule.frequency}</span>
                    <span>Time: {schedule.time}</span>
                    <span>Type: {schedule.type}</span>
                  </div>
                  {schedule.lastRun && (
                    <div className="schedule-runs">
                      <span>Last run: {formatDate(schedule.lastRun)}</span>
                      <span>Next run: {formatDate(schedule.nextRun)}</span>
                    </div>
                  )}
                </div>
                <div className="schedule-controls">
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={schedule.enabled}
                      onChange={() => toggleSchedule(schedule.id)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                  <button className="btn-icon">⚙️</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedBackup && (
        <div className="modal-overlay" onClick={() => setSelectedBackup(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Backup Details</h3>
              <button className="modal-close" onClick={() => setSelectedBackup(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-row">
                <strong>Name:</strong>
                <span>{selectedBackup.name}</span>
              </div>
              <div className="detail-row">
                <strong>Type:</strong>
                <span>{selectedBackup.type}</span>
              </div>
              <div className="detail-row">
                <strong>Size:</strong>
                <span>{formatSize(selectedBackup.size)}</span>
              </div>
              <div className="detail-row">
                <strong>Created:</strong>
                <span>{formatDate(selectedBackup.createdAt)}</span>
              </div>
              <div className="detail-row">
                <strong>Status:</strong>
                <span className={`status-badge ${selectedBackup.status}`}>
                  {selectedBackup.status}
                </span>
              </div>
              <div className="detail-row">
                <strong>Location:</strong>
                <span>{selectedBackup.location}</span>
              </div>
              <div className="detail-row">
                <strong>Includes:</strong>
                <ul>
                  {selectedBackup.includes.map(item => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={() => restoreBackup(selectedBackup.id)}>
                Restore This Backup
              </button>
              <button className="btn-secondary" onClick={() => setSelectedBackup(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
