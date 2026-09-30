'use client';
import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { AnalyticsRule, Camera, VirtualLine, Zone } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SectionHeader } from '@/components/ui/section-header';
import { SeverityBadge } from '@/components/ui/severity-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Panel } from '@/components/primitives/panel';
import { ConfirmDialog } from '@/components/console/confirm-dialog';
import { ActionAlert, LoadErrorPanel } from '@/components/console/feedback';
import { duration, errorMessage } from '@/components/console/format';
import { PPE_ITEMS, ruleType, ruleTypeLabel } from '@/components/console/vocabulary';
import { RuleForm, type RulePayload } from '@/components/rules/rule-form';

// The camera's detector when `model_id` is unset (same default as the configure page).
const DEFAULT_MODEL_ID = 'coco-yolov8n-onnx';

interface CameraConfig { rules: AnalyticsRule[]; zones: Zone[]; lines: VirtualLine[] }
type Editor = { mode: 'create' } | { mode: 'edit'; rule: AnalyticsRule } | null;

export default function RulesPage() {
  return (
    <Suspense fallback={<div className="space-y-6"><RulesHeader /><RulesSkeleton /></div>}>
      <RulesView />
    </Suspense>
  );
}

function RulesHeader({ action }: { action?: React.ReactNode }) {
  return (
    <SectionHeader
      tag="Rules"
      title="Rules"
      description="Rules turn tracked objects into events. Each rule belongs to one camera and watches one of its zones or lines. The worker loads a camera’s enabled rules when analytics starts, and again each time a video file loops."
      action={action}
    />
  );
}

