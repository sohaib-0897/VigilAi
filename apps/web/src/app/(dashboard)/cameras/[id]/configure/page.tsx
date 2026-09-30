'use client';
import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { ModelMetadata, VirtualLine, Zone } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Panel } from '@/components/primitives/panel';
import { StatusIndicator } from '@/components/primitives/status-indicator';
import { statusTone } from '@/lib/status';
import { CameraBreadcrumb } from '@/components/cameras/camera-breadcrumb';
import { ConfirmDialog } from '@/components/console/confirm-dialog';
import { ActionAlert, LoadErrorPanel } from '@/components/console/feedback';
import { GeometryEditor, type LineDraft, type ZoneDraft } from '@/components/cameras/geometry-editor';
import { useLiveCamera } from '@/components/cameras/use-live-camera';
import { DIRECTION_LABELS, errorMessage, frameSize, humanize } from '@/components/cameras/camera-format';

const DEFAULT_MODEL_ID = 'coco-yolov8n-onnx';

type DeleteTarget = { kind: 'zone' | 'line'; id: string; name: string };

export default function ConfigurePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { camera, setCamera, status, loading: cameraLoading, loadError: cameraError, refresh: refreshCamera } = useLiveCamera(id);
  const [zones, setZones] = useState<Zone[] | null>(null);
  const [lines, setLines] = useState<VirtualLine[] | null>(null);
  const [geometryError, setGeometryError] = useState<string | null>(null);
  const [models, setModels] = useState<ModelMetadata[]>([]);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [modelSaving, setModelSaving] = useState(false);
  const [modelMessage, setModelMessage] = useState<string | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const loadGeometry = useCallback(async () => {
    try {
      const [z, l] = await Promise.all([api.getZones(id), api.getLines(id)]);
      setZones(z);
      setLines(l);
      setGeometryError(null);
    } catch (cause) {
      setGeometryError(errorMessage(cause, 'Zones and lines could not be loaded.'));
    }
  }, [id]);

  useEffect(() => {
    loadGeometry();
    api.getModels()
      .then(list => { setModels(list); setModelsError(null); })
      .catch(cause => setModelsError(errorMessage(cause, 'The model list could not be loaded.')));
  }, [loadGeometry]);

  const retryAll = () => {
    refreshCamera();
    loadGeometry();
  };

  const header = (
    <SectionHeader
      tag="Zones & lines"
      title={camera ? camera.name : 'Configure camera'}
      description="Zones and lines are stored normalised to the source frame (0–1), so they stay aligned at any resolution. The worker loads them when analytics starts, and again each time a video file loops."
      action={
        <Button asChild variant="outline" className="min-h-11 sm:min-h-10">
          <Link href={`/cameras/${id}`}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Live view
          </Link>
        </Button>
      }
    />
  );

  if (!camera || !zones || !lines) {
    const failure = cameraError ?? geometryError;
    const stillLoading = (!camera && cameraLoading) || (!failure && (!zones || !lines));
    return (
      <div className="space-y-6">
        <CameraBreadcrumb camera={camera ?? undefined} current={camera ? 'Zones & lines' : undefined} />
        {header}
        {stillLoading ? (
          <div role="status" aria-busy="true" aria-label="Loading configuration" className="grid gap-6 xl:grid-cols-12">
            <Skeleton className="aspect-video w-full border border-border xl:col-span-8" />
            <div className="space-y-6 xl:col-span-4">
              <Skeleton className="h-40 w-full border border-border" />
              <Skeleton className="h-40 w-full border border-border" />
            </div>
          </div>
        ) : (
          <LoadErrorPanel title="The camera configuration could not be loaded." detail={failure ?? ''} onRetry={retryAll} />
        )}
      </div>
    );
  }

  const selectedModelId = camera.model_id ?? DEFAULT_MODEL_ID;
  const selectedModel = models.find(m => m.id === selectedModelId);
  const online = status === 'online';

  const changeModel = async (modelId: string) => {
    setModelSaving(true);
    setModelMessage(null);
    setModelError(null);
    try {
      const updated = await api.updateCamera(id, { model_id: modelId });
      setCamera(updated);
      setModelMessage(camera.analytics_enabled ? 'Detector saved. Restart analytics to load it.' : 'Detector saved.');
    } catch (cause) {
      setModelError(errorMessage(cause, 'The detector could not be changed.'));
    } finally {
      setModelSaving(false);
    }
  };

  const createZone = async (draft: ZoneDraft) => {
    const created = await api.createZone(id, { ...draft, enabled: true });
    setZones(prev => [...(prev ?? []), created]);
  };

  const createLine = async (draft: LineDraft) => {
    const created = await api.createLine(id, { ...draft, enabled: true });
    setLines(prev => [...(prev ?? []), created]);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.kind === 'zone') {
      await api.deleteZone(id, deleteTarget.id);
      setZones(prev => (prev ?? []).filter(z => z.id !== deleteTarget.id));
    } else {
      await api.deleteLine(id, deleteTarget.id);
      setLines(prev => (prev ?? []).filter(l => l.id !== deleteTarget.id));
    }
  };

  return (
    <div className="space-y-6">
      <CameraBreadcrumb camera={camera} current="Zones & lines" />
      {header}

      <div className="grid items-start gap-6 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-8">
          <GeometryEditor
            zones={zones}
            lines={lines}
            streamUrl={online ? `/api/v1/cameras/${id}/stream` : null}
            sourceSize={frameSize(camera)}
            onCreateZone={createZone}
            onCreateLine={createLine}
          />
        </div>

        <div className="grid content-start gap-6 md:grid-cols-2 xl:col-span-4 xl:grid-cols-1">
          <Panel
            labelId="camera-state-heading"
            title="Camera"
            meta={<StatusIndicator tone={statusTone(status)} label={status} live={online} />}
          >
            <p className="p-4 text-body-sm text-muted-foreground">
              {online
                ? 'Streaming: the editor shows the live annotated frame.'
                : 'Not streaming: start analytics on the live view to draw against the image.'}
            </p>
          </Panel>

          <Panel labelId="detector-heading" title="Detector">
            <div className="space-y-3 p-4">
              <div className="space-y-2">
                <Label htmlFor="detector-model">Model</Label>
                <Select value={selectedModelId} onValueChange={v => { if (v && v !== selectedModelId) changeModel(v); }} disabled={modelSaving || models.length === 0}>
                  <SelectTrigger id="detector-model" className="h-11 font-mono text-body-sm">
                    <SelectValue placeholder={selectedModelId} />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map(m => (
                      <SelectItem key={m.id} value={m.id} className="font-mono text-body-sm">
                        {m.name} · {m.framework.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {modelsError && <p className="text-body-sm text-muted-foreground">{modelsError} The camera keeps <span className="font-mono">{selectedModelId}</span>.</p>}
              {selectedModel && (
                <div className="space-y-2 border-t border-border pt-3">
                  <p className="vg-label text-muted-foreground">{humanize(selectedModel.task)} · {selectedModel.img_size}px input</p>
                  <p className="text-body-sm">{selectedModel.description}</p>
                  <ul aria-label="Detected classes" className="flex flex-wrap gap-1">
                    {selectedModel.classes.slice(0, 8).map(c => (
                      <li key={c} className="vg-telemetry border border-border px-1.5">{c}</li>
                    ))}
                    {selectedModel.classes.length > 8 && (
                      <li className="vg-telemetry px-1.5 text-muted-foreground">+{selectedModel.classes.length - 8} more</li>
                    )}
                  </ul>
                </div>
              )}
              <p role="status" className="text-body-sm text-success-ink empty:hidden">{modelMessage}</p>
              <ActionAlert message={modelError} />
            </div>
          </Panel>

          <Panel labelId="zones-heading" title={`Zones (${zones.length})`}>
            {zones.length === 0 ? (
              <p className="p-4 text-body-sm text-muted-foreground">No zones yet. Draw one on the frame.</p>
            ) : (
              <ul className="divide-y divide-border">
                {zones.map(zone => (
                  <GeometryRow
                    key={zone.id}
                    color={zone.color}
                    name={zone.name}
                    detail={`${humanize(zone.zone_type)} · ${zone.points.length} points${zone.enabled ? '' : ' · disabled'}`}
                    onDelete={() => setDeleteTarget({ kind: 'zone', id: zone.id, name: zone.name })}
                    deleteLabel={`Delete zone ${zone.name}`}
                  />
                ))}
              </ul>
            )}
          </Panel>

          <Panel labelId="lines-heading" title={`Lines (${lines.length})`}>
            {lines.length === 0 ? (
              <p className="p-4 text-body-sm text-muted-foreground">No lines yet. Switch to line mode to draw one.</p>
            ) : (
              <ul className="divide-y divide-border">
                {lines.map(line => (
                  <GeometryRow
                    key={line.id}
                    color={line.color}
                    name={line.name}
                    detail={`${DIRECTION_LABELS[line.direction_mode] ?? line.direction_mode}${line.enabled ? '' : ' · disabled'}`}
                    onDelete={() => setDeleteTarget({ kind: 'line', id: line.id, name: line.name })}
                    deleteLabel={`Delete line ${line.name}`}
                  />
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={open => { if (!open) setDeleteTarget(null); }}
        title={deleteTarget ? `Delete ${deleteTarget.kind} ${deleteTarget.name}?` : ''}
        description={
          <p>
            {deleteTarget?.kind === 'zone'
              ? 'Rules that reference this zone are kept but lose their zone. Recorded events are not changed.'
              : 'Rules that reference this line are kept but lose their line. Recorded events are not changed.'}
          </p>
        }
        confirmLabel={`Delete ${deleteTarget?.kind ?? ''}`}
        pendingLabel="Deleting…"
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function GeometryRow({ color, name, detail, onDelete, deleteLabel }: {
  color: string;
  name: string;
  detail: string;
  onDelete: () => void;
  deleteLabel: string;
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-1 pl-4 pr-1">
      <span className="flex min-w-0 items-center gap-3">
        <span className="h-3 w-3 shrink-0 border border-border-strong" style={{ backgroundColor: color }} aria-hidden="true" />
        <span className="min-w-0">
          <span className="block truncate text-body font-medium">{name}</span>
          <span className="vg-telemetry block text-muted-foreground">{detail}</span>
        </span>
      </span>
      <Button variant="ghost" size="icon" onClick={onDelete} aria-label={deleteLabel} className="h-11 w-11 shrink-0 text-danger-ink hover:bg-danger hover:text-danger-foreground">
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </Button>
    </li>
  );
}
