'use client';
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Maximize2, Minimize2, Pause, Play, VideoOff } from 'lucide-react';
import { statusTone } from '@/lib/status';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { StatusIndicator } from '@/components/primitives/status-indicator';
import { ViewportFrame } from '@/components/primitives/viewport-frame';
import { clock } from './camera-format';
import type { WorkerHeartbeat } from './use-live-camera';

interface LiveFeedProps {
  cameraId: string;
  name: string;
  /** Effective status: the worker heartbeat when present, else the persisted status. */
  status: string;
  statusMessage?: string | null;
  analyticsEnabled: boolean;
  heartbeat: WorkerHeartbeat | null;
  modelId?: string | null;
}

const rail = 'h-11 w-11 sm:h-8 sm:w-8 border-border bg-transparent text-foreground hover:bg-muted hover:shadow-none hover:translate-x-0 hover:translate-y-0';

/**
 * The annotated MJPEG stream from `GET /cameras/{id}/stream` (cookie-authenticated,
 * ownership-checked). The image is mounted only while the camera is online; any
 * other state is shown explicitly instead of a frozen or blank frame.
 */
export function LiveFeed({ cameraId, name, status, statusMessage, analyticsEnabled, heartbeat, modelId }: LiveFeedProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);

  const online = status === 'online';

  // A new online period gets a fresh stream connection.
  useEffect(() => {
    if (online) setStreamError(false);
  }, [online]);

  useEffect(() => {
    setCanFullscreen(typeof document !== 'undefined' && document.fullscreenEnabled);
    const onChange = () => setFullscreen(document.fullscreenElement === frameRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    else frameRef.current?.requestFullscreen().catch(() => undefined);
  };

  const retry = () => {
    setStreamError(false);
    setAttempt(a => a + 1);
  };

  const showStream = online && !paused && !streamError;

  return (
    <div ref={frameRef} className={cn('surface-optical', fullscreen && 'flex h-full flex-col justify-center')}>
      <ViewportFrame
        as="figure"
        aria-label={`Live view: ${name}`}
        label={name}
        brackets={showStream}
        meta={
          <>
            <StatusIndicator tone={statusTone(status)} label={status} live={online} />
            {online && (
              <Button
                variant="outline"
                size="icon"
                className={rail}
                onClick={() => setPaused(p => !p)}
                aria-label={paused ? 'Resume stream' : 'Pause stream'}
              >
                {paused ? <Play className="h-3.5 w-3.5" aria-hidden="true" /> : <Pause className="h-3.5 w-3.5" aria-hidden="true" />}
              </Button>
            )}
            {canFullscreen && (
              <Button variant="outline" size="icon" className={rail} onClick={toggleFullscreen} aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}>
                {fullscreen ? <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" /> : <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />}
              </Button>
            )}
          </>
        }
        footer={
          <>
            <span className="truncate">DETECTOR {modelId ?? 'DEFAULT'}</span>
            <span className="shrink-0">
              {heartbeat?.timestamp ? `HEARTBEAT ${clock(new Date(heartbeat.timestamp * 1000))}` : 'NO WORKER HEARTBEAT'}
            </span>
          </>
        }
      >
        <div className="relative aspect-video w-full bg-background">
          {showStream ? (
            // eslint-disable-next-line @next/next/no-img-element -- MJPEG multipart stream; next/image cannot proxy it.
            <img
              key={attempt}
              src={`/api/v1/cameras/${cameraId}/stream`}
              alt={`Annotated live stream from ${name}`}
              onError={() => setStreamError(true)}
              className="absolute inset-0 h-full w-full object-contain"
            />
          ) : (
            <FeedState
              status={status}
              paused={online && paused}
              streamError={online && streamError}
              statusMessage={statusMessage}
              analyticsEnabled={analyticsEnabled}
              onResume={() => setPaused(false)}
              onRetry={retry}
            />
          )}
        </div>
      </ViewportFrame>
    </div>
  );
}

function FeedState({
  status,
  paused,
  streamError,
  statusMessage,
  analyticsEnabled,
  onResume,
  onRetry,
}: {
  status: string;
  paused: boolean;
  streamError: boolean;
  statusMessage?: string | null;
  analyticsEnabled: boolean;
  onResume: () => void;
  onRetry: () => void;
}) {
  let icon = <VideoOff className="h-5 w-5" aria-hidden="true" />;
  let title: string;
  let body: string;
  let action: React.ReactNode = null;

  if (paused) {
    icon = <Pause className="h-5 w-5" aria-hidden="true" />;
    title = 'Stream paused';
    body = 'Only this view is paused. The worker keeps running analytics and recording events.';
    action = <Button variant="secondary" onClick={onResume} className="min-h-11"><Play className="h-4 w-4" aria-hidden="true" />Resume stream</Button>;
  } else if (streamError) {
    icon = <AlertTriangle className="h-5 w-5" aria-hidden="true" />;
    title = 'Stream interrupted';
    body = 'The stream connection closed. The camera still reports online.';
    action = <Button variant="secondary" onClick={onRetry} className="min-h-11">Reconnect</Button>;
  } else if (status === 'connecting') {
    icon = <Loader2 className="h-5 w-5 motion-safe:animate-spin" aria-hidden="true" />;
    title = 'Connecting to the source';
    body = 'The worker is opening the source. The stream appears when the first frames are processed.';
  } else if (status === 'error' || status === 'degraded') {
    icon = <AlertTriangle className="h-5 w-5" aria-hidden="true" />;
    title = status === 'error' ? 'The worker reported an error' : 'The source is degraded';
    body = statusMessage || 'No further detail was reported.';
  } else {
    title = 'No live stream';
    body = analyticsEnabled
      ? `Analytics is enabled but the camera reports ${status}${statusMessage ? ` (${statusMessage})` : ''}.`
      : 'Analytics is stopped. Start analytics to stream annotated frames from the worker.';
  }

  return (
    <div className="absolute inset-0 grid place-items-center overflow-y-auto bg-tech-grid p-4 text-center">
      <div className="max-w-sm space-y-3">
        <span className="mx-auto grid h-10 w-10 place-items-center border border-border text-foreground">{icon}</span>
        <p className="font-display text-title font-semibold">{title}</p>
        <p className="text-body-sm text-muted-foreground">{body}</p>
        {action && <div className="pt-1">{action}</div>}
      </div>
    </div>
  );
}
