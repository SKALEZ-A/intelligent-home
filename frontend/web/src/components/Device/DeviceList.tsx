import React, { useState, useEffect } from 'react';
import { DeviceCard } from './DeviceCard';
import { Device } from '../../types/device';
import { deviceService } from '../../services/device.service';

interface DeviceListProps {
  userId: string;
  filter?: {
    type?: string;
    room?: string;
    status?: string;
    tags?: string[];
  };
}

export const DeviceList: React.FC<DeviceListProps> = ({ userId, filter }) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'type' | 'room' | 'status'>('name');

  useEffect(() => {
    loadDevices();
  }, [userId, filter]);

  const loadDevices = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await deviceService.getDevices(userId, filter);
      setDevices(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load devices');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleDevice = async (deviceId: string, state: boolean) => {
    try {
      await deviceService.toggleDevice(deviceId, state);
      setDevices(prevDevices =>
        prevDevices.map(device =>
          device.id === deviceId
            ? { ...device, state: { ...device.state, power: state } }
            : device
        )
      );
    } catch (err: any) {
      console.error('Failed to toggle device:', err);
    }
  };

  const handleSettings = (deviceId: string) => {
    // Navigate to device settings
    window.location.href = `/devices/${deviceId}/settings`;
  };

  const handleDelete = async (deviceId: string) => {
    if (!window.confirm('Are you sure you want to delete this device?')) {
      return;
    }

    try {
      await deviceService.deleteDevice(deviceId);
      setDevices(prevDevices => prevDevices.filter(d => d.id !== deviceId));
    } catch (err: any) {
      console.error('Failed to delete device:', err);
    }
  };

  const sortedDevices = [...devices].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'type':
        return a.type.localeCompare(b.type);
      case 'room':
        return a.location.room.localeCompare(b.location.room);
      case 'status':
        return a.status.localeCompare(b.status);
      default:
        return 0;
    }
  });

  const groupedDevices = sortedDevices.reduce((acc, device) => {
    const room = device.location.room;
    if (!acc[room]) {
      acc[room] = [];
    }
    acc[room].push(device);
    return acc;
  }, {} as Record<string, Device[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
        <button
          onClick={loadDevices}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="text-center py-12">
        <span className="text-6xl mb-4 block">📱</span>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">No devices found</h3>
        <p className="text-gray-600 mb-4">
          Add your first device to get started with home automation
        </p>
        <button
          onClick={() => (window.location.href = '/devices/add')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Add Device
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="name">Sort by Name</option>
            <option value="type">Sort by Type</option>
            <option value="room">Sort by Room</option>
            <option value="status">Sort by Status</option>
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded ${
              viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
            }`}
          >
            ⊞
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded ${
              viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-600'
            }`}
          >
            ☰
          </button>
        </div>
      </div>

      {/* Device Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Total Devices</p>
          <p className="text-2xl font-bold text-gray-900">{devices.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Online</p>
          <p className="text-2xl font-bold text-green-600">
            {devices.filter(d => d.status === 'online').length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Offline</p>
          <p className="text-2xl font-bold text-gray-600">
            {devices.filter(d => d.status === 'offline').length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Errors</p>
          <p className="text-2xl font-bold text-red-600">
            {devices.filter(d => d.status === 'error').length}
          </p>
        </div>
      </div>

      {/* Devices by Room */}
      {Object.entries(groupedDevices).map(([room, roomDevices]) => (
        <div key={room}>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{room}</h2>
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                : 'space-y-4'
            }
          >
            {roomDevices.map(device => (
              <DeviceCard
                key={device.id}
                device={device}
                onToggle={handleToggleDevice}
                onSettings={handleSettings}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
