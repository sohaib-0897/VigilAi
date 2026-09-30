import Link from 'next/link';
import { ArrowRight, Play, SlidersHorizontal, Square } from 'lucide-react';
import type { Camera } from '@/lib/types';
import { statusTone } from '@/lib/status';
import { Button } from '@/components/ui/button';
import { StatusIndicator } from '@/components/primitives/status-indicator';
import { sourceLabel, sourceSummary } from './camera-format';

interface CameraCardProps {
  camera: Camera;
  /** Set while a start/stop request for this camera is in flight. */
  pending?: boolean;
  onToggleAnalytics: (camera: Camera) => void;
}

export function CameraCard({ camera, pending = false, onToggleAnalytics }: CameraCardProps) {
  const running = camera.analytics_enabled;
  const headingId = `camera-${camera.id}-name`;
  return (
    <li className="flex min-w-0 flex-col bg-surface">
      <article aria-labelledby={headingId} className="flex flex-1 flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <h2 id={headingId} className="min-w-0 font-display text-title font-semibold">
            <Link
              href={`/cameras/${camera.id}`}
              className="group inline-flex max-w-full items-center gap-1.5 underline decoration-transparent decoration-1 underline-offset-4 transition-colors duration-micro hover:decoration-current"
            >
              <span className="truncate">{camera.name}</span>
              <ArrowRight className="h-4 w-4 shrink-0 transition-transform duration-micro ease-standard group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </h2>
          <StatusIndicator tone={statusTone(camera.status)} label={camera.status} live={camera.status === 'online'} className="shrink-0" />
        </div>

        <dl className="grid flex-1 grid-cols-[6.5rem_1fr] content-start gap-x-3 gap-y-2 px-4 py-4 text-body-sm">
          <dt className="vg-label text-muted-foreground">Source</dt>
          <dd className="min-w-0">
            <span className="font-medium">{sourceLabel(camera.source_type)}</span>
            <span className="vg-telemetry block truncate text-muted-foreground" title={sourceSummary(camera)}>{sourceSummary(camera)}</span>
          </dd>
          <dt className="vg-label text-muted-foreground">Analytics</dt>
          <dd>
            <StatusIndicator variant="inline" tone={running ? 'success' : 'inactive'} label={running ? 'Enabled' : 'Stopped'} />
          </dd>
          <dt className="vg-label text-muted-foreground">Detector</dt>
          <dd className="vg-telemetry truncate">{camera.model_id ?? 'Default'}</dd>
          {camera.status_message && camera.status !== 'online' && (
            <>
              <dt className="vg-label text-muted-foreground">Worker</dt>
              <dd className="text-muted-foreground">{camera.status_message}</dd>
            </>
          )}
        </dl>

        <div className="grid grid-cols-2 gap-2 border-t border-border p-3">
          <Button asChild variant="outline" size="sm" className="min-h-11 sm:min-h-9">
            <Link href={`/cameras/${camera.id}/configure`} aria-label={`Configure zones and lines for ${camera.name}`}>
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              Geometry
            </Link>
          </Button>
          <Button
            size="sm"
            variant={running ? 'outline' : 'default'}
            onClick={() => onToggleAnalytics(camera)}
            disabled={pending}
            aria-label={`${running ? 'Stop' : 'Start'} analytics for ${camera.name}`}
            className="min-h-11 sm:min-h-9"
          >
            {running ? <Square className="h-3.5 w-3.5" aria-hidden="true" /> : <Play className="h-3.5 w-3.5" aria-hidden="true" />}
            {pending ? (running ? 'Stopping…' : 'Starting…') : running ? 'Stop' : 'Start'}
          </Button>
        </div>
      </article>
    </li>
  );
}
