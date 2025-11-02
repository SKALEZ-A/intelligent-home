import React, { useState, useEffect } from 'react';
import { Device } from '../../types/device';
import './DeviceControl.css';

interface DeviceControlProps {
  device: Device;
  onUpdate: (deviceId: string, state: any) => Promise<void>;
  onRefresh: () => void;
}

export const DeviceControl: React.FC<DeviceControlProps> = ({ device, onUpdate, onRefresh }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [localState, setLocalState] = useState(device.state);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocalState(device.state);
  }, [device.state]);

  const handleStateChange = async (newState: Partial<typeof device.state>) => {
    setIsLoading(true);
    setError(null);

    try {
      const updatedState = { ...localState, ...newState };
      setLocalState(updatedState);
      await onUpdate(device.id, updatedState);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update device');
      setLocalState(device.state); // Revert on error
    } finally {
      setIsLoading(false);
    }
  };

  const renderControl = () => {
    switch (device.type) {
      case 'light':
        return renderLightControl();
      case 'thermostat':
        return renderThermostatControl();
      case 'lock':
        return renderLockControl();
      case 'camera':
        return renderCameraControl();
      case 'sensor':
        return renderSensorControl();
      case 'switch':
        return renderSwitchControl();
      default:
        return renderGenericControl();
    }
  };

  const renderLightControl = () => (
    <div className="device-control light-control">
      <div className="control-row">
        <label>Power</label>
        <button
          className={`toggle-btn ${localState.power ? 'on' : 'off'}`}
          onClick={() => handleStateChange({ power: !localState.power })}
          disabled={isLoading}
        >
          {localState.power ? 'ON' : 'OFF'}
        </button>
      </div>

      {localState.power && (
        <>
          <div className="control-row">
            <label>Brightness</label>
            <input
              type="range"
              min="0"
              max="100"
              value={localState.brightness || 100}
              onChange={(e) => handleStateChange({ brightness: parseInt(e.target.value) })}
              disabled={isLoading}
            />
            <span className="value">{localState.brightness || 100}%</span>
          </div>

          {device.capabilities?.includes('color') && (
            <div className="control-row">
              <label>Color</label>
              <input
                type="color"
                value={localState.color || '#ffffff'}
                onChange={(e) => handleStateChange({ color: e.target.value })}
                disabled={isLoading}
              />
            </div>
          )}

          {device.capabilities?.includes('temperature') && (
            <div className="control-row">
              <label>Color Temperature</label>
              <input
                type="range"
                min="2700"
                max="6500"
                value={localState.colorTemperature || 4000}
                onChange={(e) => handleStateChange({ colorTemperature: parseInt(e.target.value) })}
                disabled={isLoading}
              />
              <span className="value">{localState.colorTemperature || 4000}K</span>
            </div>
          )}
        </>
      )}
    </div>
  );

  const renderThermostatControl = () => (
    <div className="device-control thermostat-control">
      <div className="control-row">
        <label>Mode</label>
        <select
          value={localState.mode || 'auto'}
          onChange={(e) => handleStateChange({ mode: e.target.value })}
          disabled={isLoading}
        >
          <option value="off">Off</option>
          <option value="heat">Heat</option>
          <option value="cool">Cool</option>
          <option value="auto">Auto</option>
          <option value="fan">Fan Only</option>
        </select>
      </div>

      {localState.mode !== 'off' && (
        <>
          <div className="control-row temperature-display">
            <div className="current-temp">
              <span className="label">Current</span>
              <span className="value">{localState.currentTemperature || '--'}°</span>
            </div>
            <div className="target-temp">
              <span className="label">Target</span>
              <span className="value">{localState.targetTemperature || '--'}°</span>
            </div>
          </div>

          <div className="control-row">
            <label>Set Temperature</label>
            <div className="temperature-controls">
              <button
                onClick={() => handleStateChange({ 
                  targetTemperature: (localState.targetTemperature || 20) - 0.5 
                })}
                disabled={isLoading}
              >
                -
              </button>
              <input
                type="number"
                min="10"
                max="30"
                step="0.5"
                value={localState.targetTemperature || 20}
                onChange={(e) => handleStateChange({ targetTemperature: parseFloat(e.target.value) })}
                disabled={isLoading}
              />
              <button
                onClick={() => handleStateChange({ 
                  targetTemperature: (localState.targetTemperature || 20) + 0.5 
                })}
                disabled={isLoading}
              >
                +
              </button>
            </div>
          </div>

          <div className="control-row">
            <label>Fan Speed</label>
            <select
              value={localState.fanSpeed || 'auto'}
              onChange={(e) => handleStateChange({ fanSpeed: e.target.value })}
              disabled={isLoading}
            >
              <option value="auto">Auto</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </>
      )}
    </div>
  );

  const renderLockControl = () => (
    <div className="device-control lock-control">
      <div className="control-row">
        <label>Status</label>
        <button
          className={`lock-btn ${localState.locked ? 'locked' : 'unlocked'}`}
          onClick={() => handleStateChange({ locked: !localState.locked })}
          disabled={isLoading}
        >
          {localState.locked ? '🔒 Locked' : '🔓 Unlocked'}
        </button>
      </div>

      {device.capabilities?.includes('autoLock') && (
        <div className="control-row">
          <label>Auto-lock</label>
          <input
            type="checkbox"
            checked={localState.autoLock || false}
            onChange={(e) => handleStateChange({ autoLock: e.target.checked })}
            disabled={isLoading}
          />
        </div>
      )}

      <div className="lock-info">
        <p>Last accessed: {device.lastActivity ? new Date(device.lastActivity).toLocaleString() : 'Never'}</p>
        {localState.battery && (
          <p>Battery: {localState.battery}%</p>
        )}
      </div>
    </div>
  );

  const renderCameraControl = () => (
    <div className="device-control camera-control">
      <div className="camera-preview">
        {localState.streaming ? (
          <img src={localState.streamUrl} alt="Camera feed" />
        ) : (
          <div className="no-stream">Camera offline</div>
        )}
      </div>

      <div className="control-row">
        <button
          onClick={() => handleStateChange({ streaming: !localState.streaming })}
          disabled={isLoading}
        >
          {localState.streaming ? 'Stop Stream' : 'Start Stream'}
        </button>
        <button onClick={() => handleStateChange({ snapshot: true })} disabled={isLoading}>
          Take Snapshot
        </button>
      </div>

      {device.capabilities?.includes('motion') && (
        <div className="control-row">
          <label>Motion Detection</label>
          <input
            type="checkbox"
            checked={localState.motionDetection || false}
            onChange={(e) => handleStateChange({ motionDetection: e.target.checked })}
            disabled={isLoading}
          />
        </div>
      )}

      {device.capabilities?.includes('nightVision') && (
        <div className="control-row">
          <label>Night Vision</label>
          <select
            value={localState.nightVision || 'auto'}
            onChange={(e) => handleStateChange({ nightVision: e.target.value })}
            disabled={isLoading}
          >
            <option value="off">Off</option>
            <option value="on">On</option>
            <option value="auto">Auto</option>
          </select>
        </div>
      )}
    </div>
  );

  const renderSensorControl = () => (
    <div className="device-control sensor-control">
      <div className="sensor-readings">
        {localState.temperature !== undefined && (
          <div className="reading">
            <span className="label">Temperature</span>
            <span className="value">{localState.temperature}°C</span>
          </div>
        )}
        {localState.humidity !== undefined && (
          <div className="reading">
            <span className="label">Humidity</span>
            <span className="value">{localState.humidity}%</span>
          </div>
        )}
        {localState.motion !== undefined && (
          <div className="reading">
            <span className="label">Motion</span>
            <span className={`value ${localState.motion ? 'detected' : ''}`}>
              {localState.motion ? 'Detected' : 'Clear'}
            </span>
          </div>
        )}
        {localState.light !== undefined && (
          <div className="reading">
            <span className="label">Light Level</span>
            <span className="value">{localState.light} lux</span>
          </div>
        )}
        {localState.battery !== undefined && (
          <div className="reading">
            <span className="label">Battery</span>
            <span className="value">{localState.battery}%</span>
          </div>
        )}
      </div>

      <button onClick={onRefresh} disabled={isLoading} className="refresh-btn">
        Refresh Readings
      </button>
    </div>
  );

  const renderSwitchControl = () => (
    <div className="device-control switch-control">
      <div className="control-row">
        <label>{device.name}</label>
        <button
          className={`toggle-btn ${localState.power ? 'on' : 'off'}`}
          onClick={() => handleStateChange({ power: !localState.power })}
          disabled={isLoading}
        >
          {localState.power ? 'ON' : 'OFF'}
        </button>
      </div>

      {device.capabilities?.includes('dimmer') && localState.power && (
        <div className="control-row">
          <label>Level</label>
          <input
            type="range"
            min="0"
            max="100"
            value={localState.level || 100}
            onChange={(e) => handleStateChange({ level: parseInt(e.target.value) })}
            disabled={isLoading}
          />
          <span className="value">{localState.level || 100}%</span>
        </div>
      )}
    </div>
  );

  const renderGenericControl = () => (
    <div className="device-control generic-control">
      <div className="state-display">
        <pre>{JSON.stringify(localState, null, 2)}</pre>
      </div>
      <button onClick={onRefresh} disabled={isLoading}>
        Refresh
      </button>
    </div>
  );

  return (
    <div className="device-control-container">
      <div className="device-header">
        <h3>{device.name}</h3>
        <span className={`status-badge ${device.status}`}>{device.status}</span>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {renderControl()}

      {isLoading && <div className="loading-overlay">Updating...</div>}

      <div className="device-footer">
        <span className="last-updated">
          Last updated: {device.lastUpdated ? new Date(device.lastUpdated).toLocaleString() : 'Never'}
        </span>
      </div>
    </div>
  );
};
