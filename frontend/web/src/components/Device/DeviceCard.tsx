import React, { useState } from 'react';
import { Device } from '../../types/device';
import { formatDistanceToNow } from 'date-fns';

interface DeviceCardProps {
  device: Device;
  onToggle: (deviceId: string, state: boolean) => void;
  onSettings: (deviceId: string) => void;
  onDelete: (deviceId: string) => void;
}

export const DeviceCard: React.FC<DeviceCardProps> = ({
  device,
  onToggle,
  onSettings,
  onDelete,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const handleToggle = async () => {
    setIsLoading(true);
    try {
      await onToggle(device.id, !device.state.power);
    } finally {
      setIsLoading(false);
    }
  };

  const getDeviceIcon = () => {
    const icons: Record<string, string> = {
      light: '💡',
      thermostat: '🌡️',
      lock: '🔒',
      camera: '📷',
      sensor: '📡',
      switch: '🔌',
      outlet: '⚡',
      fan: '🌀',
      blinds: '🪟',
      speaker: '🔊',
    };
    return icons[device.type] || '📱';
  };

  const getStatusColor = () => {
    switch (device.status) {
      case 'online':
        return 'bg-green-500';
      case 'offline':
        return 'bg-gray-500';
      case 'error':
        return 'bg-red-500';
      case 'updating':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getSignalStrength = () => {
    const strength = device.health.signalStrength;
    if (strength >= 80) return '📶';
    if (strength >= 60) return '📶';
    if (strength >= 40) return '📶';
    return '📶';
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <span className="text-4xl">{getDeviceIcon()}</span>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{device.name}</h3>
            <p className="text-sm text-gray-500">{device.location.room}</p>
          </div>
        </div>
        
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="text-gray-400 hover:text-gray-600"
          >
            ⋮
          </button>
          
          {showMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10">
              <button
                onClick={() => {
                  onSettings(device.id);
                  setShowMenu(false);
                }}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Settings
              </button>
              <button
                onClick={() => {
                  onDelete(device.id);
                  setShowMenu(false);
                }}
                className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Status Indicator */}
      <div className="flex items-center space-x-2 mb-4">
        <span className={`w-2 h-2 rounded-full ${getStatusColor()}`}></span>
        <span className="text-sm text-gray-600 capitalize">{device.status}</span>
        <span className="text-sm text-gray-400">•</span>
        <span className="text-sm text-gray-600">{getSignalStrength()}</span>
        <span className="text-sm text-gray-400">
          {device.health.signalStrength}%
        </span>
      </div>

      {/* Device State */}
      <div className="space-y-3 mb-4">
        {device.state.power !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Power</span>
            <button
              onClick={handleToggle}
              disabled={isLoading || device.status !== 'online'}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                device.state.power ? 'bg-blue-600' : 'bg-gray-300'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  device.state.power ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        )}

        {device.state.brightness !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Brightness</span>
            <span className="text-sm font-medium text-gray-900">
              {device.state.brightness}%
            </span>
          </div>
        )}

        {device.state.temperature !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Temperature</span>
            <span className="text-sm font-medium text-gray-900">
              {device.state.temperature}°C
            </span>
          </div>
        )}

        {device.state.humidity !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Humidity</span>
            <span className="text-sm font-medium text-gray-900">
              {device.state.humidity}%
            </span>
          </div>
        )}

        {device.state.battery !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Battery</span>
            <span className="text-sm font-medium text-gray-900">
              🔋 {device.state.battery}%
            </span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{device.manufacturer}</span>
          <span>
            Last seen {formatDistanceToNow(new Date(device.health.lastSeen), { addSuffix: true })}
          </span>
        </div>
      </div>

      {/* Tags */}
      {device.tags && device.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {device.tags.map((tag, index) => (
            <span
              key={index}
              className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
