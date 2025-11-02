import React, { useState } from 'react';
import './AutomationScheduler.css';

interface Schedule {
  type: 'time' | 'sunrise' | 'sunset' | 'interval';
  time?: string;
  offset?: number;
  interval?: number;
  days?: number[];
}

interface AutomationSchedulerProps {
  schedule?: Schedule;
  onChange: (schedule: Schedule) => void;
}

export const AutomationScheduler: React.FC<AutomationSchedulerProps> = ({ schedule, onChange }) => {
  const [scheduleType, setScheduleType] = useState<Schedule['type']>(schedule?.type || 'time');
  const [time, setTime] = useState(schedule?.time || '12:00');
  const [offset, setOffset] = useState(schedule?.offset || 0);
  const [interval, setInterval] = useState(schedule?.interval || 60);
  const [selectedDays, setSelectedDays] = useState<number[]>(schedule?.days || [0, 1, 2, 3, 4, 5, 6]);

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const handleTypeChange = (type: Schedule['type']) => {
    setScheduleType(type);
    updateSchedule(type);
  };

  const handleTimeChange = (newTime: string) => {
    setTime(newTime);
    updateSchedule(scheduleType, newTime);
  };

  const handleOffsetChange = (newOffset: number) => {
    setOffset(newOffset);
    updateSchedule(scheduleType, undefined, newOffset);
  };

  const handleIntervalChange = (newInterval: number) => {
    setInterval(newInterval);
    updateSchedule(scheduleType, undefined, undefined, newInterval);
  };

  const toggleDay = (day: number) => {
    const newDays = selectedDays.includes(day)
      ? selectedDays.filter(d => d !== day)
      : [...selectedDays, day].sort();
    
    setSelectedDays(newDays);
    updateSchedule(scheduleType, undefined, undefined, undefined, newDays);
  };

  const updateSchedule = (
    type: Schedule['type'],
    newTime?: string,
    newOffset?: number,
    newInterval?: number,
    newDays?: number[]
  ) => {
    const updatedSchedule: Schedule = {
      type,
      time: newTime || time,
      offset: newOffset !== undefined ? newOffset : offset,
      interval: newInterval || interval,
      days: newDays || selectedDays
    };

    onChange(updatedSchedule);
  };

  return (
    <div className="automation-scheduler">
      <div className="schedule-type-selector">
        <button
          className={scheduleType === 'time' ? 'active' : ''}
          onClick={() => handleTypeChange('time')}
        >
          Specific Time
        </button>
        <button
          className={scheduleType === 'sunrise' ? 'active' : ''}
          onClick={() => handleTypeChange('sunrise')}
        >
          Sunrise
        </button>
        <button
          className={scheduleType === 'sunset' ? 'active' : ''}
          onClick={() => handleTypeChange('sunset')}
        >
          Sunset
        </button>
        <button
          className={scheduleType === 'interval' ? 'active' : ''}
          onClick={() => handleTypeChange('interval')}
        >
          Interval
        </button>
      </div>

      <div className="schedule-config">
        {scheduleType === 'time' && (
          <div className="time-picker">
            <label>Time:</label>
            <input
              type="time"
              value={time}
              onChange={(e) => handleTimeChange(e.target.value)}
            />
          </div>
        )}

        {(scheduleType === 'sunrise' || scheduleType === 'sunset') && (
          <div className="offset-picker">
            <label>Offset (minutes):</label>
            <input
              type="number"
              value={offset}
              onChange={(e) => handleOffsetChange(parseInt(e.target.value))}
              min="-120"
              max="120"
            />
            <span className="offset-hint">
              {offset > 0 ? `${offset} minutes after` : offset < 0 ? `${Math.abs(offset)} minutes before` : 'Exactly at'} {scheduleType}
            </span>
          </div>
        )}

        {scheduleType === 'interval' && (
          <div className="interval-picker">
            <label>Run every:</label>
            <input
              type="number"
              value={interval}
              onChange={(e) => handleIntervalChange(parseInt(e.target.value))}
              min="1"
            />
            <span>minutes</span>
          </div>
        )}

        {scheduleType !== 'interval' && (
          <div className="day-selector">
            <label>Days:</label>
            <div className="days">
              {days.map((day, index) => (
                <button
                  key={index}
                  className={selectedDays.includes(index) ? 'active' : ''}
                  onClick={() => toggleDay(index)}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
