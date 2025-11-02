import { v4 as uuidv4 } from 'uuid';
import { Device, DeviceState, DeviceCommand, DeviceHealth, Capability } from '../../../../shared/types';
import { createLogger } from '../../../../shared/utils/logger';
import {
  NotFoundError,
  DeviceError,
  DeviceOfflineError,
  DeviceTimeoutError,
  ValidationError,
} from '../../../../shared/utils/errors';
import { DeviceRepository } from '../repositories/device.repository';
import { DeviceStateRepository } from '../repositories/device-state.repository';
import { DeviceCommandRepository } from '../repositories/device-command.repository';
import { MQTTService } from './mqtt.service';
import { WebSocketService } from './websocket.service';
import { RedisService } from './redis.service';
import { ProtocolDriverManager } from '../drivers/protocol-driver-manager';

const logger = createLogger('DeviceService');

const COMMAND_TIMEOUT = 30000; // 30 seconds
const HEARTBEAT_INTERVAL = 60000; // 60 seconds
const OFFLINE_THRESHOLD = 300000; // 5 minutes

export class DeviceService {
  private deviceRepository: DeviceRepository;
  private stateRepository: DeviceStateRepository;
  private commandRepository: DeviceCommandRepository;
  private mqttService: MQTTService;
  private wsService: WebSocketService;
  private redisService: RedisService;
  private driverManager: ProtocolDriverManager;
  private heartbeatIntervals: Map<string, NodeJS.Timeout>;

  constructor(
    mqttService: MQTTService,
    wsService: WebSocketService
  ) {
    this.deviceRepository = new DeviceRepository();
    this.stateRepository = new DeviceStateRepository();
    this.commandRepository = new DeviceCommandRepository();
    this.mqttService = mqttService;
    this.wsService = wsService;
    this.redisService = new RedisService();
    this.driverManager = new ProtocolDriverManager();
    this.heartbeatIntervals = new Map();

    this.initializeEventHandlers();
  }

  private initializeEventHandlers(): void {
    // Subscribe to MQTT device state updates
    this.mqttService.on('device:state', async (deviceId: string, state: any) => {
      await this.handleDeviceStateUpdate(deviceId, state);
    });

    // Subscribe to MQTT device commands
    this.mqttService.on('device:command:response', async (commandId: string, response: any) => {
      await this.handleCommandResponse(commandId, response);
    });
  }

  async discoverDevices(homeId: string, protocol?: string): Promise<Device[]> {
    logger.info(`Starting device discovery for home: ${homeId}, protocol: ${protocol || 'all'}`);

    const discoveredDevices: Device[] = [];
    const protocols = protocol ? [protocol] : ['zigbee', 'zwave', 'wifi', 'bluetooth', 'thread', 'matter'];

    for (const proto of protocols) {
      try {
        const driver = this.driverManager.getDriver(proto);
        const devices = await driver.discover();

        for (const deviceInfo of devices) {
          const device = await this.createDevice({
            ...deviceInfo,
            homeId,
            protocol: proto as any,
          });
          discoveredDevices.push(device);
        }
      } catch (error) {
        logger.error(`Failed to discover devices for protocol ${proto}`, error as Error);
      }
    }

    logger.info(`Discovered ${discoveredDevices.length} devices`);
    return discoveredDevices;
  }

