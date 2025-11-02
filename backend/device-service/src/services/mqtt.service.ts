import mqtt, { MqttClient } from 'mqtt';
import { EventEmitter } from 'events';
import { createLogger } from '../../../shared/utils/logger';

const logger = createLogger('MQTTService');

export class MQTTService extends EventEmitter {
  private client: MqttClient | null = null;
  private subscriptions: Map<string, Set<(message: string) => void>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;

  constructor() {
    super();
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
        const options = {
          clientId: `device-service-${Math.random().toString(16).substr(2, 8)}`,
          username: process.env.MQTT_USERNAME,
          password: process.env.MQTT_PASSWORD,
          clean: true,
          reconnectPeriod: 1000,
          connectTimeout: 30000,
          will: {
            topic: 'device-service/status',
            payload: JSON.stringify({ status: 'offline', timestamp: new Date() }),
            qos: 1,
            retain: true,
          },
        };

        this.client = mqtt.connect(brokerUrl, options);

        this.client.on('connect', () => {
          logger.info('MQTT connected successfully', { broker: brokerUrl });
          this.reconnectAttempts = 0;

          // Publish online status
          this.publish('device-service/status', JSON.stringify({
            status: 'online',
            timestamp: new Date(),
          }), { qos: 1, retain: true });

          // Resubscribe to all topics
          this.resubscribeAll();

          this.emit('connected');
          resolve();
        });

        this.client.on('error', (error) => {
          logger.error('MQTT connection error', error);
          this.emit('error', error);
          
          if (this.reconnectAttempts === 0) {
            reject(error);
          }
        });

        this.client.on('reconnect', () => {
          this.reconnectAttempts++;
          logger.warn('MQTT reconnecting', { attempt: this.reconnectAttempts });

          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            logger.error('Max reconnect attempts reached');
            this.client?.end(true);
          }
        });

        this.client.on('close', () => {
          logger.warn('MQTT connection closed');
          this.emit('disconnected');
        });

        this.client.on('offline', () => {
          logger.warn('MQTT client offline');
          this.emit('offline');
        });

