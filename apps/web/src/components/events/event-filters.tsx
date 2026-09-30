'use client';
import { X } from 'lucide-react';
import type { Camera } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EVENT_STATUSES, RULE_TYPES, SEVERITIES } from '@/components/console/vocabulary';
import { capitalize } from '@/components/console/format';

/** `ALL` stands for "no filter": Radix Select cannot hold an empty value. */
export const ALL = 'all';

export interface EventFilterValues {
  camera: string;
  type: string;
  severity: string;
  status: string;
}

export const EMPTY_FILTERS: EventFilterValues = { camera: ALL, type: ALL, severity: ALL, status: ALL };

export const hasFilters = (f: EventFilterValues) => Object.values(f).some(v => v !== ALL);

/** API query parameters for the list and the export (`api/v1/events.py`). */
export function filterParams(f: EventFilterValues): Record<string, string> {
  const params: Record<string, string> = {};
  if (f.camera !== ALL) params.camera_id = f.camera;
  if (f.type !== ALL) params.event_type = f.type;
  if (f.severity !== ALL) params.severity = f.severity;
  if (f.status !== ALL) params.status = f.status;
  return params;
}

export function EventFilters({ values, cameras, onChange }: {
  values: EventFilterValues;
  cameras: Camera[] | null;
  onChange: (next: EventFilterValues) => void;
}) {
  // Radix Select can emit '' (Stage 8); never turn that into a filter value.
  const set = (key: keyof EventFilterValues) => (value: string) => {
    if (value && value !== values[key]) onChange({ ...values, [key]: value });
  };
  // Keep a filtered camera selectable even if the camera list failed or it was deleted.
  const cameraKnown = values.camera === ALL || cameras?.some(c => c.id === values.camera);

  return (
    <fieldset className="border border-border-strong bg-surface p-4">
      <legend className="sr-only">Filter events</legend>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto] xl:items-end">
        <Field id="filter-camera" label="Camera">
          <Select value={values.camera} onValueChange={set('camera')}>
            <SelectTrigger id="filter-camera" className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All cameras</SelectItem>
              {cameras?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              {!cameraKnown && <SelectItem value={values.camera}>Camera {values.camera.substring(0, 8)}</SelectItem>}
            </SelectContent>
          </Select>
        </Field>
        <Field id="filter-type" label="Event type">
          <Select value={values.type} onValueChange={set('type')}>
            <SelectTrigger id="filter-type" className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All types</SelectItem>
              {RULE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field id="filter-severity" label="Severity">
          <Select value={values.severity} onValueChange={set('severity')}>
            <SelectTrigger id="filter-severity" className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All severities</SelectItem>
              {SEVERITIES.map(s => <SelectItem key={s} value={s}>{capitalize(s)}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field id="filter-status" label="Status">
          <Select value={values.status} onValueChange={set('status')}>
            <SelectTrigger id="filter-status" className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {EVENT_STATUSES.map(s => <SelectItem key={s} value={s}>{capitalize(s)}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Button
          type="button"
          variant="ghost"
          onClick={() => onChange(EMPTY_FILTERS)}
          disabled={!hasFilters(values)}
          className="min-h-11 justify-self-start"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          Clear filters
        </Button>
      </div>
    </fieldset>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
