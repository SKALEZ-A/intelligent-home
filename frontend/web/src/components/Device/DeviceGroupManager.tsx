import React, { useState, useEffect } from 'react';
import deviceService from '../../services/device.service';
import './DeviceGroupManager.css';

interface DeviceGroup {
  id: string;
  name: string;
  description?: string;
  deviceIds: string[];
  icon?: string;
}

interface Device {
  id: string;
  name: string;
  type: string;
  status: string;
}

export const DeviceGroupManager: React.FC = () => {
  const [groups, setGroups] = useState<DeviceGroup[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<DeviceGroup | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);

  useEffect(() => {
    loadGroups();
    loadDevices();
  }, []);

  const loadGroups = async () => {
    try {
      const groupsData = await deviceService.getDeviceGroups();
      setGroups(groupsData);
    } catch (error) {
      console.error('Failed to load device groups:', error);
    }
  };

  const loadDevices = async () => {
    try {
      const devicesData = await deviceService.getDevices();
      setDevices(devicesData);
    } catch (error) {
      console.error('Failed to load devices:', error);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;

    try {
      await deviceService.createDeviceGroup({
        name: newGroupName,
        description: newGroupDescription,
        deviceIds: selectedDevices
      });

      setNewGroupName('');
      setNewGroupDescription('');
      setSelectedDevices([]);
      setIsCreating(false);
      loadGroups();
    } catch (error) {
      console.error('Failed to create device group:', error);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!window.confirm('Are you sure you want to delete this group?')) return;

    try {
      await deviceService.deleteDeviceGroup(groupId);
      loadGroups();
    } catch (error) {
      console.error('Failed to delete device group:', error);
    }
  };

  const handleToggleDevice = (deviceId: string) => {
    setSelectedDevices(prev =>
      prev.includes(deviceId)
        ? prev.filter(id => id !== deviceId)
        : [...prev, deviceId]
    );
  };

  const handleControlGroup = async (groupId: string, action: string) => {
    try {
      await deviceService.controlDeviceGroup(groupId, action);
    } catch (error) {
      console.error('Failed to control device group:', error);
    }
  };

  return (
    <div className="device-group-manager">
      <div className="header">
        <h2>Device Groups</h2>
        <button onClick={() => setIsCreating(true)} className="btn-primary">
          Create Group
        </button>
      </div>

      {isCreating && (
        <div className="create-group-form">
          <h3>Create New Group</h3>
          <input
            type="text"
            placeholder="Group Name"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
          />
          <textarea
            placeholder="Description (optional)"
            value={newGroupDescription}
            onChange={(e) => setNewGroupDescription(e.target.value)}
          />

          <div className="device-selection">
            <h4>Select Devices</h4>
            {devices.map(device => (
              <label key={device.id} className="device-checkbox">
                <input
                  type="checkbox"
                  checked={selectedDevices.includes(device.id)}
                  onChange={() => handleToggleDevice(device.id)}
                />
                <span>{device.name}</span>
                <span className="device-type">{device.type}</span>
              </label>
            ))}
          </div>

          <div className="form-actions">
            <button onClick={handleCreateGroup} className="btn-primary">
              Create
            </button>
            <button onClick={() => setIsCreating(false)} className="btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="groups-list">
        {groups.map(group => (
          <div key={group.id} className="group-card">
            <div className="group-header">
              <div className="group-info">
                <h3>{group.name}</h3>
                {group.description && <p>{group.description}</p>}
                <span className="device-count">{group.deviceIds.length} devices</span>
              </div>
              <div className="group-actions">
                <button
                  onClick={() => handleControlGroup(group.id, 'turn_on')}
                  className="btn-icon"
                  title="Turn On All"
                >
                  ⚡
                </button>
                <button
                  onClick={() => handleControlGroup(group.id, 'turn_off')}
                  className="btn-icon"
                  title="Turn Off All"
                >
                  ⭕
                </button>
                <button
                  onClick={() => handleDeleteGroup(group.id)}
                  className="btn-icon btn-danger"
                  title="Delete Group"
                >
                  🗑️
                </button>
              </div>
            </div>

            <div className="group-devices">
              {devices
                .filter(d => group.deviceIds.includes(d.id))
                .map(device => (
                  <div key={device.id} className="device-chip">
                    <span className={`status-indicator ${device.status}`} />
                    {device.name}
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
