import { DeviceCommand, CommandStatus } from '../../../shared/types';
import { AppError } from '../../../shared/utils/errors';
import { createLogger } from '../../../shared/utils/logger';
import { DeviceCommandRepository } from '../repositories/device-command.repository';
import { DeviceRepository } from '../repositories/device.repository';
import { MQTTService } from './mqtt.service';
import { RedisService } from '../../../backend/auth-service/src/services/redis.service';
import { EventEmitter } from 'events';

const logger = createLogger('DeviceCommandService');

export class DeviceCommandService extends EventEmitter {
  private commandRepository = new DeviceCommandRepository();
  private deviceRepository = new DeviceRepository();
  private mqttService: MQTTService;
  private redisService = new RedisService();
  private commandQueue: Map<string, DeviceCommand[]> = new Map();
  private processingCommands: Set<string> = new Set();

  constructor() {
    super();
    this.mqttService = new MQTTService();
    this.startCommandProcessor();
  }

  async sendCommand(
    deviceId: string,
    command: string,
    parameters: Record<string, any>,
    userId: string,
    priority: number = 5
  ): Promise<DeviceCommand> {
    try {
      // Verify device exists and user has access
      const device = await this.deviceRepository.findById(deviceId);
      if (!device) {
        throw new AppError('Device not found', 404, 'DEVICE_NOT_FOUND');
      }

      if (device.userId !== userId) {
        throw new AppError('Access denied', 403, 'ACCESS_DENIED');
      }

      if (!device.isOnline) {
        throw new AppError('Device is offline', 503, 'DEVICE_OFFLINE');
      }

      // Validate command against device capabilities
      this.validateCommand(device, command, parameters);

      // Create command record
      const deviceCommand = await this.commandRepository.create({
        deviceId,
        command,
        parameters,
        status: 'pending',
        priority,
        retryCount: 0,
        maxRetries: 3,
        userId,
        source: 'user',
      });

      // Add to queue
      this.addToQueue(deviceCommand);

      logger.info('Command queued', {
        commandId: deviceCommand.id,
        deviceId,
        command,
        priority,
      });

      return deviceCommand;
    } catch (error) {
      logger.error('Error sending command', error as Error);
      throw error;
    }
  }

  async bulkCommand(
    deviceIds: string[],
    command: string,
    parameters: Record<string, any>,
    userId: string
  ): Promise<DeviceCommand[]> {
    try {
      const commands: DeviceCommand[] = [];

      for (const deviceId of deviceIds) {
        try {
          const cmd = await this.sendCommand(deviceId, command, parameters, userId);
          commands.push(cmd);
        } catch (error) {
          logger.warn('Failed to send command to device', {
            deviceId,
            error: (error as Error).message,
          });
        }
      }

      return commands;
    } catch (error) {
      logger.error('Error in bulk command', error as Error);
      throw error;
    }
  }

  async getCommandStatus(commandId: string): Promise<DeviceCommand> {
    try {
      const command = await this.commandRepository.findById(commandId);
      if (!command) {
        throw new AppError('Command not found', 404, 'COMMAND_NOT_FOUND');
      }
      return command;
    } catch (error) {
      logger.error('Error getting command status', error as Error);
      throw error;
    }
  }

  async cancelCommand(commandId: string, userId: string): Promise<void> {
    try {
      const command = await this.commandRepository.findById(commandId);
      if (!command) {
        throw new AppError('Command not found', 404, 'COMMAND_NOT_FOUND');
      }

      if (command.userId !== userId) {
        throw new AppError('Access denied', 403, 'ACCESS_DENIED');
      }

      if (command.status === 'executing') {
        throw new AppError('Cannot cancel executing command', 400, 'COMMAND_EXECUTING');
      }

      if (command.status === 'completed' || command.status === 'failed') {
        throw new AppError('Command already finished', 400, 'COMMAND_FINISHED');
      }

      await this.commandRepository.update(commandId, { status: 'failed', error: 'Cancelled by user' });
      this.removeFromQueue(commandId);

      logger.info('Command cancelled', { commandId, userId });
    } catch (error) {
      logger.error('Error cancelling command', error as Error);
      throw error;
    }
  }