  async createDevice(deviceData: Partial<Device>): Promise<Device> {
    const device: Device = {
      id: uuidv4(),
      name: deviceData.name || 'New Device',
      type: deviceData.type!,
      protocol: deviceData.protocol!,
      manufacturer: deviceData.manufacturer || 'Unknown',
      model: deviceData.model || 'Unknown',
      firmwareVersion: deviceData.firmwareVersion || '1.0.0',
      hardwareVersion: deviceData.hardwareVersion,
      serialNumber: deviceData.serialNumber,
      capabilities: deviceData.capabilities || [],
      location: deviceData.location || 'Unknown',
      room: deviceData.room,
      floor: deviceData.floor,
      hubId: deviceData.hubId!,
      homeId: deviceData.homeId!,
      userId: deviceData.userId!,
      state: {
        deviceId: '',
        attributes: {},
        timestamp: new Date(),
        version: 1,
        source: 'user',
      },
      metadata: {
        tags: [],
        category: deviceData.type!,
        icon: this.getDefaultIcon(deviceData.type!),
        customFields: {},
      },
      lastSeen: new Date(),
      batteryLevel: deviceData.batteryLevel,
      isOnline: true,
      isPaired: false,
      isReachable: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    device.state.deviceId = device.id;

    const createdDevice = await this.deviceRepository.create(device);
    
    // Initialize device state in Redis
    await this.redisService.setDeviceState(device.id, device.state);

    // Start heartbeat monitoring
    this.startHeartbeatMonitoring(device.id);

    // Publish device created event
    await this.mqttService.publish(`devices/${device.id}/created`, device);
    this.wsService.broadcastDeviceUpdate(device);

    logger.info(`Device created: ${device.id} (${device.name})`);
    return createdDevice;
  }

  async getDevice(deviceId: string): Promise<Device> {
    const device = await this.deviceRepository.findById(deviceId);
    if (!device) {
      throw new NotFoundError('Device', deviceId);
    }

    // Get latest state from Redis
    const state = await this.redisService.getDeviceState(deviceId);
    if (state) {
      device.state = state;
    }

    return device;
  }

  async getDevices(homeId: string, filters?: {
    type?: string;
    protocol?: string;
    room?: string;
    isOnline?: boolean;
  }): Promise<Device[]> {
    const devices = await this.deviceRepository.findByHomeId(homeId, filters);

    // Enrich with latest states from Redis
    for (const device of devices) {
      const state = await this.redisService.getDeviceState(device.id);
      if (state) {
        device.state = state;
      }
    }

    return devices;
  }

  async updateDevice(deviceId: string, updates: Partial<Device>): Promise<Device> {
    const device = await this.getDevice(deviceId);

    // Prevent updating critical fields
    delete updates.id;
    delete updates.protocol;
    delete updates.homeId;
    delete updates.userId;

    const updatedDevice = await this.deviceRepository.update(deviceId, {
      ...updates,
      updatedAt: new Date(),
    });

    // Publish update event
    await this.mqttService.publish(`devices/${deviceId}/updated`, updatedDevice);
    this.wsService.broadcastDeviceUpdate(updatedDevice);

    logger.info(`Device updated: ${deviceId}`);
    return updatedDevice;
  }

  async deleteDevice(deviceId: string): Promise<void> {
    const device = await this.getDevice(deviceId);

    // Stop heartbeat monitoring
    this.stopHeartbeatMonitoring(deviceId);

    // Unpair device
    try {
      const driver = this.driverManager.getDriver(device.protocol);
      await driver.unpair(device);
    } catch (error) {
      logger.error(`Failed to unpair device ${deviceId}`, error as Error);
    }

    // Delete from database
    await this.deviceRepository.delete(deviceId);

    // Clean up Redis
    await this.redisService.deleteDeviceState(deviceId);

    // Publish delete event
    await this.mqttService.publish(`devices/${deviceId}/deleted`, { deviceId });
    this.wsService.broadcastDeviceDeleted(deviceId);

    logger.info(`Device deleted: ${deviceId}`);
  }

  async pairDevice(deviceId: string): Promise<Device> {
    const device = await this.getDevice(deviceId);

    if (device.isPaired) {
      throw new ValidationError('Device is already paired');
    }

    try {
      const driver = this.driverManager.getDriver(device.protocol);
      await driver.pair(device);

      const updatedDevice = await this.deviceRepository.update(deviceId, {
        isPaired: true,
        updatedAt: new Date(),
      });

      logger.info(`Device paired: ${deviceId}`);
      return updatedDevice;
    } catch (error) {
      logger.error(`Failed to pair device ${deviceId}`, error as Error);
      throw new DeviceError(`Failed to pair device: ${(error as Error).message}`, deviceId);
    }
  }

  async sendCommand(
    deviceId: string,
    command: string,
    parameters: Record<string, any>,
    userId?: string
  ): Promise<DeviceCommand> {
    const device = await this.getDevice(deviceId);

    if (!device.isOnline) {
      throw new DeviceOfflineError(deviceId);
    }

    if (!device.isPaired) {
      throw new DeviceError('Device is not paired', deviceId);
    }

    // Create command record
    const deviceCommand: DeviceCommand = {
      id: uuidv4(),
      deviceId,
      command,
      parameters,
      status: 'pending',
      priority: 1,
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date(),
      userId,
      source: userId ? 'user' : 'automation',
    };

    await this.commandRepository.create(deviceCommand);

    // Execute command
    this.executeCommand(deviceCommand).catch(error => {
      logger.error(`Command execution failed: ${deviceCommand.id}`, error);
    });

    return deviceCommand;
  }

  private async executeCommand(command: DeviceCommand): Promise<void> {
    try {
      // Update status to executing
      await this.commandRepository.update(command.id, {
        status: 'executing',
        executedAt: new Date(),
      });

      const device = await this.getDevice(command.deviceId);
      const driver = this.driverManager.getDriver(device.protocol);

      // Set timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Command timeout')), COMMAND_TIMEOUT);
      });

      // Execute command with timeout
      const result = await Promise.race([
        driver.sendCommand(device, command.command, command.parameters),
        timeoutPromise,
      ]);

      // Update command status
      await this.commandRepository.update(command.id, {
        status: 'completed',
        completedAt: new Date(),
      });

      // Publish command completed event
      await this.mqttService.publish(`devices/${command.deviceId}/command/completed`, {
        commandId: command.id,
        result,
      });

      logger.info(`Command completed: ${command.id}`);
    } catch (error) {
      const errorMessage = (error as Error).message;
      
      // Check if we should retry
      if (command.retryCount < command.maxRetries) {
        await this.commandRepository.update(command.id, {
          status: 'pending',
          retryCount: command.retryCount + 1,
        });

        // Retry after delay
        setTimeout(() => {
          this.executeCommand(command);
        }, 1000 * Math.pow(2, command.retryCount));
      } else {
        // Mark as failed
        await this.commandRepository.update(command.id, {
          status: 'failed',
          completedAt: new Date(),
          error: errorMessage,
        });

        // Publish command failed event
        await this.mqttService.publish(`devices/${command.deviceId}/command/failed`, {
          commandId: command.id,
          error: errorMessage,
        });

        logger.error(`Command failed: ${command.id}`, error as Error);
      }
    }
  }

  async getDeviceState(deviceId: string): Promise<DeviceState> {
    // Try to get from Redis first
    let state = await this.redisService.getDeviceState(deviceId);
    
    if (!state) {
      // Fallback to database
      state = await this.stateRepository.getLatestState(deviceId);
      
      if (!state) {
        throw new NotFoundError('Device state', deviceId);
      }

      // Cache in Redis
      await this.redisService.setDeviceState(deviceId, state);
    }

    return state;
  }

  async updateDeviceState(
    deviceId: string,
    attributes: Record<string, any>,
    source: 'user' | 'automation' | 'schedule' | 'ai' | 'external' = 'user'
  ): Promise<DeviceState> {
    const device = await this.getDevice(deviceId);
    const currentState = await this.getDeviceState(deviceId);

    const newState: DeviceState = {
      deviceId,
      attributes: {
        ...currentState.attributes,
        ...attributes,
      },
      timestamp: new Date(),
      version: currentState.version + 1,
      source,
    };

    // Save to database
    await this.stateRepository.create(newState);

    // Update Redis cache
    await this.redisService.setDeviceState(deviceId, newState);

    // Update device last seen
    await this.deviceRepository.update(deviceId, {
      lastSeen: new Date(),
    });

    // Publish state update
    await this.mqttService.publish(`devices/${deviceId}/state`, newState);
    this.wsService.broadcastDeviceStateUpdate(deviceId, newState);

    logger.debug(`Device state updated: ${deviceId}`);
    return newState;
  }

  private async handleDeviceStateUpdate(deviceId: string, state: any): Promise<void> {
    try {
      await this.updateDeviceState(deviceId, state, 'external');
    } catch (error) {
      logger.error(`Failed to handle device state update: ${deviceId}`, error as Error);
    }
  }

  private async handleCommandResponse(commandId: string, response: any): Promise<void> {
    try {
      await this.commandRepository.update(commandId, {
        status: response.success ? 'completed' : 'failed',
        completedAt: new Date(),
        error: response.error,
      });
    } catch (error) {
      logger.error(`Failed to handle command response: ${commandId}`, error as Error);
    }
  }

  async getDeviceHealth(deviceId: string): Promise<DeviceHealth> {
    const device = await this.getDevice(deviceId);
    
    // Calculate health metrics
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const commands = await this.commandRepository.findByDeviceId(deviceId, new Date(oneDayAgo));
    const totalCommands = commands.length;
    const failedCommands = commands.filter(c => c.status === 'failed').length;
    const completedCommands = commands.filter(c => c.status === 'completed').length;

    const errorRate = totalCommands > 0 ? (failedCommands / totalCommands) * 100 : 0;
    
    const avgResponseTime = completedCommands > 0
      ? commands
          .filter(c => c.status === 'completed' && c.executedAt && c.completedAt)
          .reduce((sum, c) => sum + (c.completedAt!.getTime() - c.executedAt!.getTime()), 0) / completedCommands
      : 0;

    // Calculate uptime
    const uptimeMs = now - device.createdAt.getTime();
    const offlineTime = device.isOnline ? 0 : now - device.lastSeen.getTime();
    const uptime = ((uptimeMs - offlineTime) / uptimeMs) * 100;

    // Calculate health score (0-100)
    let healthScore = 100;
    healthScore -= errorRate; // Reduce by error rate
    healthScore -= device.isOnline ? 0 : 20; // Reduce if offline
    healthScore -= avgResponseTime > 1000 ? 10 : 0; // Reduce if slow
    healthScore -= device.batteryLevel && device.batteryLevel < 20 ? 15 : 0; // Reduce if low battery
    healthScore = Math.max(0, Math.min(100, healthScore));

    const recommendations: string[] = [];
    if (!device.isOnline) recommendations.push('Device is offline - check power and connectivity');
    if (errorRate > 10) recommendations.push('High error rate - consider device replacement');
    if (avgResponseTime > 2000) recommendations.push('Slow response time - check network connection');
    if (device.batteryLevel && device.batteryLevel < 20) recommendations.push('Low battery - replace soon');

    return {
      deviceId,
      healthScore,
      uptime,
      avgResponseTime,
      errorRate,
      lastError: commands.find(c => c.status === 'failed')?.error,
      lastErrorAt: commands.find(c => c.status === 'failed')?.completedAt,
      batteryHealth: device.batteryLevel,
      signalQuality: device.signalStrength,
      recommendations,
    };
  }

  private startHeartbeatMonitoring(deviceId: string): void {
    const interval = setInterval(async () => {
      try {
        const device = await this.deviceRepository.findById(deviceId);
        if (!device) {
          this.stopHeartbeatMonitoring(deviceId);
          return;
        }

        const timeSinceLastSeen = Date.now() - device.lastSeen.getTime();
        
        if (timeSinceLastSeen > OFFLINE_THRESHOLD && device.isOnline) {
          // Mark device as offline
          await this.deviceRepository.update(deviceId, {
            isOnline: false,
            updatedAt: new Date(),
          });

          // Publish offline event
          await this.mqttService.publish(`devices/${deviceId}/offline`, { deviceId });
          this.wsService.broadcastDeviceOffline(deviceId);

          logger.warn(`Device went offline: ${deviceId}`);
        }
      } catch (error) {
        logger.error(`Heartbeat monitoring error for device ${deviceId}`, error as Error);
      }
    }, HEARTBEAT_INTERVAL);

    this.heartbeatIntervals.set(deviceId, interval);
  }

  private stopHeartbeatMonitoring(deviceId: string): void {
    const interval = this.heartbeatIntervals.get(deviceId);
    if (interval) {
      clearInterval(interval);
      this.heartbeatIntervals.delete(deviceId);
    }
  }

  private getDefaultIcon(type: string): string {
    const iconMap: Record<string, string> = {
      light: 'lightbulb',
      switch: 'toggle',
      thermostat: 'thermometer',
      lock: 'lock',
      camera: 'camera',
      sensor: 'sensor',
      plug: 'plug',
      fan: 'fan',
      blind: 'blind',
      garage: 'garage',
      doorbell: 'doorbell',
      valve: 'valve',
      appliance: 'appliance',
    };

    return iconMap[type] || 'device';
  }

  async getDevicesByRoom(homeId: string, room: string): Promise<Device[]> {
    return this.deviceRepository.findByRoom(homeId, room);
  }

  async getDevicesByType(homeId: string, type: string): Promise<Device[]> {
    return this.deviceRepository.findByType(homeId, type);
  }

  async getDeviceCapabilities(deviceId: string): Promise<Capability[]> {
    const device = await this.getDevice(deviceId);
    return device.capabilities;
  }

  async updateFirmware(deviceId: string, firmwareUrl: string): Promise<void> {
    const device = await this.getDevice(deviceId);

    try {
      const driver = this.driverManager.getDriver(device.protocol);
      await driver.updateFirmware(device, firmwareUrl);

      logger.info(`Firmware update initiated for device: ${deviceId}`);
    } catch (error) {
      logger.error(`Firmware update failed for device ${deviceId}`, error as Error);
      throw new DeviceError(`Firmware update failed: ${(error as Error).message}`, deviceId);
    }
  }
}
