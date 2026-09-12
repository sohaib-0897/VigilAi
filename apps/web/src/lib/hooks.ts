import { useEffect, useRef, useState } from 'react';
import { api } from './api';

export function useWebSocket(url: string) {
  const [lastMessage, setLastMessage] = useState<any>(null);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    let stopped = false;
    const connect = () => {
      if (stopped || !url) return;
      ws.current = new WebSocket(url);
      ws.current.onmessage = (event) => setLastMessage(JSON.parse(event.data));
      ws.current.onclose = () => {
        if (!stopped) timeout = setTimeout(connect, 3000);
      };
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
  const url = typeof window === 'undefined' ? '' : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/v1/ws/events`;
  return useWebSocket(url);
}
