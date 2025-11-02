import React, { useState, useEffect } from 'react';
import './EnergyGoals.css';

interface EnergyGoal {
  id: string;
  name: string;
  type: 'daily' | 'weekly' | 'monthly';
  target: number;
  current: number;
  unit: 'kWh' | 'cost';
  startDate: string;
  endDate: string;
  status: 'on_track' | 'at_risk' | 'exceeded';
}

export const EnergyGoals: React.FC = () => {
  const [goals, setGoals] = useState<EnergyGoal[]>([]);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [newGoal, setNewGoal] = useState({
    name: '',
    type: 'daily' as const,
    target: 0,
    unit: 'kWh' as const
  });

  useEffect(() => {
    fetchGoals();
  }, []);

  const fetchGoals = async () => {
    try {
      const response = await fetch('/api/energy/goals');
      const data = await response.json();
      setGoals(data.goals || []);
    } catch (error) {
      console.error('Failed to fetch goals:', error);
    }
  };

  const createGoal = async () => {
    try {
      await fetch('/api/energy/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newGoal)
      });
      
      setShowAddGoal(false);
      setNewGoal({ name: '', type: 'daily', target: 0, unit: 'kWh' });
      fetchGoals();
    } catch (error) {
      console.error('Failed to create goal:', error);
    }
  };

  const getProgressPercentage = (goal: EnergyGoal): number => {
    return Math.min((goal.current / goal.target) * 100, 100);
  };

  const getStatusColor = (status: EnergyGoal['status']): string => {
    switch (status) {
      case 'on_track': return '#28a745';
      case 'at_risk': return '#ffc107';
      case 'exceeded': return '#dc3545';
      default: return '#6c757d';
    }
  };

  return (
    <div className="energy-goals">
      <div className="goals-header">
        <h2>Energy Goals</h2>
        <button onClick={() => setShowAddGoal(true)} className="add-goal-btn">
          + Add Goal
        </button>
      </div>

      <div className="goals-grid">
        {goals.map(goal => (
          <div key={goal.id} className="goal-card">
            <div className="goal-header">
              <h3>{goal.name}</h3>
              <span className="goal-type">{goal.type}</span>
            </div>

            <div className="goal-progress">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${getProgressPercentage(goal)}%`,
                    backgroundColor: getStatusColor(goal.status)
                  }}
                />
              </div>
              <div className="progress-text">
                {goal.current.toFixed(2)} / {goal.target} {goal.unit}
              </div>
            </div>

            <div className="goal-status" style={{ color: getStatusColor(goal.status) }}>
              {goal.status.replace('_', ' ').toUpperCase()}
            </div>
          </div>
        ))}
      </div>

      {showAddGoal && (
        <div className="modal-overlay" onClick={() => setShowAddGoal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Create New Goal</h3>
            
            <div className="form-group">
              <label>Goal Name</label>
              <input
                type="text"
                value={newGoal.name}
                onChange={e => setNewGoal({ ...newGoal, name: e.target.value })}
                placeholder="e.g., Reduce Daily Usage"
              />
            </div>

            <div className="form-group">
              <label>Period</label>
              <select
                value={newGoal.type}
                onChange={e => setNewGoal({ ...newGoal, type: e.target.value as any })}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            <div className="form-group">
              <label>Target</label>
              <input
                type="number"
                value={newGoal.target}
                onChange={e => setNewGoal({ ...newGoal, target: parseFloat(e.target.value) })}
                placeholder="0"
              />
            </div>

            <div className="form-group">
              <label>Unit</label>
              <select
                value={newGoal.unit}
                onChange={e => setNewGoal({ ...newGoal, unit: e.target.value as any })}
              >
                <option value="kWh">kWh</option>
                <option value="cost">Cost ($)</option>
              </select>
            </div>

            <div className="modal-actions">
              <button onClick={() => setShowAddGoal(false)} className="cancel-btn">
                Cancel
              </button>
              <button onClick={createGoal} className="create-btn">
                Create Goal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
