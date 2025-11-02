import { EventEmitter } from 'events';
import mqtt, { MqttClient } from 'mqtt';
import { logger } from '../../../shared/utils/logger';

interface MqttConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  clientId?: string;
  clean?: boolean;
  reconnectPeriod?: number;
  keepalive?: number;
}

interface TopicSubscription {
  topic: string;
  qos: 0 | 1 | 2;
  handler: (topic: string, message: Buffer) => void;
}

interface PublishOptions {
  qos?: 0 | 1 | 2;
  retain?: boolean;
  dup?: boolean;
}

export class MqttBridgeService extends EventEmitter {
  private client: MqttClient | null = null;
  private subscriptions: Map<string, TopicSubscription> = new Map();
  private messageQueue: Array<{ topic: string; message: string; options: PublishOptions }> = [];
  private isConnected = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;

  constructor(private config: MqttConfig) {
    super();
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const brokerUrl = `mqtt://${this.config.host}:${this.config.port}`;
      
      const options = {
        clientId: this.config.clientId || `mqtt_bridge_${Math.random().toString(16).substr(2, 8)}`,
        clean: this.config.clean !== false,
        reconnectPeriod: this.config.reconnectPeriod || 1000,
        keepalive: this.config.keepalive || 60,
        username: this.config.username,
        password: this.config.password
      };

      this.client = mqtt.connect(brokerUrl, options);

      this.client.on('connect', () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        logger.info('MQTT client connected');
        this.emit('connected');
        
        // Resubscribe to topics
        this.resubscribeAll();
        
        // Process queued messages
        this.processMessageQueue();
        
        resolve();
      });

      this.client.on('error', (error) => {
        logger.error('MQTT connection error:', error);
        this.emit('error', error);
        
        if (!this.isConnected) {
          reject(error);
        }
      });

      this.client.on('close', () => {
        this.isConnected = false;
        logger.warn('MQTT connection closed');
        this.emit('disconnected');
      });

