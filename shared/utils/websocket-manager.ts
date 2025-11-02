import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { logger } from './logger';

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

export interface WebSocketClient {
  id: string;
  ws: WebSocket;
  userId: string;
  subscriptions: Set<string>;
  lastActivity: Date;
}

export class WebSocketManager extends EventEmitter {
  private wss: WebSocket.Server | null = null;
  private clients: Map<string, WebSocketClient> = new Map();
  private rooms: Map<string, Set<string>> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
  }

  initialize(server: any, path: string = '/ws'): void {
    this.wss = new WebSocket.Server({ server, path });

    this.wss.on('connection', (ws: WebSocket, req: any) => {
      this.handleConnection(ws, req);
    });

    // Start heartbeat
    this.startHeartbeat();

    // Start cleanup
    this.startCleanup();

    logger.info(`WebSocket server initialized on path: ${path}`);
  }

  private handleConnection(ws: WebSocket, req: any): void {
    const clientId = this.generateClientId();
    const userId = this.extractUserId(req);

    if (!userId) {
      ws.close(1008, 'Unauthorized');
      return;
    }

    const client: WebSocketClient = {
      id: clientId,
      ws,
      userId,
      subscriptions: new Set(),
      lastActivity: new Date(),
    };

    this.clients.set(clientId, client);

    logger.info(`WebSocket client connected: ${clientId} (user: ${userId})`);

    ws.on('message', (message: string) => {
      this.handleMessage(clientId, message);
    });

    ws.on('close', () => {
      this.handleDisconnection(clientId);
    });

    ws.on('error', (error) => {
      logger.error(`WebSocket error for client ${clientId}:`, error);
    });

    ws.on('pong', () => {
      const client = this.clients.get(clientId);
      if (client) {
        client.lastActivity = new Date();
      }
    });

    // Send welcome message
    this.sendToClient(clientId, {
      type: 'connected',
      data: { clientId, userId },
      timestamp: new Date().toISOString(),
    });

    this.emit('client_connected', { clientId, userId });
  }

  private handleMessage(clientId: string, message: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.lastActivity = new Date();

    try {
      const parsedMessage = JSON.parse(message);

      switch (parsedMessage.type) {
        case 'subscribe':
          this.handleSubscribe(clientId, parsedMessage.data);
          break;
        case 'unsubscribe':
          this.handleUnsubscribe(clientId, parsedMessage.data);
          break;
        case 'ping':
          this.sendToClient(clientId, {
            type: 'pong',
            data: {},
            timestamp: new Date().toISOString(),
          });
          break;
        default:
          this.emit('message', { clientId, message: parsedMessage });
      }
    } catch (error) {
      logger.error(`Error parsing message from client ${clientId}:`, error);
    }
  }

  private handleSubscribe(clientId: string, data: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { room } = data;
    if (!room) return;

    client.subscriptions.add(room);

    if (!this.rooms.has(room)) {
      this.rooms.set(room, new Set());
    }
    this.rooms.get(room)!.add(clientId);

    logger.info(`Client ${clientId} subscribed to room: ${room}`);

    this.sendToClient(clientId, {
      type: 'subscribed',
      data: { room },
      timestamp: new Date().toISOString(),
    });

    this.emit('client_subscribed', { clientId, room });
  }

  private handleUnsubscribe(clientId: string, data: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { room } = data;
    if (!room) return;

    client.subscriptions.delete(room);

    const roomClients = this.rooms.get(room);
    if (roomClients) {
      roomClients.delete(clientId);
      if (roomClients.size === 0) {
        this.rooms.delete(room);
      }
    }

    logger.info(`Client ${clientId} unsubscribed from room: ${room}`);

    this.sendToClient(clientId, {
      type: 'unsubscribed',
      data: { room },
      timestamp: new Date().toISOString(),
    });

    this.emit('client_unsubscribed', { clientId, room });
  }

  private handleDisconnection(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Remove from all rooms
    for (const room of client.subscriptions) {
      const roomClients = this.rooms.get(room);
      if (roomClients) {
        roomClients.delete(clientId);
        if (roomClients.size === 0) {
          this.rooms.delete(room);
        }
      }
    }

    this.clients.delete(clientId);

    logger.info(`WebSocket client disconnected: ${clientId}`);

    this.emit('client_disconnected', { clientId, userId: client.userId });
  }

  sendToClient(clientId: string, message: WebSocketMessage): boolean {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      client.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      logger.error(`Error sending message to client ${clientId}:`, error);
      return false;
    }
  }

  sendToUser(userId: string, message: WebSocketMessage): number {
    let sentCount = 0;

    for (const [clientId, client] of this.clients.entries()) {
      if (client.userId === userId) {
        if (this.sendToClient(clientId, message)) {
          sentCount++;
        }
      }
    }

    return sentCount;
  }

  broadcastToRoom(room: string, message: WebSocketMessage, excludeClientId?: string): number {
    const roomClients = this.rooms.get(room);
    if (!roomClients) return 0;

    let sentCount = 0;

    for (const clientId of roomClients) {
      if (clientId !== excludeClientId) {
        if (this.sendToClient(clientId, message)) {
          sentCount++;
        }
      }
    }

    return sentCount;
  }

  broadcast(message: WebSocketMessage, excludeClientId?: string): number {
    let sentCount = 0;

    for (const [clientId, client] of this.clients.entries()) {
      if (clientId !== excludeClientId && client.ws.readyState === WebSocket.OPEN) {
        if (this.sendToClient(clientId, message)) {
          sentCount++;
        }
      }
    }

    return sentCount;
  }

  getClientsByUserId(userId: string): WebSocketClient[] {
    const clients: WebSocketClient[] = [];

    for (const client of this.clients.values()) {
      if (client.userId === userId) {
        clients.push(client);
      }
    }

    return clients;
  }

  getClientsByRoom(room: string): WebSocketClient[] {
    const roomClients = this.rooms.get(room);
    if (!roomClients) return [];

    const clients: WebSocketClient[] = [];

    for (const clientId of roomClients) {
      const client = this.clients.get(clientId);
      if (client) {
        clients.push(client);
      }
    }

    return clients;
  }

  getClientCount(): number {
    return this.clients.size;
  }

  getRoomCount(): number {
    return this.rooms.size;
  }

  getStats(): any {
    const stats = {
      totalClients: this.clients.size,
      totalRooms: this.rooms.size,
      clientsByRoom: {} as Record<string, number>,
      activeClients: 0,
    };

    const now = new Date();
    for (const client of this.clients.values()) {
      const inactiveTime = now.getTime() - client.lastActivity.getTime();
      if (inactiveTime < 60000) {
        stats.activeClients++;
      }
    }

    for (const [room, clients] of this.rooms.entries()) {
      stats.clientsByRoom[room] = clients.size;
    }

    return stats;
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const [clientId, client] of this.clients.entries()) {
        if (client.ws.readyState === WebSocket.OPEN) {
          try {
            client.ws.ping();
          } catch (error) {
            logger.error(`Error sending ping to client ${clientId}:`, error);
          }
        }
      }
    }, 30000); // Every 30 seconds
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = new Date();
      const timeout = 5 * 60 * 1000; // 5 minutes

      for (const [clientId, client] of this.clients.entries()) {
        const inactiveTime = now.getTime() - client.lastActivity.getTime();

        if (inactiveTime > timeout) {
          logger.info(`Closing inactive client: ${clientId}`);
          client.ws.close(1000, 'Inactive timeout');
          this.handleDisconnection(clientId);
        }
      }
    }, 60000); // Every minute
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private extractUserId(req: any): string | null {
    try {
      // Extract from query parameter
      const url = new URL(req.url, `http://${req.headers.host}`);
      const token = url.searchParams.get('token');

      if (!token) return null;

      // In a real implementation, verify the JWT token here
      // For now, we'll just extract the user ID from the token
      // This is a simplified example
      const decoded = this.decodeToken(token);
      return decoded?.userId || null;
    } catch (error) {
      logger.error('Error extracting user ID:', error);
      return null;
    }
  }

  private decodeToken(token: string): any {
    // Simplified token decoding
    // In production, use proper JWT verification
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const payload = Buffer.from(parts[1], 'base64').toString('utf8');
      return JSON.parse(payload);
    } catch (error) {
      return null;
    }
  }

  shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    for (const client of this.clients.values()) {
      client.ws.close(1001, 'Server shutting down');
    }

    this.clients.clear();
    this.rooms.clear();

    if (this.wss) {
      this.wss.close();
    }

    logger.info('WebSocket manager shut down');
  }
}

export const websocketManager = new WebSocketManager();
