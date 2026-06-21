import { useEffect, useCallback, useRef } from 'react';

interface WebSocketMessage {
  type: string;
  data: unknown;
  timestamp: string;
}

const getDefaultWebSocketBaseUrl = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
};

export const useWebSocket = (
  url: string,
  onMessage: (message: WebSocketMessage) => void,
  onError?: (error: Event) => void
) => {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    try {
      const token = localStorage.getItem('token');
      const wsUrl = `${url}${token ? `?token=${token}` : ''}`;
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        reconnectAttempts.current = 0;
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          onMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        onError?.(error);
      };

      wsRef.current.onclose = () => {
        console.log('WebSocket disconnected');
        if (
          reconnectAttempts.current <
          maxReconnectAttempts
        ) {
          reconnectAttempts.current += 1;
          const delay = Math.min(
            1000 * Math.pow(2, reconnectAttempts.current),
            30000
          );
          setTimeout(connect, delay);
        }
      };
    } catch (error) {
      console.error('WebSocket connection error:', error);
    }
  }, [url, onMessage, onError]);

  useEffect(() => {
    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const send = useCallback((message: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  return { send, isConnected: wsRef.current?.readyState === WebSocket.OPEN };
};

// Hook to subscribe to specific incident updates
export const useIncidentUpdates = (
  incidentId: string,
  onUpdate: (message: WebSocketMessage) => void
) => {
  const wsUrl = `${
    import.meta.env.VITE_WS_URL || getDefaultWebSocketBaseUrl()
  }/ws/incidents/${incidentId}`;

  return useWebSocket(wsUrl, onUpdate);
};

// Hook to subscribe to cluster updates
export const useClusterUpdates = (
  clusterId: string,
  onUpdate: (message: WebSocketMessage) => void
) => {
  const wsUrl = `${
    import.meta.env.VITE_WS_URL || getDefaultWebSocketBaseUrl()
  }/ws/cluster/${clusterId}`;

  return useWebSocket(wsUrl, onUpdate);
};

// Hook to subscribe to alert stream
export const useAlertStream = (
  onAlert: (message: WebSocketMessage) => void
) => {
  const wsUrl = `${
    import.meta.env.VITE_WS_URL || getDefaultWebSocketBaseUrl()
  }/ws/alerts`;

  return useWebSocket(wsUrl, onAlert);
};
