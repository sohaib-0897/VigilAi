/**
 * Single source of truth for mapping backend states onto the operational
 * palette. Status colour is always paired with a text label — never colour alone.
 */

export type Tone = 'active' | 'success' | 'warning' | 'danger' | 'track' | 'neutral' | 'inactive';

const STATUS_TONES: Record<string, Tone> = {
  online: 'success',
  healthy: 'success',
  running: 'success',
  ok: 'success',
  analyzing: 'active',
  processing: 'active',
  connecting: 'warning',
  degraded: 'warning',
  reconnecting: 'warning',
  error: 'danger',
  down: 'danger',
  critical: 'danger',
  failed: 'danger',
  offline: 'inactive',
  stopped: 'inactive',
  // Event lifecycle (EventStatus)
  active: 'active',
  acknowledged: 'track',
  resolved: 'success',
  dismissed: 'inactive',
  // Rule state
  enabled: 'success',
  disabled: 'inactive',
};

const SEVERITY_TONES: Record<string, Tone> = {
  critical: 'danger',
  high: 'warning',
  medium: 'active',
  low: 'track',
  info: 'track',
};

export const statusTone = (status?: string | null): Tone =>
  STATUS_TONES[(status ?? '').toLowerCase()] ?? 'neutral';

export const severityTone = (severity?: string | null): Tone =>
  SEVERITY_TONES[(severity ?? '').toLowerCase()] ?? 'track';

/** Solid chip fills (text meets 4.5:1 on each fill). */
export const toneFill: Record<Tone, string> = {
  active: 'bg-signal text-signal-foreground border-border-strong',
  success: 'bg-success text-success-foreground border-border-strong',
  warning: 'bg-warning text-warning-foreground border-border-strong',
  danger: 'bg-danger text-danger-foreground border-border-strong',
  track: 'bg-track text-track-foreground border-border-strong',
  neutral: 'bg-surface text-foreground border-border-strong',
  inactive: 'bg-muted text-muted-foreground border-border',
};

/** Indicator dot colours. */
export const toneDot: Record<Tone, string> = {
  active: 'bg-signal-ink',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  track: 'bg-track-ink',
  neutral: 'bg-foreground',
  inactive: 'bg-inactive',
};

/** Tones whose state is live and may animate. */
export const isLiveTone = (tone: Tone) => tone === 'success' || tone === 'active';
