/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useSyncExternalStore } from 'react';

type MessageHandler = (data: any) => void;

class WebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private shouldReconnect = true;
  private messageHandlers = new Map<string, Set<MessageHandler>>();
  private connectionListeners = new Set<(isConnected: boolean) => void>();
  private isConnected = false;

  private readonly MAX_RECONNECT_ATTEMPTS = 10;
  private readonly RECONNECT_INTERVAL = 3000;

  constructor() {
    this.connect();
  }

  private connect() {
    const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL;
    
    if (!wsUrl) {
      console.error('WebSocket url not defined in environment variables');
      return;
    }

    if (this.ws) {
      this.ws.close();
    }

    const ws = new WebSocket(wsUrl);
    this.ws = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.notifyConnectionListeners();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type) {
          const handlers = this.messageHandlers.get(data.type);
          if (handlers) {
            handlers.forEach(handler => handler(data));
          }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.isConnected = false;
      this.notifyConnectionListeners();

      if (this.shouldReconnect && this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
        this.reconnectAttempts++;
        console.log(`Reconnecting... Attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS}`);
        
        this.reconnectTimeout = setTimeout(() => {
          this.connect();
        }, this.RECONNECT_INTERVAL);
      } else if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
        console.error('Max reconnect attempts reached');
      }
    };
  }

  private notifyConnectionListeners() {
    this.connectionListeners.forEach(listener => listener(this.isConnected));
  }

  public on(eventType: string, handler: MessageHandler) {
    if (!this.messageHandlers.has(eventType)) {
      this.messageHandlers.set(eventType, new Set());
    }
    this.messageHandlers.get(eventType)!.add(handler);
  }

  public off(eventType: string, handler: MessageHandler) {
    const handlers = this.messageHandlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.messageHandlers.delete(eventType);
      }
    }
  }

  public send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket is not connected');
    }
  }

  public subscribeToConnection(listener: (isConnected: boolean) => void) {
    this.connectionListeners.add(listener);
    return () => {
      this.connectionListeners.delete(listener);
    };
  }

  public getConnectionState() {
    return this.isConnected;
  }

  public disconnect() {
    this.shouldReconnect = false;
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    if (this.ws) {
      this.ws.close();
    }
  }
}

let wsManager: WebSocketManager | null = null;

const getWebSocketManager = () => {
  if (!wsManager) {
    wsManager = new WebSocketManager();
  }
  return wsManager;
};

export function useWebSocket() {
  const manager = getWebSocketManager();
  
  const isConnected = useSyncExternalStore(
    (callback) => manager.subscribeToConnection(callback),
    () => manager.getConnectionState(),
    () => false
  );

  const on = useCallback((eventType: string, handler: MessageHandler) => {
    manager.on(eventType, handler);
  }, [manager]);

  const off = useCallback((eventType: string, handler: MessageHandler) => {
    manager.off(eventType, handler);
  }, [manager]);

  const send = useCallback((data: any) => {
    manager.send(data);
  }, [manager]);

  return { isConnected, on, off, send };
}