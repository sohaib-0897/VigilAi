import { useEffect, useRef, useState } from 'react';
import { api } from './api';

export function getWebSocketBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  // When running on Next.js dev port 3000, direct WebSocket to FastAPI on port 8000
  if (window.location.port === '3000') {
    return `${protocol}//${window.location.hostname}:8000`;
  }
  return `${protocol}//${window.location.host}`;
}

export function useWebSocket(url: string) {
  const [lastMessage, setLastMessage] = useState<any>(null);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    let stopped = false;
    const connect = () => {
      if (stopped || !url) return;
      try {
        ws.current = new WebSocket(url);
        ws.current.onmessage = (event) => {
          try {
            setLastMessage(JSON.parse(event.data));
          } catch {
            setLastMessage(event.data);
          }
        };
        ws.current.onclose = () => {
          if (!stopped) timeout = setTimeout(connect, 3000);
        };
        ws.current.onerror = () => {
          // Trigger close handler to backoff and retry cleanly
          ws.current?.close();
        };
      } catch {
        if (!stopped) timeout = setTimeout(connect, 3000);
      }
    };
    connect();
    return () => {
      stopped = true;
      clearTimeout(timeout);
      ws.current?.close();
    };
  }, [url]);

  return { lastMessage };
}

export function useEventStream() {
  const base = getWebSocketBaseUrl();
  const url = base ? `${base}/api/v1/ws/events` : '';
  return useWebSocket(url);
}

export function useCameraStatus(cameraId: string) {
  const base = getWebSocketBaseUrl();
  const url = base && cameraId ? `${base}/api/v1/ws/cameras/${cameraId}/status` : '';
  return useWebSocket(url);
}

