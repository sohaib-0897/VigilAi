'use client';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ActionAlert } from '@/components/console/feedback';
import { errorMessage } from './camera-format';

type SourceType = 'local_video' | 'rtsp' | 'webcam';

const EMPTY = { name: '', description: '', source_type: 'local_video' as SourceType, source_uri: '' };
const VIDEO_ACCEPT = '.mp4,.avi,.mov,.mkv';

/**
 * Create a camera. For uploaded video the camera is created first and the file
 * is then uploaded; if the upload fails the half-created camera is deleted.
 */
export function CreateCameraDialog({ open, onOpenChange, onCreated }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState(EMPTY);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setForm(EMPTY);
    setVideoFile(null);
    setError(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (submitting) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const setSourceType = (value: string) => {
    const source_type = value as SourceType;
    // A webcam needs a device index; 0 is the host's first device.
    setForm(f => ({ ...f, source_type, source_uri: source_type === 'webcam' ? '0' : '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.source_type === 'local_video' && !videoFile) {
      setError('Choose a video file before creating this camera.');
      return;
    }
    setError(null);
    setSubmitting(true);
    let createdId: string | null = null;
    try {
      const created = await api.createCamera(form);
      createdId = created.id;
      if (form.source_type === 'local_video' && videoFile) {
        await api.uploadVideo(created.id, videoFile);
      }
      reset();
      onOpenChange(false);
      onCreated();
    } catch (cause) {
      if (createdId && form.source_type === 'local_video') {
        try {
          await api.deleteCamera(createdId);
        } catch {
          setError('The video upload failed and the incomplete camera could not be removed. Delete it from the camera list.');
          onCreated();
          return;
        }
      }
      setError(errorMessage(cause, 'The camera could not be created.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="min-h-11 sm:min-h-10">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add camera
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add camera</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} method="post" aria-busy={submitting} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="camera-name">Name</Label>
            <Input
              id="camera-name"
              name="name"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              required
              maxLength={255}
              autoComplete="off"
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="camera-description">Description <span className="text-muted-foreground">(optional)</span></Label>
            <Input
              id="camera-description"
              name="description"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              autoComplete="off"
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="camera-source-type">Source</Label>
            <Select value={form.source_type} onValueChange={v => v && setSourceType(v)}>
              <SelectTrigger id="camera-source-type" className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="local_video">Video file (upload)</SelectItem>
                <SelectItem value="rtsp">RTSP stream</SelectItem>
                <SelectItem value="webcam">Webcam on the worker host</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.source_type === 'rtsp' && (
            <div className="space-y-2">
              <Label htmlFor="camera-rtsp">RTSP URL</Label>
              <Input
                id="camera-rtsp"
                name="source_uri"
                inputMode="url"
                spellCheck={false}
                autoComplete="off"
                value={form.source_uri}
                onChange={e => setForm({ ...form, source_uri: e.target.value })}
                required
                aria-describedby="camera-rtsp-hint"
                className="h-11 font-mono text-body-sm"
              />
              <p id="camera-rtsp-hint" className="text-body-sm text-muted-foreground">
                For example <span className="font-mono">rtsp://user:password@host:554/path</span>. Credentials are encrypted at rest and never shown again.
              </p>
            </div>
          )}

          {form.source_type === 'webcam' && (
            <div className="space-y-2">
              <Label htmlFor="camera-device">Device index</Label>
              <Input
                id="camera-device"
                name="source_uri"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={form.source_uri}
                onChange={e => setForm({ ...form, source_uri: e.target.value })}
                required
                aria-describedby="camera-device-hint"
                className="h-11 font-mono"
              />
              <p id="camera-device-hint" className="text-body-sm text-muted-foreground">
                The video device on the machine running the worker. 0 is the first device.
              </p>
            </div>
          )}

          {form.source_type === 'local_video' && (
            <div className="space-y-2">
              <Label htmlFor="camera-video">Video file</Label>
              <Input
                id="camera-video"
                name="file"
                type="file"
                accept={VIDEO_ACCEPT}
                onChange={e => setVideoFile(e.target.files?.[0] ?? null)}
                aria-describedby="camera-video-hint"
                className="h-11 cursor-pointer py-2 file:mr-3 file:cursor-pointer file:border-r file:border-border-strong file:pr-3 file:font-sans file:text-label file:font-semibold file:uppercase file:tracking-[0.08em]"
              />
              <p id="camera-video-hint" className="text-body-sm text-muted-foreground">
                MP4, AVI, MOV or MKV. The server checks that the file decodes and enforces its upload size limit.
              </p>
            </div>
          )}

          <ActionAlert message={error} />

          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting} className="min-h-11 sm:min-h-10">
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="min-h-11 sm:min-h-10">
              {submitting ? (form.source_type === 'local_video' ? 'Uploading…' : 'Creating…') : 'Create camera'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