        this.client.on('message', (topic, message) => {
          this.handleMessage(topic, message.toString());
        });

      } catch (error) {
        logger.error('Failed to connect to MQTT broker', error as Error);
        reject(error);
      }
    });
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.client) {
        resolve();
        return;
      }

      // Publish offline status
      this.publish('device-service/status', JSON.stringify({
        status: 'offline',
        timestamp: new Date(),
      }), { qos: 1, retain: true });

      this.client.end(false, {}, () => {
        logger.info('MQTT disconnected');
        this.client = null;
        resolve();
      });
    });
  }

  subscribe(topic: string, callback: (message: string) => void): void {
    if (!this.client) {
      throw new Error('MQTT client not connected');
    }

    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, new Set());
      
      this.client.subscribe(topic, { qos: 1 }, (error) => {
        if (error) {
          logger.error('Failed to subscribe to topic', { topic, error });
        } else {
          logger.info('Subscribed to topic', { topic });
        }
      });
    }

    this.subscriptions.get(topic)!.add(callback);
  }

  unsubscribe(topic: string, callback?: (message: string) => void): void {
    if (!this.client) {
      return;
    }

    if (callback) {
      const callbacks = this.subscriptions.get(topic);
      if (callbacks) {
        callbacks.delete(callback);
        
        if (callbacks.size === 0) {
          this.subscriptions.delete(topic);
          this.client.unsubscribe(topic, (error) => {
            if (error) {
              logger.error('Failed to unsubscribe from topic', { topic, error });
            } else {
              logger.info('Unsubscribed from topic', { topic });
            }
          });
        }
      }
    } else {
      this.subscriptions.delete(topic);
      this.client.unsubscribe(topic, (error) => {
        if (error) {
          logger.error('Failed to unsubscribe from topic', { topic, error });
        } else {
          logger.info('Unsubscribed from topic', { topic });
        }
      });
    }
  }

  publish(topic: string, message: string, options?: { qos?: 0 | 1 | 2; retain?: boolean }): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('MQTT client not connected'));
        return;
      }

      const publishOptions = {
        qos: options?.qos || 0,
        retain: options?.retain || false,
      };

      this.client.publish(topic, message, publishOptions as any, (error) => {
        if (error) {
          logger.error('Failed to publish message', { topic, error });
          reject(error);
        } else {
          logger.debug('Message published', { topic, messageLength: message.length });
          resolve();
        }
      });
    });
  }

  publishJson(topic: string, data: any, options?: { qos?: 0 | 1 | 2; retain?: boolean }): Promise<void> {
    return this.publish(topic, JSON.stringify(data), options);
  }

  private handleMessage(topic: string, message: string): void {
    logger.debug('Message received', { topic, messageLength: message.length });

    // Emit general message event
    this.emit('message', { topic, message });

    // Call topic-specific callbacks
    const callbacks = this.subscriptions.get(topic);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(message);
        } catch (error) {
          logger.error('Error in message callback', { topic, error });
        }
      });
    }

    // Handle wildcard subscriptions
    for (const [subscribedTopic, callbacks] of this.subscriptions.entries()) {
      if (this.matchTopic(subscribedTopic, topic)) {
        callbacks.forEach(callback => {
          try {
            callback(message);
          } catch (error) {
            logger.error('Error in wildcard message callback', { subscribedTopic, topic, error });
          }
        });
      }
    }
  }

  private matchTopic(pattern: string, topic: string): boolean {
    // Convert MQTT wildcard pattern to regex
    const regexPattern = pattern
      .replace(/\+/g, '[^/]+')
      .replace(/#/g, '.*');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(topic);
  }

  private resubscribeAll(): void {
    if (!this.client) return;

    for (const topic of this.subscriptions.keys()) {
      this.client.subscribe(topic, { qos: 1 }, (error) => {
        if (error) {
          logger.error('Failed to resubscribe to topic', { topic, error });
        } else {
          logger.info('Resubscribed to topic', { topic });
        }
      });
    }
  }

  isConnected(): boolean {
    return this.client?.connected || false;
  }

  getSubscribedTopics(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  // Device-specific methods
  subscribeToDevice(deviceId: string, callback: (message: any) => void): void {
    const topic = `devices/${deviceId}/#`;
    this.subscribe(topic, (message) => {
      try {
        const data = JSON.parse(message);
        callback(data);
      } catch (error) {
        logger.error('Failed to parse device message', { deviceId, error });
      }
    });
  }

  publishDeviceCommand(deviceId: string, command: string, parameters: any): Promise<void> {
    const topic = `devices/${deviceId}/commands`;
    const payload = {
      command,
      parameters,
      timestamp: new Date().toISOString(),
    };
    return this.publishJson(topic, payload, { qos: 1 });
  }

  publishDeviceState(deviceId: string, state: any): Promise<void> {
    const topic = `devices/${deviceId}/state`;
    const payload = {
      ...state,
      timestamp: new Date().toISOString(),
    };
    return this.publishJson(topic, payload, { qos: 1, retain: true });
  }

  subscribeToDeviceState(deviceId: string, callback: (state: any) => void): void {
    const topic = `devices/${deviceId}/state`;
    this.subscribe(topic, (message) => {
      try {
        const state = JSON.parse(message);
        callback(state);
      } catch (error) {
        logger.error('Failed to parse device state', { deviceId, error });
      }
    });
  }

  subscribeToDeviceEvents(deviceId: string, callback: (event: any) => void): void {
    const topic = `devices/${deviceId}/events`;
    this.subscribe(topic, (message) => {
      try {
        const event = JSON.parse(message);
        callback(event);
      } catch (error) {
        logger.error('Failed to parse device event', { deviceId, error });
      }
    });
  }

  publishDeviceEvent(deviceId: string, eventType: string, data: any): Promise<void> {
    const topic = `devices/${deviceId}/events`;
    const payload = {
      eventType,
      data,
      timestamp: new Date().toISOString(),
    };
    return this.publishJson(topic, payload, { qos: 1 });
  }

  // Protocol-specific methods
  subscribeToProtocol(protocol: string, callback: (message: any) => void): void {
    const topic = `protocols/${protocol}/#`;
    this.subscribe(topic, (message) => {
      try {
        const data = JSON.parse(message);
        callback(data);
      } catch (error) {
        logger.error('Failed to parse protocol message', { protocol, error });
      }
    });
  }

  publishToProtocol(protocol: string, subtopic: string, data: any): Promise<void> {
    const topic = `protocols/${protocol}/${subtopic}`;
    return this.publishJson(topic, data, { qos: 1 });
  }

  // Hub-specific methods
  subscribeToHub(hubId: string, callback: (message: any) => void): void {
    const topic = `hubs/${hubId}/#`;
    this.subscribe(topic, (message) => {
      try {
        const data = JSON.parse(message);
        callback(data);
      } catch (error) {
        logger.error('Failed to parse hub message', { hubId, error });
      }
    });
  }

  publishToHub(hubId: string, subtopic: string, data: any): Promise<void> {
    const topic = `hubs/${hubId}/${subtopic}`;
    return this.publishJson(topic, data, { qos: 1 });
  }

  // Broadcast methods
  broadcastToHome(homeId: string, eventType: string, data: any): Promise<void> {
    const topic = `homes/${homeId}/broadcast`;
    const payload = {
      eventType,
      data,
      timestamp: new Date().toISOString(),
    };
    return this.publishJson(topic, payload, { qos: 0 });
  }

  subscribeToHomeBroadcast(homeId: string, callback: (event: any) => void): void {
    const topic = `homes/${homeId}/broadcast`;
    this.subscribe(topic, (message) => {
      try {
        const event = JSON.parse(message);
        callback(event);
      } catch (error) {
        logger.error('Failed to parse home broadcast', { homeId, error });
      }
    });
  }
}
