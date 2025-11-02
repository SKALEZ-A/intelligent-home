import React, { useState, useEffect } from 'react';
import { Device } from '../../types/device';
import { deviceService } from '../../services/device.service';

interface SceneAction {
  deviceId: string;
  command: string;
  parameters: any;
}

interface Scene {
  id?: string;
  userId: string;
  name: string;
  description?: string;
  icon?: string;
  actions: SceneAction[];
  tags: string[];
}

interface SceneBuilderProps {
  userId: string;
  scene?: Scene;
  onSave: (scene: Scene) => void;
  onCancel: () => void;
}

export const SceneBuilder: React.FC<SceneBuilderProps> = ({
  userId,
  scene,
  onSave,
  onCancel,
}) => {
  const [name, setName] = useState(scene?.name || '');
  const [description, setDescription] = useState(scene?.description || '');
  const [icon, setIcon] = useState(scene?.icon || '🏠');
  const [actions, setActions] = useState<SceneAction[]>(scene?.actions || []);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDevices();
  }, [userId]);

  const loadDevices = async () => {
    try {
      const data = await deviceService.getDevices(userId);
      setDevices(data.filter(d => d.status === 'online'));
    } catch (error) {
      console.error('Failed to load devices:', error);
    }
  };

  const addAction = () => {
    if (!selectedDevice) return;

    const device = devices.find(d => d.id === selectedDevice);
    if (!device) return;

    const newAction: SceneAction = {
      deviceId: selectedDevice,
      command: 'setPower',
      parameters: { power: true },
    };

    setActions([...actions, newAction]);
    setSelectedDevice('');
  };

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const updateAction = (index: number, updates: Partial<SceneAction>) => {
    setActions(
      actions.map((action, i) =>
        i === index ? { ...action, ...updates } : action
      )
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Please enter a scene name');
      return;
    }

    if (actions.length === 0) {
      alert('Please add at least one action');
      return;
    }

    setLoading(true);
    try {
      const sceneData: Scene = {
        ...scene,
        userId,
        name: name.trim(),
        description: description.trim(),
        icon,
        actions,
        tags: [],
      };

      onSave(sceneData);
    } catch (error) {
      console.error('Failed to save scene:', error);
      alert('Failed to save scene');
    } finally {
      setLoading(false);
    }
  };

  const getDeviceName = (deviceId: string): string => {
    const device = devices.find(d => d.id === deviceId);
    return device?.name || 'Unknown Device';
  };

  const getCommandOptions = (deviceId: string): string[] => {
    const device = devices.find(d => d.id === deviceId);
    if (!device) return [];

    const commands = ['setPower'];
    
    if (device.capabilities.includes('brightness')) {
      commands.push('setBrightness');
    }
    if (device.capabilities.includes('temperature')) {
      commands.push('setTemperature');
    }
    if (device.capabilities.includes('color')) {
      commands.push('setColor');
    }
    if (device.type === 'lock') {
      commands.push('lock', 'unlock');
    }

    return commands;
  };

  const iconOptions = ['🏠', '🌙', '☀️', '🎬', '🍽️', '💤', '🎉', '🔒', '🌅', '🌆'];

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        {scene ? 'Edit Scene' : 'Create New Scene'}
      </h2>

      {/* Basic Info */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Scene Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Good Morning, Movie Time"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description (Optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what this scene does"
            rows={2}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Icon
          </label>
          <div className="flex space-x-2">
            {iconOptions.map((emoji) => (
              <button
                key={emoji}
                onClick={() => setIcon(emoji)}
                className={`text-2xl p-2 rounded-lg border-2 ${
                  icon === emoji
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions</h3>

        {/* Add Action */}
        <div className="flex space-x-2 mb-4">
          <select
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a device...</option>
            {devices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.name} ({device.location.room})
              </option>
            ))}
          </select>
          <button
            onClick={addAction}
            disabled={!selectedDevice}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Add Action
          </button>
        </div>

        {/* Action List */}
        <div className="space-y-3">
          {actions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No actions added yet. Add devices to create your scene.
            </div>
          ) : (
            actions.map((action, index) => (
              <div
                key={index}
                className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900">
                    {getDeviceName(action.deviceId)}
                  </p>
                  <div className="flex items-center space-x-2 mt-2">
                    <select
                      value={action.command}
                      onChange={(e) =>
                        updateAction(index, { command: e.target.value })
                      }
                      className="px-3 py-1 border border-gray-300 rounded text-sm"
                    >
                      {getCommandOptions(action.deviceId).map((cmd) => (
                        <option key={cmd} value={cmd}>
                          {cmd}
                        </option>
                      ))}
                    </select>

                    {action.command === 'setPower' && (
                      <select
                        value={action.parameters.power ? 'on' : 'off'}
                        onChange={(e) =>
                          updateAction(index, {
                            parameters: { power: e.target.value === 'on' },
                          })
                        }
                        className="px-3 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value="on">On</option>
                        <option value="off">Off</option>
                      </select>
                    )}

                    {action.command === 'setBrightness' && (
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={action.parameters.brightness || 100}
                        onChange={(e) =>
                          updateAction(index, {
                            parameters: { brightness: parseInt(e.target.value) },
                          })
                        }
                        className="w-20 px-3 py-1 border border-gray-300 rounded text-sm"
                      />
                    )}

                    {action.command === 'setTemperature' && (
                      <input
                        type="number"
                        min="10"
                        max="30"
                        value={action.parameters.temperature || 22}
                        onChange={(e) =>
                          updateAction(index, {
                            parameters: { temperature: parseInt(e.target.value) },
                          })
                        }
                        className="w-20 px-3 py-1 border border-gray-300 rounded text-sm"
                      />
                    )}
                  </div>
                </div>

                <button
                  onClick={() => removeAction(index)}
                  className="text-red-600 hover:text-red-800"
                >
                  🗑️
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-3">
        <button
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : 'Save Scene'}
        </button>
      </div>
    </div>
  );
};
