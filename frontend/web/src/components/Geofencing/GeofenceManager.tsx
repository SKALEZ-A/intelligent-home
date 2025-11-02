import React, { useState, useEffect } from 'react';
import './GeofenceManager.css';

interface Geofence {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  active: boolean;
  triggerOnEnter: boolean;
  triggerOnExit: boolean;
}

export const GeofenceManager: React.FC = () => {
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    latitude: 0,
    longitude: 0,
    radius: 100
  });

  useEffect(() => {
    fetchGeofences();
  }, []);

  const fetchGeofences = async () => {
    try {
      const mockGeofences: Geofence[] = [
        {
          id: '1',
          name: 'Home',
          latitude: 37.7749,
          longitude: -122.4194,
          radius: 200,
          active: true,
          triggerOnEnter: true,
          triggerOnExit: true
        }
      ];
      setGeofences(mockGeofences);
    } catch (error) {
      console.error('Failed to fetch geofences:', error);
    }
  };

  const createGeofence = async () => {
    try {
      await fetch('/api/geofences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      setShowForm(false);
      fetchGeofences();
    } catch (error) {
      console.error('Failed to create geofence:', error);
    }
  };

  const deleteGeofence = async (id: string) => {
    if (!confirm('Delete this geofence?')) return;
    
    try {
      await fetch(`/api/geofences/${id}`, { method: 'DELETE' });
      fetchGeofences();
    } catch (error) {
      console.error('Failed to delete geofence:', error);
    }
  };

  return (
    <div className="geofence-manager">
      <div className="geofence-header">
        <h2>Geofence Manager</h2>
        <button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'Add Geofence'}
        </button>
      </div>

      {showForm && (
        <div className="geofence-form">
          <input
            type="text"
            placeholder="Name"
            value={formData.name}
            onChange={e => setFormData({...formData, name: e.target.value})}
          />
          <input
            type="number"
            placeholder="Latitude"
            value={formData.latitude}
            onChange={e => setFormData({...formData, latitude: parseFloat(e.target.value)})}
          />
          <input
            type="number"
            placeholder="Longitude"
            value={formData.longitude}
            onChange={e => setFormData({...formData, longitude: parseFloat(e.target.value)})}
          />
          <input
            type="number"
            placeholder="Radius (meters)"
            value={formData.radius}
            onChange={e => setFormData({...formData, radius: parseInt(e.target.value)})}
          />
          <button onClick={createGeofence}>Create</button>
        </div>
      )}

      <div className="geofence-list">
        {geofences.map(geofence => (
          <div key={geofence.id} className="geofence-card">
            <h3>{geofence.name}</h3>
            <p>Lat: {geofence.latitude}, Lng: {geofence.longitude}</p>
            <p>Radius: {geofence.radius}m</p>
            <div className="geofence-actions">
              <button onClick={() => deleteGeofence(geofence.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