function RulesView() {
  const router = useRouter();
  const pathname = usePathname();
  const requested = useSearchParams().get('camera');

  const [cameras, setCameras] = useState<Camera[] | null>(null);
  const [camerasError, setCamerasError] = useState<string | null>(null);
  const [config, setConfig] = useState<CameraConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [classes, setClasses] = useState<string[] | null>(null);
  const [editor, setEditor] = useState<Editor>(null);
  const [deleteTarget, setDeleteTarget] = useState<AnalyticsRule | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const loadCameras = useCallback(async () => {
    try {
      setCameras((await api.getCameras(1, 100)).items);
      setCamerasError(null);
    } catch (cause) {
      setCamerasError(errorMessage(cause, 'The camera list could not be loaded.'));
    }
  }, []);

  useEffect(() => { loadCameras(); }, [loadCameras]);

  const camera = cameras?.find(c => c.id === requested) ?? cameras?.[0] ?? null;
  const cameraId = camera?.id ?? null;
  const modelId = camera ? camera.model_id ?? DEFAULT_MODEL_ID : null;

  const loadConfig = useCallback(async () => {
    if (!cameraId) return;
    setConfig(null);
    setConfigError(null);
    try {
      const [rules, zones, lines] = await Promise.all([api.getRules(cameraId), api.getZones(cameraId), api.getLines(cameraId)]);
      setConfig({ rules, zones, lines });
    } catch (cause) {
      setConfigError(errorMessage(cause, 'The rules for this camera could not be loaded.'));
    }
  }, [cameraId]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  // Class names for the rule form; without them the form falls back to free text.
  useEffect(() => {
    if (!modelId) return;
    let cancelled = false;
    setClasses(null);
    api.getModel(modelId)
      .then(model => { if (!cancelled) setClasses(model.classes.length ? model.classes : null); })
      .catch(() => { if (!cancelled) setClasses(null); });
    return () => { cancelled = true; };
  }, [modelId]);

  const selectCamera = (id: string) => {
    if (!id || id === cameraId) return;
    setActionError(null);
    router.replace(`${pathname}?camera=${id}`, { scroll: false });
  };

  const saveRule = async (payload: RulePayload) => {
    if (!cameraId || !editor) return;
    if (editor.mode === 'create') {
      const created = await api.createRule(cameraId, payload);
      setConfig(c => c && { ...c, rules: [...c.rules, created] });
      setAnnouncement(`Rule “${created.name}” created.`);
    } else {
      const updated = await api.updateRule(cameraId, editor.rule.id, payload);
      setConfig(c => c && { ...c, rules: c.rules.map(r => (r.id === updated.id ? updated : r)) });
      setAnnouncement(`Rule “${updated.name}” saved.`);
    }
    setEditor(null);
  };

  const toggleRule = async (rule: AnalyticsRule, enabled: boolean) => {
    if (!cameraId) return;
    setToggling(rule.id);
    setActionError(null);
    try {
      const updated = await api.updateRule(cameraId, rule.id, { enabled });
      setConfig(c => c && { ...c, rules: c.rules.map(r => (r.id === updated.id ? updated : r)) });
      setAnnouncement(`Rule “${rule.name}” ${enabled ? 'enabled' : 'disabled'}.`);
    } catch (cause) {
      setActionError(`“${rule.name}” could not be ${enabled ? 'enabled' : 'disabled'}: ${errorMessage(cause, 'request failed')}`);
    } finally {
      setToggling(null);
    }
  };

  const deleteRule = async () => {
    if (!cameraId || !deleteTarget) return;
    await api.deleteRule(cameraId, deleteTarget.id);
    setConfig(c => c && { ...c, rules: c.rules.filter(r => r.id !== deleteTarget.id) });
    setAnnouncement(`Rule “${deleteTarget.name}” deleted.`);
  };

  const header = (
    <RulesHeader
      action={
        cameras && cameras.length > 0 && camera ? (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="rules-camera">Camera</Label>
              <Select value={camera.id} onValueChange={selectCamera}>
                <SelectTrigger id="rules-camera" className="h-11 sm:w-64"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {cameras.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => setEditor({ mode: 'create' })} disabled={!config} className="min-h-11">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add rule
            </Button>
          </div>
        ) : undefined
      }
    />
  );

  if (!cameras) {
    return (
      <div className="space-y-6">
        {header}
        {camerasError
          ? <LoadErrorPanel title="The camera list could not be loaded." detail={camerasError} onRetry={loadCameras} />
          : <RulesSkeleton />}
      </div>
    );
  }

  if (!camera) {
    return (
      <div className="space-y-6">
        {header}
        <div className="space-y-3 border border-border-strong bg-surface px-4 py-10 text-center sm:px-6">
          <p className="text-body font-semibold">No cameras yet.</p>
          <p className="mx-auto max-w-measure text-body-sm text-muted-foreground">Rules belong to a camera. Add a camera, draw a zone or line on it, then create rules here.</p>
          <Button asChild variant="outline" className="min-h-11"><Link href="/cameras">Go to cameras</Link></Button>
        </div>
      </div>
    );
  }

  const zoneName = (id?: string | null) => config?.zones.find(z => z.id === id)?.name;
  const lineName = (id?: string | null) => config?.lines.find(l => l.id === id)?.name;

  return (
    <div className="space-y-6">
      {header}
      <p role="status" className="sr-only">{announcement}</p>
      {requested && requested !== camera.id && (
        <p role="alert" className="vg-telemetry flex items-center gap-2 border border-warning bg-warning/15 px-3 py-2 text-foreground">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          The requested camera was not found. Showing {camera.name}.
        </p>
      )}

      {configError ? (
        <LoadErrorPanel title="The rules for this camera could not be loaded." detail={configError} onRetry={loadConfig} />
      ) : !config ? (
        <RulesSkeleton />
      ) : (
        <Panel
          labelId="rules-heading"
          title={`Rules on ${camera.name}`}
          meta={
            <span className="vg-telemetry text-muted-foreground">
              {config.rules.filter(r => r.enabled).length} of {config.rules.length} enabled
            </span>
          }
        >
          <div className="border-b border-border px-4 py-3">
            <ActionAlert message={actionError} onDismiss={() => setActionError(null)} />
            <p className="text-body-sm text-muted-foreground">
              {config.zones.length} {config.zones.length === 1 ? 'zone' : 'zones'} and {config.lines.length} {config.lines.length === 1 ? 'line' : 'lines'} on this camera ·{' '}
              <Link href={`/cameras/${camera.id}/configure`} className="underline decoration-1 underline-offset-4 hover:decoration-2">Edit zones and lines</Link>
            </p>
          </div>

          {config.rules.length === 0 ? (
            <div className="space-y-3 px-4 py-10 text-center sm:px-6">
              <p className="text-body font-semibold">No rules on this camera.</p>
              <p className="mx-auto max-w-measure text-body-sm text-muted-foreground">
                Without rules the worker still detects and tracks, but it records no events.
              </p>
              <Button onClick={() => setEditor({ mode: 'create' })} className="min-h-11">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add rule
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {config.rules.map(rule => (
                <RuleRow
                  key={rule.id}
                  rule={rule}
                  zoneName={zoneName(rule.zone_id)}
                  lineName={lineName(rule.line_id)}
                  toggling={toggling === rule.id}
                  onToggle={enabled => toggleRule(rule, enabled)}
                  onEdit={() => setEditor({ mode: 'edit', rule })}
                  onDelete={() => setDeleteTarget(rule)}
                />
              ))}
            </ul>
          )}
        </Panel>
      )}

      <Dialog open={editor !== null} onOpenChange={open => { if (!open) setEditor(null); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editor?.mode === 'edit' ? 'Edit rule' : 'Add rule'}</DialogTitle>
            <p className="text-body-sm text-muted-foreground">On {camera.name}. Takes effect the next time the worker loads this camera’s rules.</p>
          </DialogHeader>
          {editor && config && (
            <RuleForm
              key={editor.mode === 'edit' ? editor.rule.id : 'new'}
              cameraId={camera.id}
              zones={config.zones}
              lines={config.lines}
              classes={classes}
              initial={editor.mode === 'edit' ? editor.rule : undefined}
              submitLabel={editor.mode === 'edit' ? 'Save rule' : 'Create rule'}
              pendingLabel="Saving…"
              onSubmit={saveRule}
              onCancel={() => setEditor(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={open => { if (!open) setDeleteTarget(null); }}
        title="Delete rule?"
        description={
          <>
            <p>“{deleteTarget?.name}” will stop firing the next time the worker loads this camera’s rules.</p>
            <p>Events it already recorded are kept; they lose their link to the rule.</p>
          </>
        }
        confirmLabel="Delete rule"
        pendingLabel="Deleting…"
        onConfirm={deleteRule}
      />
    </div>
  );
}

function RuleRow({ rule, zoneName, lineName, toggling, onToggle, onEdit, onDelete }: {
  rule: AnalyticsRule;
  zoneName?: string;
  lineName?: string;
  toggling: boolean;
  onToggle: (enabled: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const info = ruleType(rule.rule_type);
  const switchId = `rule-enabled-${rule.id}`;
  // Deleting a zone or line sets the rule's reference to NULL (ondelete SET NULL).
  const geometryMissing =
    (info?.geometry === 'zone' && !rule.zone_id) || (info?.geometry === 'line' && !rule.line_id);
  const ppeItems = Array.isArray(rule.configuration?.required_ppe) ? (rule.configuration.required_ppe as string[]) : [];

  const facts: string[] = [];
  if (info?.geometry === 'line') {
    if (rule.line_id) facts.push(`Line: ${lineName ?? 'unknown line'}`);
  } else if (rule.zone_id) {
    facts.push(`Zone: ${zoneName ?? 'unknown zone'}`);
  } else if (info?.geometry === 'optional-zone') {
    facts.push('Whole frame');
  }
  if (info?.threshold && rule.threshold_value != null) {
    facts.push(rule.rule_type === 'dwell_time' ? `≥ ${duration(rule.threshold_value)}` : `≥ ${rule.threshold_value} objects`);
  }
  if (rule.rule_type === 'ppe_violation') {
    if (ppeItems.length) facts.push(`Requires ${ppeItems.map(p => PPE_ITEMS.find(i => i.value === p)?.label.toLowerCase() ?? p).join(', ')}`);
    const window = rule.configuration?.confirmation_duration_seconds ?? rule.threshold_value;
    if (typeof window === 'number') facts.push(`Confirm ${duration(window)}`);
  } else if (rule.rule_type !== 'occupancy_threshold') {
    facts.push(rule.object_classes?.length ? `Classes: ${rule.object_classes.join(', ')}` : 'All classes');
  }
  facts.push(`Cooldown ${rule.cooldown_seconds} s`);

  return (
    <li className="flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="min-w-0 break-words text-body-lg font-semibold">{rule.name}</h3>
          <SeverityBadge severity={rule.severity} />
        </div>
        <p className="vg-label text-foreground">{ruleTypeLabel(rule.rule_type)}</p>
        <p className="vg-telemetry flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
          {facts.map(f => <span key={f}>{f}</span>)}
        </p>
        {geometryMissing && (
          <p className="flex items-start gap-2 text-body-sm text-danger-ink">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Its {info?.geometry} was deleted, so this rule cannot fire. Edit it to choose another.
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="flex min-h-11 items-center gap-3 border border-border px-3">
          <Switch
            id={switchId}
            checked={rule.enabled}
            onCheckedChange={onToggle}
            disabled={toggling}
            aria-describedby={`${switchId}-state`}
          />
          <Label htmlFor={switchId} className="cursor-pointer">Enabled</Label>
          <span id={`${switchId}-state`} className="vg-telemetry w-[4.5rem] text-muted-foreground">
            {toggling ? 'Saving…' : rule.enabled ? 'On' : 'Off'}
          </span>
        </div>
        <Button variant="outline" onClick={onEdit} className="min-h-11" aria-label={`Edit ${rule.name}`}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Edit
        </Button>
        <Button variant="outline" onClick={onDelete} className="min-h-11 hover:bg-danger hover:text-danger-foreground" aria-label={`Delete ${rule.name}`}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Delete
        </Button>
      </div>
    </li>
  );
}

function RulesSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading rules" className="divide-y divide-border border border-border-strong bg-surface">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-72 max-w-full" />
          </div>
          <Skeleton className="h-11 w-64 max-w-full" />
        </div>
      ))}
    </div>
  );
}
