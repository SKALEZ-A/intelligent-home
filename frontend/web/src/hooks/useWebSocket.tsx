import { useState, useEffect, useRef, useCallback } from 'react';
import { authService } from '../services/auth.service';

const WS_BASE_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:3002';

interface UseWebSocketOptions {
  reconnect?: boolean;
  reconnectInterval?: number;
  reconnectAttempts?: number;
}

interface UseWebSocketReturn {
  lastMessage: string | null;
  sendMessage: (message: string) => void;
  connected: boolean;
  error: string | null;
}

export const useWebSocket = (
  path: string,
  options: UseWebSocketOptions = {}
): UseWebSocketReturn => {
  const {
    reconnect = true,
    reconnectInterval = 3000,
    reconnectAttempts = 5,
  } = options;

  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    try {
      const token = authService.getToken();
      if (!token) {
        setError('No authentication token available');
        return;
      }

      const url = `${WS_BASE_URL}${path}?token=${token}`;
      const ws = new WebSocket(url);

      ws.onopen = () => {
        console.log('WebSocket connected:', path);
        setConnected(true);
        setError(null);
        reconnectCountRef.current = 0;
      };

      ws.onmessage = (event) => {
        setLastMessage(event.data);
      };

      ws.onerror = (event) => {
        console.error('WebSocket error:', event);
        setError('WebSocket connection error');
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected:', path);
        setConnected(false);
        wsRef.current = null;

        // Attempt to reconnect
        if (reconnect && reconnectCountRef.current < reconnectAttempts) {
          reconnectCountRef.current++;
          console.log(
            `Attempting to reconnect (${reconnectCountRef.current}/${reconnectAttempts})...`
          );
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        } else if (reconnectCountRef.current >= reconnectAttempts) {
          setError('Max reconnection attempts reached');
        }
      };

      wsRef.current = ws;
    } catch (err: any) {
      console.error('Failed to create WebSocket connection:', err);
      setError(err.message);
    }
  }, [path, reconnect, reconnectInterval, reconnectAttempts]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const sendMessage = useCallback((message: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(message);
    } else {
      console.error('WebSocket is not connected');
      setError('Cannot send message: WebSocket is not connected');
    }
  }, []);

  return {
    lastMessage,
    sendMessage,
    connected,
    error,
  };
};
