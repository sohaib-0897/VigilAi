import type { Event } from '@/lib/types';
import { Panel } from '@/components/primitives/panel';
import { DIRECTION_LABELS } from '@/components/cameras/camera-format';
import { duration } from '@/components/console/format';

type Fact = { term: string; value: string };

const list = (value: unknown) => (Array.isArray(value) && value.length > 0 ? value.map(String).join(', ') : null);
const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/**
 * The values the worker recorded when the rule fired (`RuleMatch.details`, see
 * cv/rules/engine.py and cv/ppe/models.py). Only keys that are present are shown.
 */
function facts(event: Event): Fact[] {
  const m = (event.metadata ?? {}) as Record<string, unknown>;
  const out: Fact[] = [];
  const dwell = num(m.dwell_time);
  if (dwell !== null) out.push({ term: event.event_type === 'zone_exit' ? 'Time in zone' : 'Dwell time', value: duration(dwell) });
  if (typeof m.direction === 'string') out.push({ term: 'Direction', value: DIRECTION_LABELS[m.direction] ?? m.direction });
  const occupancy = num(m.occupancy);
  if (occupancy !== null) out.push({ term: 'Occupancy', value: `${occupancy} tracked objects in zone` });
  const classes = list(m.classes);
  if (classes) out.push({ term: 'Classes in view', value: classes });
  const required = list(m.required_ppe);
  if (required) out.push({ term: 'Required PPE', value: required });
  const missing = list(m.missing_ppe);
  if (missing) out.push({ term: 'Missing PPE', value: missing });
  if (Array.isArray(m.observed_ppe)) out.push({ term: 'Observed PPE', value: list(m.observed_ppe) ?? 'None' });
  const window = num(m.confirmation_duration_ms);
  if (window !== null) out.push({ term: 'Confirmation window', value: duration(window / 1000) });
  if (typeof m.model_version === 'string') out.push({ term: 'PPE model', value: m.model_version });
  const box = m.person_bbox as Record<string, unknown> | undefined;
  if (box && [box.x1, box.y1, box.x2, box.y2].every(v => num(v) !== null)) {
    out.push({ term: 'Person box (px)', value: `x1 ${box.x1} · y1 ${box.y1} · x2 ${box.x2} · y2 ${box.y2}` });
  }
  return out;
}

export function TriggerDetails({ event }: { event: Event }) {
  const rows = facts(event);
  const hasMetadata = event.metadata && Object.keys(event.metadata).length > 0;

  return (
    <Panel labelId="trigger-heading" title="Trigger details">
      {rows.length > 0 ? (
        <dl className="grid gap-px bg-border sm:grid-cols-2">
          {rows.map(row => (
            <div key={row.term} className="space-y-1 bg-surface px-4 py-3">
              <dt className="vg-label text-muted-foreground">{row.term}</dt>
              <dd className="vg-telemetry break-words text-foreground">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="px-4 py-6 text-body-sm text-muted-foreground">
          {hasMetadata ? 'This event type records no summary values.' : 'No trigger metadata was recorded for this event.'}
        </p>
      )}
      {hasMetadata && (
        <details className="group border-t border-border">
          <summary className="vg-label flex min-h-11 cursor-pointer items-center px-4 text-foreground hover:bg-muted">
            Raw metadata (JSON)
          </summary>
          <pre className="vg-telemetry max-h-80 overflow-auto border-t border-border bg-muted/50 p-4 text-foreground">
            {JSON.stringify(event.metadata, null, 2)}
          </pre>
        </details>
      )}
    </Panel>
  );
}
