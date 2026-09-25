'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Camera } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CameraCard } from '@/components/cameras/camera-card';
import { SectionHeader } from '@/components/ui/section-header';
import { Video, Plus, Upload, Radio, AlertTriangle, Play } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function CamerasPage() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    source_type: 'local_video',
    source_uri: ''
  });
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [openingDemo, setOpeningDemo] = useState(false);
  const router = useRouter();

  const fetchCameras = () => {
    setLoading(true);
    api.getCameras()
      .then(res => { setCameras(res.items); setError(null); })
      .catch(err => setError(err instanceof Error ? err.message : 'Could not load cameras'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCameras();
  }, []);

  const handleToggleAnalytics = async (camera: Camera) => {
    try {
      if (camera.analytics_enabled) {
        await api.stopCamera(camera.id);
      } else {
        await api.startCamera(camera.id);
      }
      fetchCameras();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not change analytics state');
    }
  };

  const handleUseDemo = async () => {
    setError(null);
    setOpeningDemo(true);
    try {
      const camera = await api.createDemoCamera();
      router.push(`/cameras/${camera.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not open the demo video');
      setOpeningDemo(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.source_type === 'local_video' && !videoFile) {
      setError('Choose a video file before creating this camera.');
      return;
    }
    setError(null);
    setSubmitting(true);
    let createdCameraId: string | null = null;
    try {
      const newCam = await api.createCamera(formData);
      createdCameraId = newCam.id;
      if (formData.source_type === 'local_video' && videoFile) {
        await api.uploadVideo(newCam.id, videoFile);
      }
      setOpen(false);
      setFormData({ name: '', description: '', source_type: 'local_video', source_uri: '' });
      setVideoFile(null);
      fetchCameras();
    } catch (error) {
      if (createdCameraId && formData.source_type === 'local_video') {
        try {
          await api.deleteCamera(createdCameraId);
        } catch {
          setError('Video upload failed and the incomplete camera could not be removed. Delete it from the camera list.');
          fetchCameras();
          return;
        }
      }
      setError(error instanceof Error ? error.message : 'Could not create camera');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        tag="SURVEILLANCE SENSORS"
        title="Camera Nodes"
        description="Configure video ingress sources, monitor live FPS telemetry, and toggle inference pipeline processing."
        action={
          <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="violet" size="default" className="font-black text-xs" onClick={handleUseDemo} disabled={openingDemo}>
            <Play className="h-4 w-4 mr-1.5" aria-hidden="true" />
            {openingDemo ? 'Opening demo…' : 'Use Demo Video'}
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary" size="default" className="font-black text-xs">
                <Plus className="h-4 w-4 mr-1.5" strokeWidth={3} />
                Provision Camera Node
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <div className="flex items-center space-x-2 text-black">
                  <Video className="h-5 w-5" strokeWidth={2.5} />
                  <DialogTitle>Provision Camera Node</DialogTitle>
                </div>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                <div className="space-y-1">
                  <Label className="text-xs font-black uppercase tracking-wider text-black">
                    Camera Node Identifier
                  </Label>
                  <Input
                    placeholder="e.g. Loading Dock North"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="font-mono text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-black uppercase tracking-wider text-black">
                    Description / Location
                  </Label>
                  <Input
                    placeholder="e.g. Primary vehicle ingress bay"
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-black uppercase tracking-wider text-black">
                    Video Stream Source Type
                  </Label>
                  <Select
                    value={formData.source_type}
                    onValueChange={val => setFormData({ ...formData, source_type: val })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="local_video">Uploaded Video File</SelectItem>
                      <SelectItem value="rtsp">RTSP Surveillance Stream</SelectItem>
                      <SelectItem value="webcam">Local Host USB Webcam</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.source_type === 'rtsp' && (
                  <div className="space-y-1">
                    <Label className="text-xs font-black uppercase tracking-wider text-black">
                      RTSP URI (Encrypted at rest)
                    </Label>
                    <Input
                      placeholder="rtsp://user:pass@192.168.1.50:554/live"
                      value={formData.source_uri}
                      onChange={e => setFormData({ ...formData, source_uri: e.target.value })}
                      required
                      className="font-mono text-xs"
                    />
                  </div>
                )}

                {formData.source_type === 'webcam' && (
                  <div className="space-y-1">
                    <Label className="text-xs font-black uppercase tracking-wider text-black">
                      Device Index
                    </Label>
                    <Input
                      placeholder="0"
                      value={formData.source_uri}
                      onChange={e => setFormData({ ...formData, source_uri: e.target.value })}
                      className="font-mono text-sm"
                    />
                  </div>
                )}

                {formData.source_type === 'local_video' && (
                  <div className="space-y-1.5 border-2 border-black bg-neo-yellow/20 p-3">
                    <Label className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                      <Upload className="h-3.5 w-3.5" strokeWidth={2.5} />
                      Attach Local Video File
                    </Label>
                    <Input
                      type="file"
                      accept=".mp4,.avi,.mov,.mkv"
                      onChange={e => setVideoFile(e.target.files?.[0] || null)}
                      className="bg-white file:font-black file:text-xs file:uppercase file:border-r file:border-black file:mr-3"
                    />
                    <p className="text-[10px] font-mono text-black/70">
                      Supports MP4, AVI, MOV, MKV. Video will be processed sequentially by the inference worker.
                    </p>
                  </div>
                )}

                <div className="pt-2 flex justify-end gap-2 border-t-2 border-black">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                    className="text-xs font-black"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="text-xs font-black bg-black text-white hover:bg-neo-yellow hover:text-black"
                  >
                    {submitting ? 'Registering Node...' : 'Register Camera Node'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        }
      />

      {error && <div role="alert" className="border-2 border-red-700 bg-red-50 p-3 text-sm text-red-900">{error}</div>}

      {loading ? (
        <div className="flex h-48 items-center justify-center border-4 border-black bg-white shadow-neo-sm">
          <div className="flex items-center space-x-2 font-mono text-xs font-black uppercase">
            <span className="h-3 w-3 bg-black animate-ping" />
            <span>Scanning Video Nodes...</span>
          </div>
        </div>
      ) : cameras.length === 0 ? (
        <div className="border-4 border-black bg-white p-12 text-center shadow-neo-md space-y-3">
          <div className="inline-flex h-12 w-12 items-center justify-center border-2 border-black bg-neo-yellow text-black mb-2">
            <Radio className="h-6 w-6" strokeWidth={2.5} />
          </div>
          <h2 className="text-xl font-black uppercase tracking-tight text-black">
            Zero Active Surveillance Nodes
          </h2>
          <p className="text-xs font-medium text-black/70 max-w-md mx-auto">
            No cameras are currently provisioned. Register a local video file, CCTV RTSP stream, or host webcam to initialize analytics.
          </p>
          <Button
            variant="secondary"
            onClick={() => setOpen(true)}
            className="text-xs font-black uppercase tracking-wider mt-2"
          >
            Provision First Camera
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cameras.map(camera => (
            <CameraCard
              key={camera.id}
              camera={camera}
              onToggleAnalytics={handleToggleAnalytics}
            />
          ))}
        </div>
      )}
    </div>
  );
}
