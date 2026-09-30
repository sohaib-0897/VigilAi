import type { Camera } from '@/lib/types';

export { clock, errorMessage, humanize } from '@/components/console/format';

export const SOURCE_LABELS: Record<string, string> = {
  local_video: 'Video file',
  rtsp: 'RTSP stream',
  webcam: 'Webcam',
};

export const DIRECTION_LABELS: Record<string, string> = {
  both: 'Both directions',
  a_to_b: 'A → B only',
  b_to_a: 'B → A only',
};

export const sourceLabel = (type: string) => SOURCE_LABELS[type] ?? type.replace(/_/g, ' ');

/**
 * The API already redacts credentials (`rtsp://[configured]`, `:****@`). For
 * uploaded files only the server-generated file name is useful to an operator.
 */
export function sourceSummary(camera: Pick<Camera, 'source_type' | 'source_uri'>): string {
  if (!camera.source_uri) return camera.source_type === 'local_video' ? 'No video uploaded' : 'Not configured';
  if (camera.source_type === 'local_video') return camera.source_uri.split(/[\\/]/).pop() || camera.source_uri;
  if (camera.source_type === 'webcam') return `Device ${camera.source_uri}`;
  return camera.source_uri;
}

export const frameSize = (camera: Pick<Camera, 'width' | 'height'>) =>
  camera.width && camera.height ? { width: camera.width, height: camera.height } : null;