  async retryCommand(commandId: string): Promise<void> {
    try {
      const command = await this.commandRepository.findById(commandId);
      if (!command) {
        throw new AppError('Command not found', 404, 'COMMAND_NOT_FOUND');
      }

      if (command.status !== 'failed') {
        throw new AppError('Can only retry failed commands', 400, 'INVALID_STATUS');
      }

      await this.commandRepository.update(commandId, {
        status: 'pending',
        retryCount: command.retryCount + 1,
        error: undefined,
      });

      const updatedCommand = await this.commandRepository.findById(commandId);
      this.addToQueue(updatedCommand!);

      logger.info('Command retry queued', { commandId });
    } catch (error) {
      logger.error('Error retrying command', error as Error);
      throw error;
    }
  }

  async getDeviceCommandHistory(
    deviceId: string,
    limit: number = 100
  ): Promise<DeviceCommand[]> {
    try {
      return await this.commandRepository.findByDeviceId(deviceId, limit);
    } catch (error) {
      logger.error('Error getting command history', error as Error);
      throw error;
    }
  }

  private validateCommand(device: any, command: string, parameters: Record<string, any>): void {
    // Check if device supports the command
    const capability = device.capabilities.find((cap: any) => cap.name === command);
    
    if (!capability) {
      throw new AppError(`Device does not support command: ${command}`, 400, 'UNSUPPORTED_COMMAND');
    }

    if (!capability.writable) {
      throw new AppError(`Command ${command} is read-only`, 400, 'READ_ONLY_COMMAND');
    }

    // Validate parameters based on capability type
    if (capability.type === 'number') {
      const value = parameters.value;
      if (typeof value !== 'number') {
        throw new AppError('Value must be a number', 400, 'INVALID_VALUE_TYPE');
      }
      if (capability.min !== undefined && value < capability.min) {
        throw new AppError(`Value must be at least ${capability.min}`, 400, 'VALUE_TOO_LOW');
      }
      if (capability.max !== undefined && value > capability.max) {
        throw new AppError(`Value must be at most ${capability.max}`, 400, 'VALUE_TOO_HIGH');
      }
    } else if (capability.type === 'enum') {
      const value = parameters.value;
      if (!capability.values.includes(value)) {
        throw new AppError(
          `Value must be one of: ${capability.values.join(', ')}`,
          400,
          'INVALID_ENUM_VALUE'
        );
      }
    } else if (capability.type === 'boolean') {
      const value = parameters.value;
      if (typeof value !== 'boolean') {
        throw new AppError('Value must be a boolean', 400, 'INVALID_VALUE_TYPE');
      }
    }
  }

  private addToQueue(command: DeviceCommand): void {
    const deviceId = command.deviceId;
    
    if (!this.commandQueue.has(deviceId)) {
      this.commandQueue.set(deviceId, []);
    }

    const queue = this.commandQueue.get(deviceId)!;
    queue.push(command);

    // Sort by priority (higher priority first)
    queue.sort((a, b) => b.priority - a.priority);

    this.commandQueue.set(deviceId, queue);
  }

  private removeFromQueue(commandId: string): void {
    for (const [deviceId, queue] of this.commandQueue.entries()) {
      const index = queue.findIndex(cmd => cmd.id === commandId);
      if (index !== -1) {
        queue.splice(index, 1);
        if (queue.length === 0) {
          this.commandQueue.delete(deviceId);
        }
        break;
      }
    }
  }

  private startCommandProcessor(): void {
    setInterval(() => {
      this.processCommandQueue();
    }, 100); // Process every 100ms
  }

  private async processCommandQueue(): Promise<void> {
    for (const [deviceId, queue] of this.commandQueue.entries()) {
      if (queue.length === 0) {
        this.commandQueue.delete(deviceId);
        continue;
      }

      // Skip if already processing commands for this device
      if (this.processingCommands.has(deviceId)) {
        continue;
      }

      const command = queue[0];
      this.processingCommands.add(deviceId);

      try {
        await this.executeCommand(command);
        queue.shift(); // Remove processed command
      } catch (error) {
        logger.error('Error processing command', error as Error);
      } finally {
        this.processingCommands.delete(deviceId);
      }
    }
  }

