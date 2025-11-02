import React, { useState, useEffect } from 'react';
import './ScheduleManager.css';

interface Schedule {
  id: string;
  name: string;
  deviceId: string;
  deviceName: string;
  action: string;
  time: string;
  days: string[];
  enabled: boolean;
}

export const ScheduleManager: React.FC = () => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSchedule, setNewSchedule] = useState<Partial<Schedule>>({
    name: '',
    deviceId: '',
    action: 'turn_on',
    time: '08:00',
    days: [],
    enabled: true
  });

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    const mockSchedules: Schedule[] = [
      {
        id: '1',
        name: 'Morning Lights',
        deviceId: 'light-1',
        deviceName: 'Living Room Light',
        action: 'turn_on',
        time: '07:00',
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        enabled: true
      },
      {
        id: '2',
        name: 'Night Mode',
        deviceId: 'thermostat-1',
        deviceName: 'Thermostat',
        action: 'set_temperature',
        time: '22:00',
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        enabled: true
      }
    ];
    setSchedules(mockSchedules);
  };

  const handleAddSchedule = async () => {
    const schedule: Schedule = {
      id: Date.now().toString(),
      name: newSchedule.name || '',
      deviceId: newSchedule.deviceId || '',
      deviceName: 'Device Name',
      action: newSchedule.action || 'turn_on',
      time: newSchedule.time || '08:00',
      days: newSchedule.days || [],
      enabled: true
    };

    setSchedules([...schedules, schedule]);
    setShowAddModal(false);
    setNewSchedule({
      name: '',
      deviceId: '',
      action: 'turn_on',
      time: '08:00',
      days: [],
      enabled: true
    });
  };

  const toggleSchedule = async (scheduleId: string) => {
    setSchedules(schedules.map(s => 
      s.id === scheduleId ? { ...s, enabled: !s.enabled } : s
    ));
  };

  const deleteSchedule = async (scheduleId: string) => {
    if (window.confirm('Are you sure you want to delete this schedule?')) {
      setSchedules(schedules.filter(s => s.id !== scheduleId));
    }
  };

  const toggleDay = (day: string) => {
    const days = newSchedule.days || [];
    if (days.includes(day)) {
      setNewSchedule({ ...newSchedule, days: days.filter(d => d !== day) });
    } else {
      setNewSchedule({ ...newSchedule, days: [...days, day] });
    }
  };

  const allDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="schedule-manager">
      <div className="schedule-header">
        <h2>Schedule Manager</h2>
        <button className="add-schedule-btn" onClick={() => setShowAddModal(true)}>
          + Add Schedule
        </button>
      </div>

      <div className="schedules-list">
        {schedules.map((schedule) => (
          <div key={schedule.id} className="schedule-card">
            <div className="schedule-info">
              <h3>{schedule.name}</h3>
              <p className="device-name">{schedule.deviceName}</p>
              <div className="schedule-details">
                <span className="time">⏰ {schedule.time}</span>
                <span className="action">🎯 {schedule.action.replace('_', ' ')}</span>
              </div>
              <div className="days-badges">
                {schedule.days.map(day => (
                  <span key={day} className="day-badge">{day}</span>
                ))}
              </div>
            </div>
            <div className="schedule-actions">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={schedule.enabled}
                  onChange={() => toggleSchedule(schedule.id)}
                />
                <span className="slider"></span>
              </label>
              <button
                className="delete-btn"
                onClick={() => deleteSchedule(schedule.id)}
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Add New Schedule</h3>
            
            <div className="form-group">
              <label>Schedule Name</label>
              <input
                type="text"
                value={newSchedule.name}
                onChange={(e) => setNewSchedule({ ...newSchedule, name: e.target.value })}
                placeholder="Enter schedule name"
              />
            </div>

            <div className="form-group">
              <label>Time</label>
              <input
                type="time"
                value={newSchedule.time}
                onChange={(e) => setNewSchedule({ ...newSchedule, time: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Action</label>
              <select
                value={newSchedule.action}
                onChange={(e) => setNewSchedule({ ...newSchedule, action: e.target.value })}
              >
                <option value="turn_on">Turn On</option>
                <option value="turn_off">Turn Off</option>
                <option value="set_temperature">Set Temperature</option>
                <option value="set_brightness">Set Brightness</option>
              </select>
            </div>

            <div className="form-group">
              <label>Days</label>
              <div className="days-selector">
                {allDays.map(day => (
                  <button
                    key={day}
                    className={`day-btn ${newSchedule.days?.includes(day) ? 'selected' : ''}`}
                    onClick={() => toggleDay(day)}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <div className="modal-actions">
              <button onClick={() => setShowAddModal(false)}>Cancel</button>
              <button onClick={handleAddSchedule} disabled={!newSchedule.name || !newSchedule.days?.length}>
                Add Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
