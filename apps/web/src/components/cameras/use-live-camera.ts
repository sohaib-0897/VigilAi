'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useCameraStatus } from '@/lib/hooks';
import type { Camera } from '@/lib/types';
import { errorMessage } from './camera-format';

/** Fields the worker writes to `vigilai:camera:{id}:status` while its pipeline runs. */
export interface WorkerHeartbeat {
  status: 'online';
  fps?: number;
  frames_processed?: number;
  frames_dropped?: number;
  active_tracks?: number;
  total_events?: number;
  /** Unix seconds. */
  timestamp?: number;
}

const FALLBACK_POLL_MS = 10_000;

/**
 * The camera record (`GET /cameras/{id}`) combined with the worker heartbeat
 * from `WS /ws/cameras/{id}/status`. The socket re-sends the heartbeat every
 * second and `{"status":"offline"}` when none exists, so the record is only
 * re-fetched when the heartbeat appears or disappears — never per message.
 */
export function useLiveCamera(id: string) {
  const [camera, setCamera] = useState<Camera | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { lastMessage, connected } = useCameraStatus(id);

  const refresh = useCallback(async () => {
    try {
      setCamera(await api.getCamera(id));
      setLoadError(null);
    } catch (cause) {
      setLoadError(errorMessage(cause, 'The camera could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  const heartbeat: WorkerHeartbeat | null =
    connected && lastMessage && typeof lastMessage === 'object' && lastMessage.status === 'online'
      ? (lastMessage as WorkerHeartbeat)
      : null;
  const workerLive = heartbeat !== null;

  const previous = useRef<boolean | null>(null);
  useEffect(() => {
    if (previous.current !== null && previous.current !== workerLive) refresh();
    previous.current = workerLive;
  }, [workerLive, refresh]);

  // Without the socket (or while the worker is still connecting) fall back to polling the record.
  const needsPoll = !connected || camera?.status === 'connecting';
  useEffect(() => {
    if (!needsPoll) return;
    const interval = setInterval(() => {
      if (!document.hidden) refresh();
    }, FALLBACK_POLL_MS);
    return () => clearInterval(interval);
  }, [needsPoll, refresh]);

  // The heartbeat is the fresher signal; otherwise the persisted status stands.
  const status = workerLive ? 'online' : camera?.status ?? 'offline';

  return { camera, setCamera, status, heartbeat, socketConnected: connected, loading, loadError, refresh };
}