  private async executeCommand(command: DeviceCommand): Promise<void> {
    try {
      // Update status to executing
      await this.commandRepository.update(command.id, {
        status: 'executing',
        executedAt: new Date(),
      });

      // Get device info
      const device = await this.deviceRepository.findById(command.deviceId);
      if (!device) {
        throw new AppError('Device not found', 404, 'DEVICE_NOT_FOUND');
      }

      // Send command via appropriate protocol
      let result: any;
      
      if (device.protocol === 'mqtt') {
        result = await this.sendMQTTCommand(device, command);
      } else if (device.protocol === 'http') {
        result = await this.sendHTTPCommand(device, command);
      } else if (device.protocol === 'zigbee' || device.protocol === 'zwave') {
        result = await this.sendProtocolCommand(device, command);
      } else {
        throw new AppError(`Unsupported protocol: ${device.protocol}`, 400, 'UNSUPPORTED_PROTOCOL');
      }

      // Update command status
      await this.commandRepository.update(command.id, {
        status: 'completed',
        completedAt: new Date(),
      });

      // Emit event
      this.emit('commandCompleted', { command, result });

      logger.info('Command executed successfully', {
        commandId: command.id,
        deviceId: command.deviceId,
        command: command.command,
      });
    } catch (error) {
      logger.error('Command execution failed', error as Error);

      // Check if we should retry
      if (command.retryCount < command.maxRetries) {
        await this.commandRepository.update(command.id, {
          status: 'pending',
          retryCount: command.retryCount + 1,
        });

        // Re-add to queue with delay
        setTimeout(() => {
          this.addToQueue(command);
        }, 1000 * Math.pow(2, command.retryCount)); // Exponential backoff
      } else {
        await this.commandRepository.update(command.id, {
          status: 'failed',
          completedAt: new Date(),
          error: (error as Error).message,
        });

        this.emit('commandFailed', { command, error });
      }
    }
  }

  private async sendMQTTCommand(device: any, command: DeviceCommand): Promise<any> {
    const topic = `devices/${device.id}/commands`;
    const payload = {
      command: command.command,
      parameters: command.parameters,
      timestamp: new Date().toISOString(),
    };

    await this.mqttService.publish(topic, JSON.stringify(payload));

    // Wait for response (with timeout)
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Command timeout'));
      }, 30000); // 30 second timeout

      const responseTopic = `devices/${device.id}/responses`;
      this.mqttService.subscribe(responseTopic, (message) => {
        clearTimeout(timeout);
        resolve(JSON.parse(message));
      });
    });
  }

  private async sendHTTPCommand(device: any, command: DeviceCommand): Promise<any> {
    // Implementation for HTTP-based devices
    const response = await fetch(device.metadata.httpEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${device.metadata.apiKey}`,
      },
      body: JSON.stringify({
        command: command.command,
        parameters: command.parameters,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    return await response.json();
  }

  private async sendProtocolCommand(device: any, command: DeviceCommand): Promise<any> {
    // Send command through protocol-specific driver
    const driverTopic = `drivers/${device.protocol}/${device.id}/commands`;
    const payload = {
      command: command.command,
      parameters: command.parameters,
      timestamp: new Date().toISOString(),
    };

    await this.mqttService.publish(driverTopic, JSON.stringify(payload));

    // Wait for response
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Command timeout'));
      }, 30000);

      const responseTopic = `drivers/${device.protocol}/${device.id}/responses`;
      this.mqttService.subscribe(responseTopic, (message) => {
        clearTimeout(timeout);
        resolve(JSON.parse(message));
      });
    });
  }

  async getQueueStatus(): Promise<Map<string, number>> {
    const status = new Map<string, number>();
    for (const [deviceId, queue] of this.commandQueue.entries()) {
      status.set(deviceId, queue.length);
    }
    return status;
  }

  async clearQueue(deviceId: string): Promise<void> {
    this.commandQueue.delete(deviceId);
    logger.info('Command queue cleared', { deviceId });
  }
}
