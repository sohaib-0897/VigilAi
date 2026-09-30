import type { TimeseriesBucket } from '@/lib/types';

export type BucketUnit = 'hour' | 'day';

export interface Bucket { start: number; count: number }

const floorUtc = (ms: number, unit: BucketUnit) => {
  const d = new Date(ms);
  if (unit === 'day') d.setUTCHours(0, 0, 0, 0);
  else d.setUTCMinutes(0, 0, 0);
  return d.getTime();
};

const step = (unit: BucketUnit) => (unit === 'day' ? 86_400_000 : 3_600_000);

/**
 * `/analytics/timeseries` returns Postgres `date_trunc` buckets and omits empty
 * ones. Rebuild the full range of UTC buckets between `start` and `end` so that
 * a bucket with no events is shown as 0 rather than missing. Counts are only
 * ever taken from the API response.
 */
export function fillBuckets(points: TimeseriesBucket[], start: Date, end: Date, unit: BucketUnit): Bucket[] {
  const counts = new Map<number, number>();
  for (const p of points) {
    // `str(datetime)` from the API: "2026-09-29 13:00:00+00:00".
    const ms = Date.parse(p.period.replace(' ', 'T'));
    if (Number.isNaN(ms)) continue;
    const key = floorUtc(ms, unit);
    counts.set(key, (counts.get(key) ?? 0) + p.count);
  }
  const buckets: Bucket[] = [];
  for (let t = floorUtc(start.getTime(), unit); t <= end.getTime(); t += step(unit)) {
    buckets.push({ start: t, count: counts.get(t) ?? 0 });
    counts.delete(t);
  }
  // A bucket outside the requested range would mean a time-zone mismatch; keep its events visible.
  counts.forEach((count, t) => buckets.push({ start: t, count }));
  return buckets.sort((a, b) => a.start - b.start);
}

export function bucketLabel(start: number, unit: BucketUnit, style: 'axis' | 'full' = 'full') {
  const iso = new Date(start).toISOString();
  const date = iso.substring(5, 10);
  if (unit === 'day') return style === 'axis' ? date : `${iso.substring(0, 10)} UTC`;
  const hour = iso.substring(11, 16);
  return style === 'axis' ? hour : `${iso.substring(0, 10)} ${hour} UTC`;
}
