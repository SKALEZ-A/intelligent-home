import React, { useState, useEffect } from 'react';
import './UsagePatterns.css';

interface Pattern {
  id: string;
  name: string;
  frequency: number;
  devices: string[];
  timeOfDay: string;
  confidence: number;
}

interface UsagePatternsProps {
  userId: string;
}

export const UsagePatterns: React.FC<UsagePatternsProps> = ({ userId }) => {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPattern, setSelectedPattern] = useState<Pattern | null>(null);

  useEffect(() => {
    fetchPatterns();
  }, [userId]);

  const fetchPatterns = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/analytics/patterns/${userId}`);
      const data = await response.json();
      setPatterns(data.patterns || []);
    } catch (error) {
      console.error('Failed to fetch patterns:', error);
    } finally {
      setLoading(false);
    }
  };

  const createSceneFromPattern = async (pattern: Pattern) => {
    try {
      await fetch('/api/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: pattern.name,
          devices: pattern.devices,
          trigger: { type: 'time', value: pattern.timeOfDay }
        })
      });
      alert('Scene created successfully!');
    } catch (error) {
      console.error('Failed to create scene:', error);
    }
  };

  if (loading) {
    return <div className="usage-patterns-loading">Loading patterns...</div>;
  }

  return (
    <div className="usage-patterns">
      <h2>Usage Patterns</h2>
      <div className="patterns-grid">
        {patterns.map(pattern => (
          <div 
            key={pattern.id} 
            className="pattern-card"
            onClick={() => setSelectedPattern(pattern)}
          >
            <h3>{pattern.name}</h3>
            <div className="pattern-stats">
              <span>Frequency: {pattern.frequency}x</span>
              <span>Confidence: {(pattern.confidence * 100).toFixed(0)}%</span>
            </div>
            <div className="pattern-time">{pattern.timeOfDay}</div>
            <div className="pattern-devices">
              {pattern.devices.length} devices
            </div>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                createSceneFromPattern(pattern);
              }}
              className="create-scene-btn"
            >
              Create Scene
            </button>
          </div>
        ))}
      </div>

      {selectedPattern && (
        <div className="pattern-modal" onClick={() => setSelectedPattern(null)}>
          <div className="pattern-modal-content" onClick={e => e.stopPropagation()}>
            <h3>{selectedPattern.name}</h3>
            <p>This pattern occurs {selectedPattern.frequency} times</p>
            <p>Time: {selectedPattern.timeOfDay}</p>
            <h4>Devices:</h4>
            <ul>
              {selectedPattern.devices.map(device => (
                <li key={device}>{device}</li>
              ))}
            </ul>
            <button onClick={() => setSelectedPattern(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};
