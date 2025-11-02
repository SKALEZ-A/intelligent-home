import { useState, useEffect, useCallback } from 'react';
import { deviceService, Device } from '../services/device.service';
import { useWebSocket } from './useWebSocket';

interface UseDevicesOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  filters?: {
    type?: string;
    status?: string;
    room?: string;
  };
}

interface UseDevicesReturn {
  devices: Device[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getDeviceById: (id: string) => Device | undefined;
  updateDevice: (id: string, updates: Partial<Device>) => void;
  sendCommand: (deviceId: string, command: string, parameters?: any) => Promise<void>;
}

export const useDevices = (options: UseDevicesOptions = {}): UseDevicesReturn => {
  const { autoRefresh = false, refreshInterval = 30000, filters } = options;
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDevices = useCallback(async () => {
    try {
      setError(null);
      const data = await deviceService.getDevices(filters);
      setDevices(data.devices);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch devices');
      console.error('Error fetching devices:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchDevices, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, fetchDevices]);

  // WebSocket for real-time updates
  const { lastMessage } = useWebSocket('/devices');

  useEffect(() => {
    if (lastMessage) {
      try {
        const update = JSON.parse(lastMessage);
        
        if (update.type === 'device_update') {
          setDevices(prev =>
            prev.map(device =>
              device.id === update.deviceId
                ? { ...device, ...update.data }
                : device
            )
          );
        } else if (update.type === 'device_added') {
          setDevices(prev => [...prev, update.device]);
        } else if (update.type === 'device_removed') {
          setDevices(prev => prev.filter(device => device.id !== update.deviceId));
        }
      } catch (err) {
        console.error('Error processing WebSocket message:', err);
      }
    }
  }, [lastMessage]);

  const getDeviceById = useCallback(
    (id: string) => devices.find(device => device.id === id),
    [devices]
  );

  const updateDevice = useCallback((id: string, updates: Partial<Device>) => {
    setDevices(prev =>
      prev.map(device =>
        device.id === id ? { ...device, ...updates } : device
      )
    );
  }, []);

  const sendCommand = useCallback(async (deviceId: string, command: string, parameters?: any) => {
    try {
      await deviceService.sendCommand(deviceId, command, parameters);
      // Optimistically update the device state
      updateDevice(deviceId, { status: 'processing' });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send command');
      throw err;
    }
  }, [updateDevice]);

  return {
    devices,
    loading,
    error,
    refresh: fetchDevices,
    getDeviceById,
    updateDevice,
    sendCommand,
  };
};
