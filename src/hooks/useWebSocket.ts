import { useEffect, useRef, useState, useCallback } from 'react';

// Define the shape of a single position object received from the backend
interface Position {
  ACCOUNT: string;
  SYMBOL: string;
  QTY: number;
  CURRENCY: string;
  COST_BASIS: number | null;
  SOD_PRICE: number | null;
  LAST_PRICE: number | null;
  LAST_TS: string | null;
  PCT_CHANGE_VS_SOD: number | null;
}

/**
 * A custom React hook to manage a WebSocket connection for portfolio data.
 * It handles connecting, receiving data, and maintaining the connection.
 *
 * @returns An object with the connection status, the portfolio data, and any errors.
 */
export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  // This state will hold the entire array of positions from the server
  const [portfolio, setPortfolio] = useState<Position[]>([]);
  const [error, setError] = useState<string | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const pingInterval = useRef<number | null>(null);

  const connectWebSocket = useCallback(() => {
    // Prevent multiple concurrent connections
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      return;
    }

    // Generate a unique client ID for this browser session
    const clientId = `frontend_${Date.now()}`;
    
    // **CRITICAL FIX**: Ensure this URL and port match your backend server
    const WEBSOCKET_URL = `ws://localhost:8002/ws/${clientId}`;
    console.log(`Connecting to WebSocket at: ${WEBSOCKET_URL}`);

    ws.current = new WebSocket(WEBSOCKET_URL);

    ws.current.onopen = () => {
      console.log('✅ WebSocket connection established.');
      setIsConnected(true);
      setError(null);
      
      // Clear any existing ping interval before setting a new one
      if (pingInterval.current) clearInterval(pingInterval.current);

      // Send a "ping" message every 30 seconds to keep the connection alive
      pingInterval.current = window.setInterval(() => {
        if (ws.current?.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({ type: "ping" }));
        }
      }, 30000);
    };

    ws.current.onclose = () => {
      console.log('🔌 WebSocket disconnected.');
      setIsConnected(false);
      if (pingInterval.current) clearInterval(pingInterval.current);
      // Display a persistent error message on disconnection
      setError('Connection lost. Please refresh the page to reconnect.');
    };

    ws.current.onerror = (event) => {
      console.error('WebSocket error:', event);
      setError('A connection error occurred.');
    };

    ws.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        // Handle the full portfolio data snapshots sent by the server
        if (message.type === 'initial_state' || message.type === 'live_update') {
          if (message.snapshot && Array.isArray(message.snapshot)) {
            console.log(`Received ${message.type} with ${message.snapshot.length} positions.`);
            // Update the portfolio state with the new data from the server
            setPortfolio(message.snapshot);
          }
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

  }, []); // Empty dependency array ensures this function is created only once

  useEffect(() => {
    // Connect when the component mounts
    connectWebSocket();

    // Clean up the connection when the component unmounts
    return () => {
      if (pingInterval.current) {
        clearInterval(pingInterval.current);
      }
      if (ws.current) {
        // Unset handlers to prevent them from firing during unmount
        ws.current.onclose = null;
        ws.current.onerror = null;
        ws.current.close();
      }
    };
  }, [connectWebSocket]);

  return { isConnected, portfolio, error };
}