      this.client.on('reconnect', () => {
        this.reconnectAttempts++;
        logger.info(`MQTT reconnecting... (attempt ${this.reconnectAttempts})`);
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          logger.error('Max reconnect attempts reached');
          this.client?.end(true);
        }
      });

      this.client.on('offline', () => {
        logger.warn('MQTT client offline');
        this.emit('offline');
      });

      this.client.on('message', (topic, message) => {
        this.handleMessage(topic, message);
      });
    });
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.client) {
        resolve();
        return;
      }

      this.client.end(false, {}, () => {
        this.isConnected = false;
        this.client = null;
        logger.info('MQTT client disconnected');
        resolve();
      });
    });
  }

  async subscribe(topic: string, qos: 0 | 1 | 2 = 0, handler?: (topic: string, message: Buffer) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('MQTT client not connected'));
        return;
      }

      this.client.subscribe(topic, { qos }, (error) => {
        if (error) {
          logger.error(`Failed to subscribe to topic ${topic}:`, error);
          reject(error);
          return;
        }

        const subscription: TopicSubscription = {
          topic,
          qos,
          handler: handler || ((t, m) => this.emit('message', t, m))
        };

        this.subscriptions.set(topic, subscription);
        logger.info(`Subscribed to topic: ${topic} (QoS ${qos})`);
        resolve();
      });
    });
  }

  async unsubscribe(topic: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('MQTT client not connected'));
        return;
      }

      this.client.unsubscribe(topic, (error) => {
        if (error) {
          logger.error(`Failed to unsubscribe from topic ${topic}:`, error);
          reject(error);
          return;
        }

        this.subscriptions.delete(topic);
        logger.info(`Unsubscribed from topic: ${topic}`);
        resolve();
      });
    });
  }

  async publish(topic: string, message: string | Buffer, options: PublishOptions = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.isConnected) {
        // Queue message if not connected
        this.messageQueue.push({
          topic,
          message: message.toString(),
          options
        });
        logger.warn(`Message queued for topic ${topic} (client not connected)`);
        resolve();
        return;
      }

      const publishOptions = {
        qos: options.qos || 0,
        retain: options.retain || false,
        dup: options.dup || false
      };

      this.client.publish(topic, message, publishOptions, (error) => {
        if (error) {
          logger.error(`Failed to publish to topic ${topic}:`, error);
          reject(error);
          return;
        }

        logger.debug(`Published message to topic: ${topic}`);
        this.emit('published', topic, message);
        resolve();
      });
    });
  }

  private handleMessage(topic: string, message: Buffer): void {
    const subscription = this.subscriptions.get(topic);
    
    if (subscription && subscription.handler) {
      try {
        subscription.handler(topic, message);
      } catch (error) {
        logger.error(`Error handling message for topic ${topic}:`, error);
      }
    }

    // Also emit generic message event
    this.emit('message', topic, message);
  }

  private async resubscribeAll(): Promise<void> {
    for (const subscription of this.subscriptions.values()) {
      try {
        await this.subscribe(subscription.topic, subscription.qos, subscription.handler);
      } catch (error) {
        logger.error(`Failed to resubscribe to ${subscription.topic}:`, error);
      }
    }
  }

  private async processMessageQueue(): Promise<void> {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const { topic, message, options } = this.messageQueue.shift()!;
      
      try {
        await this.publish(topic, message, options);
      } catch (error) {
        logger.error(`Failed to publish queued message to ${topic}:`, error);
        // Re-queue if failed
        this.messageQueue.unshift({ topic, message, options });
        break;
      }
    }
  }

  isClientConnected(): boolean {
    return this.isConnected;
  }

  getSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  getQueuedMessageCount(): number {
    return this.messageQueue.length;
  }

  clearMessageQueue(): void {
    this.messageQueue = [];
    logger.info('Message queue cleared');
  }

  // Device integration helpers
  async publishDeviceState(deviceId: string, state: Record<string, any>): Promise<void> {
    const topic = `devices/${deviceId}/state`;
    const message = JSON.stringify(state);
    await this.publish(topic, message, { qos: 1, retain: true });
  }

  async subscribeToDeviceCommands(deviceId: string, handler: (command: any) => void): Promise<void> {
    const topic = `devices/${deviceId}/commands`;
    await this.subscribe(topic, 1, (_, message) => {
      try {
        const command = JSON.parse(message.toString());
        handler(command);
      } catch (error) {
        logger.error(`Failed to parse device command:`, error);
      }
    });
  }

  async publishDeviceTelemetry(deviceId: string, telemetry: Record<string, any>): Promise<void> {
    const topic = `devices/${deviceId}/telemetry`;
    const message = JSON.stringify({
      ...telemetry,
      timestamp: new Date().toISOString()
    });
    await this.publish(topic, message, { qos: 0 });
  }

  async subscribeToDeviceEvents(deviceId: string, handler: (event: any) => void): Promise<void> {
    const topic = `devices/${deviceId}/events`;
    await this.subscribe(topic, 1, (_, message) => {
      try {
        const event = JSON.parse(message.toString());
        handler(event);
      } catch (error) {
        logger.error(`Failed to parse device event:`, error);
      }
    });
  }

  // Automation integration helpers
  async publishAutomationTrigger(automationId: string, trigger: Record<string, any>): Promise<void> {
    const topic = `automations/${automationId}/triggers`;
    const message = JSON.stringify(trigger);
    await this.publish(topic, message, { qos: 1 });
  }

  async subscribeToAutomationActions(automationId: string, handler: (action: any) => void): Promise<void> {
    const topic = `automations/${automationId}/actions`;
    await this.subscribe(topic, 1, (_, message) => {
      try {
        const action = JSON.parse(message.toString());
        handler(action);
      } catch (error) {
        logger.error(`Failed to parse automation action:`, error);
      }
    });
  }

  // System-wide topics
  async publishSystemEvent(eventType: string, data: Record<string, any>): Promise<void> {
    const topic = `system/events/${eventType}`;
    const message = JSON.stringify({
      ...data,
      timestamp: new Date().toISOString()
    });
    await this.publish(topic, message, { qos: 1 });
  }

  async subscribeToSystemEvents(eventType: string, handler: (event: any) => void): Promise<void> {
    const topic = `system/events/${eventType}`;
    await this.subscribe(topic, 1, (_, message) => {
      try {
        const event = JSON.parse(message.toString());
        handler(event);
      } catch (error) {
        logger.error(`Failed to parse system event:`, error);
      }
    });
  }

  // Wildcard subscriptions
  async subscribeToAllDevices(handler: (deviceId: string, topic: string, message: Buffer) => void): Promise<void> {
    const topic = 'devices/+/#';
    await this.subscribe(topic, 0, (t, m) => {
      const parts = t.split('/');
      const deviceId = parts[1];
      handler(deviceId, t, m);
    });
  }

  async subscribeToAllAutomations(handler: (automationId: string, topic: string, message: Buffer) => void): Promise<void> {
    const topic = 'automations/+/#';
    await this.subscribe(topic, 0, (t, m) => {
      const parts = t.split('/');
      const automationId = parts[1];
      handler(automationId, t, m);
    });
  }

  getStatistics(): {
    connected: boolean;
    subscriptions: number;
    queuedMessages: number;
    reconnectAttempts: number;
  } {
    return {
      connected: this.isConnected,
      subscriptions: this.subscriptions.size,
      queuedMessages: this.messageQueue.length,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}

// Create default instance
export const mqttBridge = new MqttBridgeService({
  host: process.env.MQTT_HOST || 'localhost',
  port: parseInt(process.env.MQTT_PORT || '1883'),
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
  clientId: process.env.MQTT_CLIENT_ID,
  clean: true,
  reconnectPeriod: 5000,
  keepalive: 60
});
