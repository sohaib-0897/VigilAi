'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { AnalyticsRule, VirtualLine, Zone } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ActionAlert } from '@/components/console/feedback';
import { capitalize } from '@/components/console/format';
import { PPE_ITEMS, RULE_TYPES, SEVERITIES, ruleType } from '@/components/console/vocabulary';

/** `NONE` stands for "no zone" in the optional-zone Select (Radix cannot hold ''). */
const NONE = 'none';
const DEFAULT_CONFIRMATION_S = 2;

export type RulePayload = Pick<AnalyticsRule, 'name' | 'rule_type' | 'severity' | 'cooldown_seconds'> & {
  zone_id: string | null;
  line_id: string | null;
  threshold_value: number | null;
  object_classes: string[] | null;
  configuration: Record<string, unknown> | null;
};

interface RuleFormProps {
  cameraId: string;
  zones: Zone[];
  lines: VirtualLine[];
  /** Classes the camera's detector can output; `null` when they could not be loaded. */
  classes: string[] | null;
  initial?: AnalyticsRule;
  submitLabel: string;
  pendingLabel: string;
  onSubmit: (payload: RulePayload) => Promise<void>;
  onCancel: () => void;
}

type Errors = Partial<Record<'name' | 'zone' | 'line' | 'threshold' | 'classes' | 'ppe' | 'confirmation' | 'cooldown', string>>;

const FIELD_IDS: Record<keyof Errors, string> = {
  name: 'rule-name',
  zone: 'rule-zone',
  line: 'rule-line',
  threshold: 'rule-threshold',
  classes: 'rule-classes',
  ppe: 'rule-ppe',
  confirmation: 'rule-confirmation',
  cooldown: 'rule-cooldown',
};

