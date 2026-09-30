'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Film, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import type { Camera } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { CameraCard } from '@/components/cameras/camera-card';
import { CreateCameraDialog } from '@/components/cameras/create-camera-dialog';
import { ActionAlert, LoadErrorPanel } from '@/components/console/feedback';
import { clock, errorMessage } from '@/components/cameras/camera-format';

// Camera status is written by the worker to the database; the list has no
// push channel for it, so it refreshes on a visible-tab interval.
const POLL_MS = 15_000;

export default function CamerasPage() {
  const router = useRouter();
  const [cameras, setCameras] = useState<Camera[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [openingDemo, setOpeningDemo] = useState(false);
  const inFlight = useRef(false);

  const fetchCameras = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    try {
      const res = await api.getCameras();
      setCameras(res.items);
      setLoadError(null);
      setUpdatedAt(new Date());
    } catch (cause) {
      setLoadError(errorMessage(cause, 'Request failed'));
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCameras();
    const interval = setInterval(() => {
      if (!document.hidden) fetchCameras();
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [fetchCameras]);

  const handleToggleAnalytics = async (camera: Camera) => {
    setActionError(null);
    setPendingIds(ids => new Set(ids).add(camera.id));
    try {
      if (camera.analytics_enabled) await api.stopCamera(camera.id);
      else await api.startCamera(camera.id);
    } catch (cause) {
      setActionError(`${camera.name}: ${errorMessage(cause, 'Could not change the analytics state.')}`);
    } finally {
      setPendingIds(ids => {
        const next = new Set(ids);
        next.delete(camera.id);
        return next;
      });
      fetchCameras();
    }
  };

  const handleUseDemo = async () => {
    setActionError(null);
    setOpeningDemo(true);
    try {
      const camera = await api.createDemoCamera();
      router.push(`/cameras/${camera.id}`);
    } catch (cause) {
      setActionError(errorMessage(cause, 'Could not open the demo video.'));
      setOpeningDemo(false);
    }
  };

  const header = (
    <SectionHeader
      tag="Cameras"
      title="Cameras"
      description="Video sources owned by your account. Starting analytics hands the source to the CV worker; the API only records the request."
      action={
        <>
          <Button variant="outline" onClick={handleUseDemo} disabled={openingDemo} className="min-h-11 sm:min-h-10">
            <Film className="h-4 w-4" aria-hidden="true" />
            {openingDemo ? 'Opening demo…' : 'Use demo video'}
          </Button>
          <CreateCameraDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={fetchCameras} />
        </>
      }
    />
  );

  if (!cameras) {
    return (
      <div className="space-y-6">
        {header}
        <ActionAlert message={actionError} onDismiss={() => setActionError(null)} />
        {loading ? <CameraGridSkeleton /> : <LoadErrorPanel title="The camera list could not be loaded." detail={loadError ?? ''} onRetry={fetchCameras} />}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      <ActionAlert message={actionError} onDismiss={() => setActionError(null)} />
      {loadError && updatedAt && (
        <p role="alert" className="vg-telemetry border border-warning bg-warning/15 px-3 py-2 text-foreground">
          Refresh failed ({loadError}). Showing data from {clock(updatedAt)}.
        </p>
      )}

      {cameras.length === 0 ? (
        <div className="space-y-3 border border-border-strong bg-surface px-4 py-12 text-center sm:px-6">
          <p className="text-body font-semibold">No cameras yet.</p>
          <p className="mx-auto max-w-measure text-body-sm text-muted-foreground">
            Add an RTSP stream, a webcam on the worker host or an uploaded video file. The bundled demo video needs no hardware.
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            <Button onClick={() => setCreateOpen(true)} className="min-h-11">Add camera</Button>
            <Button variant="outline" onClick={handleUseDemo} disabled={openingDemo} className="min-h-11">
              {openingDemo ? 'Opening demo…' : 'Use demo video'}
            </Button>
          </div>
        </div>
      ) : (
        <section aria-label="Camera list" className="space-y-2">
          <ul className="grid grid-cols-1 gap-px border border-border-strong bg-border md:grid-cols-2 2xl:grid-cols-3">
            {cameras.map(camera => (
              <CameraCard
                key={camera.id}
                camera={camera}
                pending={pendingIds.has(camera.id)}
                onToggleAnalytics={handleToggleAnalytics}
              />
            ))}
            <GridFillers count={cameras.length} />
          </ul>
          <p className="vg-telemetry flex flex-wrap items-center justify-between gap-2 text-muted-foreground">
            <span>
              {cameras.length} {cameras.length === 1 ? 'camera' : 'cameras'}
              {updatedAt && ` · status as of ${clock(updatedAt)} · refresh ${POLL_MS / 1000}s`}
            </span>
            <button
              type="button"
              onClick={fetchCameras}
              disabled={loading}
              className="vg-label inline-flex min-h-11 items-center gap-1.5 text-foreground underline decoration-1 underline-offset-4 hover:decoration-2 disabled:opacity-45"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'motion-safe:animate-spin')} aria-hidden="true" />
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </p>
        </section>
      )}
    </div>
  );
}

/** Blank cells that keep the hairline grid rectangular at 2 (md) and 3 (2xl) columns. */
function GridFillers({ count }: { count: number }) {
  const md = (2 - (count % 2)) % 2;
  const xxl = (3 - (count % 3)) % 3;
  return (
    <>
      {Array.from({ length: Math.max(md, xxl) }, (_, i) => (
        <li
          key={i}
          aria-hidden="true"
          className={cn('hidden bg-surface', i < md && 'md:block', i < xxl ? '2xl:block' : '2xl:hidden')}
        />
      ))}
    </>
  );
}

function CameraGridSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading cameras" className="grid grid-cols-1 gap-px border border-border-strong bg-border md:grid-cols-2 2xl:grid-cols-3">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="space-y-4 bg-surface p-4">
          <div className="flex justify-between gap-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-6 w-16" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  );
}
