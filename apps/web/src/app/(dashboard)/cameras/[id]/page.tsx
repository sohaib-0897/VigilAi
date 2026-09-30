'use client';
import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Play, SlidersHorizontal, Square, Trash2, Upload } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { MetricDisplay } from '@/components/primitives/metric-display';
import { Panel } from '@/components/primitives/panel';
import { StatusIndicator } from '@/components/primitives/status-indicator';
import { LiveFeed } from '@/components/cameras/live-feed';
import { ConfirmDialog } from '@/components/console/confirm-dialog';
import { ActionAlert, LoadErrorPanel } from '@/components/console/feedback';
import { CameraBreadcrumb } from '@/components/cameras/camera-breadcrumb';
import { useLiveCamera } from '@/components/cameras/use-live-camera';
import { errorMessage, frameSize, sourceLabel, sourceSummary } from '@/components/cameras/camera-format';

const VIDEO_ACCEPT = '.mp4,.avi,.mov,.mkv';

export default function CameraDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { camera, status, heartbeat, socketConnected, loading, loadError, refresh } = useLiveCamera(id);
  const [toggling, setToggling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (!camera) {
    return (
      <div className="space-y-6">
        <CameraBreadcrumb />
        {loading ? (
          <div role="status" aria-busy="true" aria-label="Loading camera" className="space-y-6">
            <Skeleton className="h-24 w-full" />
            <div className="grid gap-6 xl:grid-cols-12">
              <Skeleton className="aspect-video w-full border border-border xl:col-span-8" />
              <Skeleton className="h-64 w-full border border-border xl:col-span-4" />
            </div>
          </div>
        ) : (
          <LoadErrorPanel title="The camera could not be loaded." detail={loadError ?? ''} onRetry={refresh} />
        )}
      </div>
    );
  }

  const running = camera.analytics_enabled;
  const size = frameSize(camera);

  const toggleAnalytics = async () => {
    setActionError(null);
    setToggling(true);
    try {
      if (running) await api.stopCamera(id);
      else await api.startCamera(id);
    } catch (cause) {
      setActionError(errorMessage(cause, 'Could not change the analytics state.'));
    } finally {
      setToggling(false);
      refresh();
    }
  };

  const deleteCamera = async () => {
    // Stop the worker first so it does not keep a pipeline for a deleted camera.
    if (camera.analytics_enabled) await api.stopCamera(id);
    await api.deleteCamera(id);
    router.push('/cameras');
  };

  return (
    <div className="space-y-6">
      <CameraBreadcrumb camera={camera} />

      <SectionHeader
        tag={`Live view · ${sourceLabel(camera.source_type)}`}
        title={camera.name}
        description={camera.description || undefined}
        action={
          <>
            <Button asChild variant="outline" className="min-h-11 sm:min-h-10">
              <Link href={`/cameras/${id}/configure`}>
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                Zones &amp; lines
              </Link>
            </Button>
            <Button variant={running ? 'outline' : 'default'} onClick={toggleAnalytics} disabled={toggling} className="min-h-11 sm:min-h-10">
              {running ? <Square className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
              {toggling ? (running ? 'Stopping…' : 'Starting…') : running ? 'Stop analytics' : 'Start analytics'}
            </Button>
          </>
        }
      />

      {/* One atomic announcement per status change; telemetry numbers are not announced. */}
      <p role="status" aria-atomic="true" className="sr-only">Camera status: {status}</p>
      <ActionAlert message={actionError} onDismiss={() => setActionError(null)} />

      <div className="grid items-start gap-6 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-8">
          <LiveFeed
            cameraId={id}
            name={camera.name}
            status={status}
            statusMessage={camera.status_message}
            analyticsEnabled={running}
            heartbeat={heartbeat}
            modelId={camera.model_id}
          />
        </div>

        <div className="grid content-start gap-6 md:grid-cols-2 xl:col-span-4 xl:grid-cols-1">
          <Panel
            labelId="telemetry-heading"
            title="Pipeline telemetry"
            meta={
              <StatusIndicator
                variant="inline"
                tone={heartbeat ? 'success' : 'inactive'}
                live={Boolean(heartbeat)}
                label={heartbeat ? 'Heartbeat' : socketConnected ? 'No heartbeat' : 'Socket offline'}
              />
            }
          >
            <ul className="grid grid-cols-2 gap-px bg-border">
              <TelemetryCell label="Processing rate" value={heartbeat?.fps?.toFixed(1)} unit="FPS" />
              <TelemetryCell label="Active tracks" value={heartbeat?.active_tracks} />
              <TelemetryCell label="Frames processed" value={heartbeat?.frames_processed?.toLocaleString('en-US')} />
              <TelemetryCell label="Frames dropped" value={heartbeat?.frames_dropped?.toLocaleString('en-US')} />
              <TelemetryCell label="Events this run" value={heartbeat?.total_events} className="col-span-2" />
            </ul>
            <p className="border-t border-border px-4 py-3 text-body-sm text-muted-foreground">
              Reported by the worker every ~2 s while its pipeline runs. Counts reset when the pipeline restarts.
            </p>
          </Panel>

          <Panel labelId="source-heading" title="Source">
            <dl className="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-3 p-4 text-body-sm">
              <dt className="vg-label text-muted-foreground">Type</dt>
              <dd>{sourceLabel(camera.source_type)}</dd>
              <dt className="vg-label text-muted-foreground">Source</dt>
              <dd className="vg-telemetry min-w-0 break-all">{sourceSummary(camera)}</dd>
              <dt className="vg-label text-muted-foreground">Frame size</dt>
              <dd className="vg-telemetry">{size ? `${size.width} × ${size.height}` : 'NOT_MEASURED'}</dd>
              <dt className="vg-label text-muted-foreground">Detector</dt>
              <dd className="vg-telemetry break-all">{camera.model_id ?? 'Default'}</dd>
              <dt className="vg-label text-muted-foreground">Analytics</dt>
              <dd><StatusIndicator variant="inline" tone={running ? 'success' : 'inactive'} label={running ? 'Enabled' : 'Stopped'} /></dd>
              {camera.status_message && (
                <>
                  <dt className="vg-label text-muted-foreground">Last message</dt>
                  <dd>{camera.status_message}</dd>
                </>
              )}
            </dl>
          </Panel>

          {camera.source_type === 'local_video' && <ReplaceVideoPanel cameraId={id} onUploaded={refresh} />}

          <Panel labelId="remove-heading" title="Remove camera">
            <div className="space-y-3 p-4">
              <p className="text-body-sm text-muted-foreground">
                Deletes the camera with its zones, lines, rules, events and track summaries.
              </p>
              <Button variant="outline" onClick={() => setDeleteOpen(true)} className="min-h-11 w-full border-danger text-danger-ink hover:bg-danger hover:text-danger-foreground">
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete camera
              </Button>
            </div>
          </Panel>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${camera.name}?`}
        description={
          <>
            <p>This permanently removes the camera and everything recorded for it: zones, lines, rules, events and track summaries.</p>
            {running && <p>Analytics is running. It will be stopped first.</p>}
          </>
        }
        confirmLabel="Delete camera"
        pendingLabel="Deleting…"
        onConfirm={deleteCamera}
      />
    </div>
  );
}

function TelemetryCell({ label, value, unit, className }: { label: string; value: React.ReactNode | undefined; unit?: string; className?: string }) {
  return (
    <li className={cn('bg-surface p-4', className)}>
      <MetricDisplay label={label} value={value} unit={unit} size="sm" />
    </li>
  );
}

function ReplaceVideoPanel({ cameraId, onUploaded }: { cameraId: string; onUploaded: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inputKey, setInputKey] = useState(0);

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setMessage(null);
    setError(null);
    try {
      await api.uploadVideo(cameraId, file);
      setMessage(`${file.name} uploaded. The worker reads it the next time analytics starts.`);
      setFile(null);
      setInputKey(k => k + 1);
      onUploaded();
    } catch (cause) {
      setError(errorMessage(cause, 'The upload failed.'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Panel labelId="replace-video-heading" title="Replace video">
      <form onSubmit={upload} method="post" aria-busy={uploading} className="space-y-3 p-4">
        <div className="space-y-2">
          <Label htmlFor="replace-video">Video file</Label>
          <Input
            key={inputKey}
            id="replace-video"
            name="file"
            type="file"
            accept={VIDEO_ACCEPT}
            disabled={uploading}
            onChange={e => setFile(e.target.files?.[0] ?? null)}
            aria-describedby="replace-video-hint"
            className="h-11 cursor-pointer py-2 file:mr-3 file:cursor-pointer file:border-r file:border-border-strong file:pr-3 file:font-sans file:text-label file:font-semibold file:uppercase file:tracking-[0.08em]"
          />
          <p id="replace-video-hint" className="text-body-sm text-muted-foreground">MP4, AVI, MOV or MKV.</p>
        </div>
        <Button type="submit" disabled={!file || uploading} className="min-h-11 w-full">
          <Upload className="h-4 w-4" aria-hidden="true" />
          {uploading ? 'Uploading…' : 'Upload video'}
        </Button>
        <p role="status" className="text-body-sm text-success-ink empty:hidden">{message}</p>
        <ActionAlert message={error} />
      </form>
    </Panel>
  );
}
