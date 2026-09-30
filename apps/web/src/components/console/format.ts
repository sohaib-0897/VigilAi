/** Formatting shared by the console pages. All times are shown in UTC. */

export const humanize = (value: string) => value.replace(/_/g, ' ');

export const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** `HH:MM:SS UTC` */
export const clock = (date: Date) => date.toISOString().substring(11, 19) + ' UTC';

/** `YYYY-MM-DD HH:MM:SS UTC` from an ISO timestamp. */
export const utcStamp = (iso: string) => new Date(iso).toISOString().replace('T', ' ').substring(0, 19) + ' UTC';

export const shortId = (id: string) => id.substring(0, 8);

export const errorMessage = (cause: unknown, fallback: string) =>
  cause instanceof Error && cause.message ? cause.message : fallback;

/** Human duration from seconds: `42.0 s`, `3 min 05 s`, `1 h 02 min`. */
export function duration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const whole = Math.round(seconds);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = whole % 60;
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min ${String(s).padStart(2, '0')} s`;
}
