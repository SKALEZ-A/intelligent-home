import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { createLogger } from '../../../shared/utils/logger';
import { RedisService } from '../../../backend/auth-service/src/services/redis.service';

const logger = createLogger('WebSocketService');

interface AuthenticatedSocket extends Socket {
  userId?: string;
  homeIds?: string[];
}

export class WebSocketService {
  private io: SocketIOServer;
  private redisService = new RedisService();
  private connectedClients: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds
  private socketToUser: Map<string, string> = new Map(); // socketId -> userId

  constructor(io: SocketIOServer) {
    this.io = io;
  }

  initialize(): void {
    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

        if (!token) {
          return next(new Error('Authentication token required'));
        }

        // Check if token is blacklisted
        const isBlacklisted = await this.redisService.isTokenBlacklisted(token);
        if (isBlacklisted) {
          return next(new Error('Token has been revoked'));
        }

        // Verify JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
          userId: string;
          homeIds: string[];
        };

        socket.userId = decoded.userId;
        socket.homeIds = decoded.homeIds || [];

        logger.info('WebSocket client authenticated', {
          userId: socket.userId,
          socketId: socket.id,
        });

        next();
      } catch (error) {
        logger.warn('WebSocket authentication failed', { error: (error as Error).message });
        next(new Error('Authentication failed'));
      }
    });

    // Connection handler
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      this.handleConnection(socket);
    });

    logger.info('WebSocket service initialized');
  }

  private handleConnection(socket: AuthenticatedSocket): void {
    const userId = socket.userId!;
    const socketId = socket.id;

    // Track connection
    if (!this.connectedClients.has(userId)) {
      this.connectedClients.set(userId, new Set());
    }
    this.connectedClients.get(userId)!.add(socketId);
    this.socketToUser.set(socketId, userId);

    logger.info('Client connected', {
      userId,
      socketId,
      totalConnections: this.getConnectionCount(),
    });

    // Join user-specific room
    socket.join(`user:${userId}`);

    // Join home-specific rooms
    socket.homeIds?.forEach(homeId => {
      socket.join(`home:${homeId}`);
    });

    // Send welcome message
    socket.emit('connected', {
      message: 'Connected to device service',
      timestamp: new Date(),
    });

    // Handle device subscription
    socket.on('subscribe:device', (deviceId: string) => {
      this.handleDeviceSubscription(socket, deviceId);
    });

    socket.on('unsubscribe:device', (deviceId: string) => {
      this.handleDeviceUnsubscription(socket, deviceId);
    });

    // Handle home subscription
    socket.on('subscribe:home', (homeId: string) => {
      this.handleHomeSubscription(socket, homeId);
    });

    socket.on('unsubscribe:home', (homeId: string) => {
      this.handleHomeUnsubscription(socket, homeId);
    });

    // Handle device commands
    socket.on('device:command', (data: any) => {
      this.handleDeviceCommand(socket, data);
    });

    // Handle ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date() });
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      this.handleDisconnection(socket, reason);
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error('Socket error', { userId, socketId, error });
    });
  }

  private handleDeviceSubscription(socket: AuthenticatedSocket, deviceId: string): void {
    socket.join(`device:${deviceId}`);
    logger.info('Client subscribed to device', {
      userId: socket.userId,
      deviceId,
    });

    socket.emit('subscribed:device', {
      deviceId,
      timestamp: new Date(),
    });
  }

  private handleDeviceUnsubscription(socket: AuthenticatedSocket, deviceId: string): void {
    socket.leave(`device:${deviceId}`);
    logger.info('Client unsubscribed from device', {
      userId: socket.userId,
      deviceId,
    });

    socket.emit('unsubscribed:device', {
      deviceId,
      timestamp: new Date(),
    });
  }

  private handleHomeSubscription(socket: AuthenticatedSocket, homeId: string): void {
    // Verify user has access to this home
    if (!socket.homeIds?.includes(homeId)) {
      socket.emit('error', {
        code: 'ACCESS_DENIED',
        message: 'You do not have access to this home',
      });
      return;
    }

    socket.join(`home:${homeId}`);
    logger.info('Client subscribed to home', {
      userId: socket.userId,
      homeId,
    });

    socket.emit('subscribed:home', {
      homeId,
      timestamp: new Date(),
    });
  }

  private handleHomeUnsubscription(socket: AuthenticatedSocket, homeId: string): void {
    socket.leave(`home:${homeId}`);
    logger.info('Client unsubscribed from home', {
      userId: socket.userId,
      homeId,
    });

    socket.emit('unsubscribed:home', {
      homeId,
      timestamp: new Date(),
    });
  }

  private handleDeviceCommand(socket: AuthenticatedSocket, data: any): void {
    logger.info('Device command received via WebSocket', {
      userId: socket.userId,
      deviceId: data.deviceId,
      command: data.command,
    });

    // Emit to device service for processing
    this.io.emit('device:command:received', {
      userId: socket.userId,
      ...data,
      timestamp: new Date(),
    });
  }

  private handleDisconnection(socket: AuthenticatedSocket, reason: string): void {
    const userId = socket.userId!;
    const socketId = socket.id;

    // Remove from tracking
    const userSockets = this.connectedClients.get(userId);
    if (userSockets) {
      userSockets.delete(socketId);
      if (userSockets.size === 0) {
        this.connectedClients.delete(userId);
      }
    }
    this.socketToUser.delete(socketId);

    logger.info('Client disconnected', {
      userId,
      socketId,
      reason,
      totalConnections: this.getConnectionCount(),
    });
  }

  // Public methods for emitting events

  emitDeviceStateUpdate(deviceId: string, state: any): void {
    this.io.to(`device:${deviceId}`).emit('device:state', {
      deviceId,
      state,
      timestamp: new Date(),
    });
  }

  emitDeviceOnlineStatus(deviceId: string, isOnline: boolean): void {
    this.io.to(`device:${deviceId}`).emit('device:online', {
      deviceId,
      isOnline,
      timestamp: new Date(),
    });
  }

  emitDeviceEvent(deviceId: string, eventType: string, data: any): void {
    this.io.to(`device:${deviceId}`).emit('device:event', {
      deviceId,
      eventType,
      data,
      timestamp: new Date(),
    });
  }

  emitToHome(homeId: string, event: string, data: any): void {
    this.io.to(`home:${homeId}`).emit(event, {
      ...data,
      timestamp: new Date(),
    });
  }

  emitToUser(userId: string, event: string, data: any): void {
    this.io.to(`user:${userId}`).emit(event, {
      ...data,
      timestamp: new Date(),
    });
  }

  emitDeviceAdded(homeId: string, device: any): void {
    this.emitToHome(homeId, 'device:added', { device });
  }

  emitDeviceRemoved(homeId: string, deviceId: string): void {
    this.emitToHome(homeId, 'device:removed', { deviceId });
  }

  emitDeviceUpdated(homeId: string, device: any): void {
    this.emitToHome(homeId, 'device:updated', { device });
  }

  emitCommandStatus(deviceId: string, commandId: string, status: string, result?: any): void {
    this.io.to(`device:${deviceId}`).emit('command:status', {
      deviceId,
      commandId,
      status,
      result,
      timestamp: new Date(),
    });
  }

  emitBatteryAlert(deviceId: string, batteryLevel: number): void {
    this.io.to(`device:${deviceId}`).emit('device:battery:low', {
      deviceId,
      batteryLevel,
      timestamp: new Date(),
    });
  }

  emitDeviceHealthAlert(deviceId: string, healthScore: number, issues: string[]): void {
    this.io.to(`device:${deviceId}`).emit('device:health:alert', {
      deviceId,
      healthScore,
      issues,
      timestamp: new Date(),
    });
  }

  emitFirmwareUpdateProgress(deviceId: string, progress: number, status: string): void {
    this.io.to(`device:${deviceId}`).emit('device:firmware:progress', {
      deviceId,
      progress,
      status,
      timestamp: new Date(),
    });
  }

  // Broadcast to all connected clients
  broadcast(event: string, data: any): void {
    this.io.emit(event, {
      ...data,
      timestamp: new Date(),
    });
  }

  // Get connection statistics
  getConnectionCount(): number {
    return this.socketToUser.size;
  }

  getUserConnectionCount(userId: string): number {
    return this.connectedClients.get(userId)?.size || 0;
  }

  getConnectedUsers(): string[] {
    return Array.from(this.connectedClients.keys());
  }

  isUserConnected(userId: string): boolean {
    return this.connectedClients.has(userId);
  }

  // Disconnect specific user
  disconnectUser(userId: string, reason?: string): void {
    const sockets = this.connectedClients.get(userId);
    if (sockets) {
      sockets.forEach(socketId => {
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.disconnect(true);
        }
      });
    }

    logger.info('User disconnected', { userId, reason });
  }

  // Get room information
  getRoomSize(room: string): number {
    const roomSockets = this.io.sockets.adapter.rooms.get(room);
    return roomSockets?.size || 0;
  }

  getDeviceSubscribers(deviceId: string): number {
    return this.getRoomSize(`device:${deviceId}`);
  }

  getHomeSubscribers(homeId: string): number {
    return this.getRoomSize(`home:${homeId}`);
  }
}