const positive = (raw: string) => {
  const n = Number(raw);
  return raw.trim() !== '' && Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * Create or edit a rule. Required fields follow the rule type exactly as
 * `services/rule.py::_validate` does, so a valid form is a valid request.
 */
export function RuleForm({ cameraId, zones, lines, classes, initial, submitLabel, pendingLabel, onSubmit, onCancel }: RuleFormProps) {
  const initialPpe = initial?.configuration?.required_ppe;
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState(initial?.rule_type ?? 'zone_entry');
  const [severity, setSeverity] = useState(initial?.severity ?? 'medium');
  const [zone, setZone] = useState(initial?.zone_id ?? '');
  const [line, setLine] = useState(initial?.line_id ?? '');
  const [threshold, setThreshold] = useState(initial?.threshold_value != null && initial.rule_type !== 'ppe_violation' ? String(initial.threshold_value) : '');
  const [cooldown, setCooldown] = useState(String(initial?.cooldown_seconds ?? 30));
  const [selectedClasses, setSelectedClasses] = useState<string[]>(
    initial?.rule_type === 'ppe_violation' ? [] : initial?.object_classes ?? [],
  );
  const [classText, setClassText] = useState((initial?.object_classes ?? []).join(', '));
  const [ppe, setPpe] = useState<string[]>(Array.isArray(initialPpe) ? initialPpe : ['helmet', 'vest']);
  const [confirmation, setConfirmation] = useState(String(
    initial?.configuration?.confirmation_duration_seconds ?? initial?.threshold_value ?? DEFAULT_CONFIRMATION_S,
  ));
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const focusSummary = useRef(false);

  const info = ruleType(type) ?? RULE_TYPES[0];
  const isPpe = type === 'ppe_violation';
  // Occupancy counts every track in the zone and PPE always evaluates people, so
  // neither uses a class filter (cv/rules/engine.py, cv/ppe/analyzer.py).
  const usesClasses = !isPpe && type !== 'occupancy_threshold';
  const classesRequired = type === 'class_presence';
  const typedClasses = useMemo(() => classText.split(',').map(s => s.trim()).filter(Boolean), [classText]);
  const chosenClasses = classes ? selectedClasses : typedClasses;
  const errorCount = Object.keys(errors).length;

  // Keep the stored selection meaningful if the type changes geometry kind.
  useEffect(() => {
    if (info.geometry === 'line') setZone('');
    else setLine('');
  }, [info.geometry]);

  // Move focus to the summary after a failed submit only, never while fields are being fixed.
  useEffect(() => {
    if (focusSummary.current && errorCount > 0) summaryRef.current?.focus();
    focusSummary.current = false;
  }, [errors, errorCount]);

  const validate = (): Errors => {
    const e: Errors = {};
    if (!name.trim()) e.name = 'Enter a rule name.';
    if (info.geometry === 'zone' && !zone) e.zone = zones.length ? 'Choose the zone this rule watches.' : 'Draw a zone on this camera first.';
    if (info.geometry === 'line' && !line) e.line = lines.length ? 'Choose the line this rule watches.' : 'Draw a line on this camera first.';
    if (info.threshold && positive(threshold) === null) e.threshold = `${info.threshold.label} must be a number greater than 0.`;
    if (classesRequired && chosenClasses.length === 0) e.classes = 'Choose at least one class.';
    if (isPpe && ppe.length === 0) e.ppe = 'Choose at least one required item.';
    if (isPpe && positive(confirmation) === null) e.confirmation = 'The confirmation window must be greater than 0 seconds.';
    const cd = Number(cooldown);
    if (cooldown.trim() === '' || !Number.isInteger(cd) || cd < 0) e.cooldown = 'Cooldown must be a whole number of seconds, 0 or more.';
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate();
    focusSummary.current = true;
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSubmitError(null);
    setSubmitting(true);
    const confirmationS = positive(confirmation) ?? DEFAULT_CONFIRMATION_S;
    try {
      await onSubmit({
        name: name.trim(),
        rule_type: type,
        severity,
        cooldown_seconds: Number(cooldown),
        zone_id: info.geometry === 'line' ? null : zone || null,
        line_id: info.geometry === 'line' ? line || null : null,
        threshold_value: info.threshold ? positive(threshold) : isPpe ? confirmationS : null,
        object_classes: isPpe ? ['person'] : usesClasses && chosenClasses.length ? chosenClasses : null,
        configuration: isPpe ? { required_ppe: ppe, confirmation_duration_seconds: confirmationS } : null,
      });
    } catch (cause) {
      setSubmitError(cause instanceof Error && cause.message ? cause.message : 'The rule could not be saved.');
    } finally {
      setSubmitting(false);
    }
  };

  const invalid = (key: keyof Errors) => (errors[key] ? { 'aria-invalid': true as const } : {});
  const describe = (key: keyof Errors, ...hints: string[]) =>
    [...hints, errors[key] ? `${FIELD_IDS[key]}-error` : ''].filter(Boolean).join(' ') || undefined;
  const clear = (key: keyof Errors) => {
    if (!errors[key]) return;
    setErrors(current => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const toggle = (list: string[], item: string) => (list.includes(item) ? list.filter(i => i !== item) : [...list, item]);

  return (
    <form onSubmit={handleSubmit} method="post" noValidate aria-busy={submitting} className="space-y-5">
      {errorCount > 0 && (
        <div ref={summaryRef} tabIndex={-1} role="alert" aria-labelledby="rule-error-title" className="space-y-2 border border-danger bg-danger/10 p-3 focus-visible:outline-offset-2">
          <p id="rule-error-title" className="text-body-sm font-semibold">
            {errorCount === 1 ? '1 field needs attention' : `${errorCount} fields need attention`}
          </p>
          <ul className="list-disc space-y-1 pl-5 text-body-sm">
            {(Object.keys(errors) as (keyof Errors)[]).map(key => (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => document.getElementById(FIELD_IDS[key])?.focus()}
                  className="text-left underline decoration-1 underline-offset-4 hover:decoration-2"
                >
                  {errors[key]}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="rule-name">Name</Label>
        <Input
          id="rule-name"
          name="name"
          value={name}
          onChange={e => { setName(e.target.value); clear('name'); }}
          maxLength={255}
          autoComplete="off"
          aria-describedby={describe('name')}
          {...invalid('name')}
          className="h-11"
        />
        <FieldError id="rule-name-error" message={errors.name} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="rule-type">Rule type</Label>
          <Select value={type} onValueChange={v => { if (v) { setType(v); setErrors({}); } }}>
            <SelectTrigger id="rule-type" aria-describedby="rule-type-hint" className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              {RULE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="rule-severity">Severity</Label>
          <Select value={severity} onValueChange={v => v && setSeverity(v)}>
            <SelectTrigger id="rule-severity" className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SEVERITIES.map(s => <SelectItem key={s} value={s}>{capitalize(s)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <p id="rule-type-hint" className="text-body-sm text-muted-foreground sm:col-span-2">Fires when: {info.fires}</p>
      </div>

      {info.geometry !== 'line' && (
        <div className="space-y-2">
          <Label htmlFor="rule-zone">
            Zone {info.geometry === 'optional-zone' && <span className="text-muted-foreground">(optional)</span>}
          </Label>
          <Select
            value={info.geometry === 'optional-zone' ? zone || NONE : zone}
            onValueChange={v => { if (v) { setZone(v === NONE ? '' : v); clear('zone'); } }}
            disabled={zones.length === 0 && info.geometry === 'zone'}
          >
            <SelectTrigger id="rule-zone" aria-describedby={describe('zone', 'rule-zone-hint')} {...invalid('zone')} className="h-11">
              <SelectValue placeholder={zones.length ? 'Choose a zone' : 'No zones on this camera'} />
            </SelectTrigger>
            <SelectContent>
              {info.geometry === 'optional-zone' && <SelectItem value={NONE}>Whole frame</SelectItem>}
              {zones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <p id="rule-zone-hint" className="text-body-sm text-muted-foreground">
            {zones.length === 0
              ? <>This camera has no zones. <GeometryLink cameraId={cameraId} /></>
              : info.geometry === 'optional-zone' ? 'Leave as whole frame to watch the entire image.' : 'A track is inside when its box centre is inside the polygon.'}
          </p>
          <FieldError id="rule-zone-error" message={errors.zone} />
        </div>
      )}

      {info.geometry === 'line' && (
        <div className="space-y-2">
          <Label htmlFor="rule-line">Line</Label>
          <Select value={line} onValueChange={v => { if (v) { setLine(v); clear('line'); } }} disabled={lines.length === 0}>
            <SelectTrigger id="rule-line" aria-describedby={describe('line', 'rule-line-hint')} {...invalid('line')} className="h-11">
              <SelectValue placeholder={lines.length ? 'Choose a line' : 'No lines on this camera'} />
            </SelectTrigger>
            <SelectContent>
              {lines.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <p id="rule-line-hint" className="text-body-sm text-muted-foreground">
            {lines.length === 0
              ? <>This camera has no lines. <GeometryLink cameraId={cameraId} /></>
              : 'The counted direction is set on the line itself.'}
          </p>
          <FieldError id="rule-line-error" message={errors.line} />
        </div>
      )}

      {info.threshold && (
        <div className="space-y-2">
          <Label htmlFor="rule-threshold">{info.threshold.label} ({info.threshold.unit})</Label>
          <Input
            id="rule-threshold"
            name="threshold_value"
            type="number"
            inputMode="decimal"
            min={0}
            step={info.threshold.step}
            value={threshold}
            onChange={e => { setThreshold(e.target.value); clear('threshold'); }}
            aria-describedby={describe('threshold', 'rule-threshold-hint')}
            {...invalid('threshold')}
            className="h-11 w-40 font-mono"
          />
          <p id="rule-threshold-hint" className="text-body-sm text-muted-foreground">{info.threshold.hint}</p>
          <FieldError id="rule-threshold-error" message={errors.threshold} />
        </div>
      )}

      {isPpe && (
        <>
          <fieldset id="rule-ppe" tabIndex={-1} aria-describedby={describe('ppe')} className="space-y-2 focus-visible:outline-offset-4">
            <legend className="vg-label mb-2 text-foreground">Required equipment</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {PPE_ITEMS.map(item => (
                <CheckRow
                  key={item.value}
                  id={`rule-ppe-${item.value}`}
                  label={item.label}
                  checked={ppe.includes(item.value)}
                  onChange={() => { setPpe(p => toggle(p, item.value)); clear('ppe'); }}
                />
              ))}
            </div>
            <FieldError id="rule-ppe-error" message={errors.ppe} />
          </fieldset>
          <div className="space-y-2">
            <Label htmlFor="rule-confirmation">Confirmation window (s)</Label>
            <Input
              id="rule-confirmation"
              name="confirmation_duration_seconds"
              type="number"
              inputMode="decimal"
              min={0}
              step={0.5}
              value={confirmation}
              onChange={e => { setConfirmation(e.target.value); clear('confirmation'); }}
              aria-describedby={describe('confirmation', 'rule-confirmation-hint')}
              {...invalid('confirmation')}
              className="h-11 w-40 font-mono"
            />
            <p id="rule-confirmation-hint" className="text-body-sm text-muted-foreground">
              A person must be missing an item for this long before the event fires, so single-frame misses are ignored.
            </p>
            <FieldError id="rule-confirmation-error" message={errors.confirmation} />
          </div>
        </>
      )}

      {usesClasses && (
        classes ? (
          <fieldset id="rule-classes" tabIndex={-1} aria-describedby={describe('classes', 'rule-classes-hint')} className="space-y-2 focus-visible:outline-offset-4">
            <legend className="vg-label mb-2 text-foreground">
              Object classes {!classesRequired && <span className="text-muted-foreground">(optional)</span>}
            </legend>
            <p id="rule-classes-hint" className="text-body-sm text-muted-foreground">
              {classesRequired ? 'The rule fires when any chosen class is tracked.' : 'Leave all unchecked to match every class the detector tracks.'}
              {selectedClasses.length > 0 && ` ${selectedClasses.length} selected.`}
            </p>
            <div className="grid max-h-48 grid-cols-2 gap-1 overflow-y-auto border border-border p-2 sm:grid-cols-3">
              {classes.map(c => (
                <CheckRow
                  key={c}
                  id={`rule-class-${c.replace(/\W+/g, '-')}`}
                  label={c}
                  compact
                  checked={selectedClasses.includes(c)}
                  onChange={() => { setSelectedClasses(s => toggle(s, c)); clear('classes'); }}
                />
              ))}
            </div>
            <FieldError id="rule-classes-error" message={errors.classes} />
          </fieldset>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="rule-classes">
              Object classes {!classesRequired && <span className="text-muted-foreground">(optional)</span>}
            </Label>
            <Input
              id="rule-classes"
              name="object_classes"
              value={classText}
              onChange={e => { setClassText(e.target.value); clear('classes'); }}
              autoComplete="off"
              spellCheck={false}
              aria-describedby={describe('classes', 'rule-classes-hint')}
              {...invalid('classes')}
              className="h-11 font-mono"
            />
            <p id="rule-classes-hint" className="text-body-sm text-muted-foreground">
              Comma-separated class names, e.g. <span className="font-mono">person, car</span>. The detector’s class list could not be loaded, so names are not checked here.
            </p>
            <FieldError id="rule-classes-error" message={errors.classes} />
          </div>
        )
      )}

      <div className="space-y-2">
        <Label htmlFor="rule-cooldown">Cooldown (s)</Label>
        <Input
          id="rule-cooldown"
          name="cooldown_seconds"
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={cooldown}
          onChange={e => { setCooldown(e.target.value); clear('cooldown'); }}
          aria-describedby={describe('cooldown', 'rule-cooldown-hint')}
          {...invalid('cooldown')}
          className="h-11 w-40 font-mono"
        />
        <p id="rule-cooldown-hint" className="text-body-sm text-muted-foreground">
          After an event, the same rule, track and zone or line cannot fire again for this long. An event that is still active never fires twice.
        </p>
        <FieldError id="rule-cooldown-error" message={errors.cooldown} />
      </div>

      <ActionAlert message={submitError} />

      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting} className="min-h-11 sm:min-h-10">Cancel</Button>
        <Button type="submit" disabled={submitting} className="min-h-11 sm:min-h-10">{submitting ? pendingLabel : submitLabel}</Button>
      </div>
    </form>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} className="text-body-sm font-medium text-danger-ink">{message}</p>;
}

function CheckRow({ id, label, checked, onChange, compact = false }: { id: string; label: string; checked: boolean; onChange: () => void; compact?: boolean }) {
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex min-h-11 cursor-pointer items-center gap-2.5 border px-3 text-body-sm transition-colors duration-micro',
        compact ? 'min-h-9 border-transparent px-2 hover:bg-muted' : 'border-border hover:border-foreground',
        checked && !compact && 'border-border-strong bg-signal/25',
      )}
    >
      <input id={id} type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 shrink-0 accent-foreground" />
      <span className="min-w-0 truncate">{label}</span>
    </label>
  );
}

function GeometryLink({ cameraId }: { cameraId: string }) {
  return (
    <Link href={`/cameras/${cameraId}/configure`} className="underline decoration-1 underline-offset-4 hover:decoration-2">
      Draw zones and lines
    </Link>
  );
}
