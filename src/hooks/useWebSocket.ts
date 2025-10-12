import { useEffect, useRef, useState, useCallback } from 'react';

interface WebSocketPriceUpdate {
  type: 'price_update';
  symbol: string;
  data: {
    price: number;
    bid: number;
    ask: number;
  };
}

interface WebSocketMessage {
  type: string;
  message?: string;
}

type WebSocketResponse = WebSocketPriceUpdate | WebSocketMessage;

const WEBSOCKET_URL = import.meta.env.VITE_API_URL 
  ? `ws://${new URL(import.meta.env.VITE_API_URL).host}/ws/market-data`
  : 'ws://localhost:8000/ws/market-data';

interface UseWebSocketProps {
  symbols?: string[];
}

export function useWebSocket({ symbols = [] }: UseWebSocketProps = {}) {
  const [connected, setConnected] = useState(false);
  const [priceUpdates, setPriceUpdates] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const pingInterval = useRef<number | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const cleanup = useCallback(() => {
    if (pingInterval.current) {
      window.clearInterval(pingInterval.current);
      pingInterval.current = null;
    }
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
  }, []);

  const connectWebSocket = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return;

    cleanup();
    ws.current = new WebSocket(WEBSOCKET_URL);

    ws.current.onopen = () => {
      console.log('WebSocket connected');
      setConnected(true);
      setError(null);
      reconnectAttempts.current = 0;
      
      // Start ping interval
      pingInterval.current = window.setInterval(() => {
        if (ws.current?.readyState === WebSocket.OPEN) {
          ws.current.send('ping');
        }
      }, 30000); // Send ping every 30 seconds

      // Subscribe to symbols if provided
      if (symbols.length > 0) {
        ws.current?.send(JSON.stringify({
          type: 'subscribe',
          symbols
        }));
      }
    };

    ws.current.onclose = () => {
      console.log('WebSocket disconnected');
      setConnected(false);
      cleanup();

      // Attempt to reconnect unless we've hit the limit
      reconnectAttempts.current++;
      if (reconnectAttempts.current < maxReconnectAttempts) {
        console.log(`Reconnecting... Attempt ${reconnectAttempts.current}`);
        setTimeout(connectWebSocket, Math.min(1000 * reconnectAttempts.current, 5000));
      } else {
        setError('Connection lost. Please refresh the page to reconnect.');
      }
    };

    ws.current.onerror = (event) => {
      console.error('WebSocket error:', event);
      setError('WebSocket error occurred');
    };

    ws.current.onmessage = (event) => {
      if (event.data === 'pong') {
        return;
      }

      try {
        const message = JSON.parse(event.data) as WebSocketResponse;
        if (message.type === 'price_update') {
          const priceUpdate = message as WebSocketPriceUpdate;
          setPriceUpdates(prev => ({
            ...prev,
            [priceUpdate.symbol]: priceUpdate.data.price
          }));
        } else {
          console.log('Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
  }, [cleanup, symbols]);

  useEffect(() => {
    connectWebSocket();
    return cleanup;
  }, [connectWebSocket, cleanup]);

  // Subscribe to symbols when they change
  useEffect(() => {
    if (connected && ws.current && symbols.length > 0) {
      ws.current.send(JSON.stringify({
        type: 'subscribe',
        symbols
      }));
    }
  }, [connected, symbols]);

  return {
    connected,
    priceUpdates,
    error
  };
}