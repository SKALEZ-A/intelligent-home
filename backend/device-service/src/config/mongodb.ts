import { MongoClient, Db } from 'mongodb';
import { createLogger } from '../../../shared/utils/logger';

const logger = createLogger('MongoDB');

let client: MongoClient | null = null;
let db: Db | null = null;

export function getMongoDb(): Db {
  if (!db) {
    throw new Error('MongoDB not connected. Call connectMongoDB() first.');
  }
  return db;
}

export async function connectMongoDB(): Promise<void> {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    const dbName = process.env.MONGODB_DB_NAME || 'home_automation_devices';

    client = new MongoClient(uri, {
      maxPoolSize: parseInt(process.env.MONGODB_POOL_SIZE || '10'),
      minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE || '2'),
      maxIdleTimeMS: parseInt(process.env.MONGODB_IDLE_TIMEOUT || '30000'),
      serverSelectionTimeoutMS: parseInt(process.env.MONGODB_SERVER_TIMEOUT || '5000'),
      socketTimeoutMS: parseInt(process.env.MONGODB_SOCKET_TIMEOUT || '45000'),
    });

    await client.connect();
    db = client.db(dbName);

    // Test connection
    await db.command({ ping: 1 });

    logger.info('MongoDB connected successfully', {
      database: dbName,
      uri: uri.replace(/\/\/.*@/, '//***@'), // Hide credentials in logs
    });

    // Setup change streams for real-time updates
    setupChangeStreams();
  } catch (error) {
    logger.error('Failed to connect to MongoDB', error as Error);
    throw error;
  }
}

export async function disconnectMongoDB(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    logger.info('MongoDB connection closed');
  }
}

export async function healthCheck(): Promise<boolean> {
  try {
    if (!db) return false;
    await db.command({ ping: 1 });
    return true;
  } catch (error) {
    logger.error('MongoDB health check failed', error as Error);
    return false;
  }
}

function setupChangeStreams(): void {
  if (!db) return;

  try {
    // Watch for device state changes
    const deviceCollection = db.collection('devices');
    const deviceChangeStream = deviceCollection.watch();

    deviceChangeStream.on('change', (change) => {
      logger.debug('Device change detected', { operationType: change.operationType });
      // Emit events for real-time updates via WebSocket
      // This will be handled by the WebSocket service
    });

    deviceChangeStream.on('error', (error) => {
      logger.error('Device change stream error', error);
    });

    logger.info('MongoDB change streams initialized');
  } catch (error) {
    logger.error('Failed to setup change streams', error as Error);
  }
}

export async function createCollections(): Promise<void> {
  if (!db) throw new Error('MongoDB not connected');

  try {
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);

    // Create devices collection if it doesn't exist
    if (!collectionNames.includes('devices')) {
      await db.createCollection('devices', {
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['name', 'type', 'protocol', 'homeId', 'userId'],
            properties: {
              name: { bsonType: 'string' },
              type: { bsonType: 'string' },
              protocol: { bsonType: 'string' },
              homeId: { bsonType: 'string' },
              userId: { bsonType: 'string' },
              isOnline: { bsonType: 'bool' },
              isPaired: { bsonType: 'bool' },
              isReachable: { bsonType: 'bool' },
            },
          },
        },
      });
      logger.info('Devices collection created');
    }

    // Create device_commands collection
    if (!collectionNames.includes('device_commands')) {
      await db.createCollection('device_commands', {
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['deviceId', 'command', 'status'],
            properties: {
              deviceId: { bsonType: 'string' },
              command: { bsonType: 'string' },
              status: {
                enum: ['pending', 'executing', 'completed', 'failed', 'timeout'],
              },
              priority: { bsonType: 'int', minimum: 0, maximum: 10 },
            },
          },
        },
      });
      logger.info('Device commands collection created');
    }

    // Create device_groups collection
    if (!collectionNames.includes('device_groups')) {
      await db.createCollection('device_groups');
      logger.info('Device groups collection created');
    }

    // Create device_logs collection
    if (!collectionNames.includes('device_logs')) {
      await db.createCollection('device_logs', {
        capped: true,
        size: 100000000, // 100MB
        max: 1000000, // 1 million documents
      });
      logger.info('Device logs collection created');
    }

    // Create device_health collection
    if (!collectionNames.includes('device_health')) {
      await db.createCollection('device_health');
      logger.info('Device health collection created');
    }

    logger.info('All collections verified/created');
  } catch (error) {
    logger.error('Error creating collections', error as Error);
    throw error;
  }
}
