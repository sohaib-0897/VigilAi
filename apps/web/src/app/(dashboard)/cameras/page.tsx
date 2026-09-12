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
import { Loader2 } from 'lucide-react';

export default function CamerasPage() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    source_type: 'local_video',
    source_uri: ''
  });

  const fetchCameras = () => {
    setLoading(true);
    api.getCameras().then(res => setCameras(res.items)).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCameras();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.createCamera(formData);
      setOpen(false);
      setFormData({ name: '', description: '', source_type: 'local_video', source_uri: '' });
      fetchCameras();
    } catch (error) {
      console.error(error);
      // Ideally show toast error here
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && cameras.length === 0) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Cameras</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Add Camera</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Camera</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="source_type">Source Type</Label>
                <Select
                  value={formData.source_type}
                  onValueChange={(val) => setFormData({ ...formData, source_type: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local_video">Local Video</SelectItem>
                    <SelectItem value="webcam">Webcam</SelectItem>
                    <SelectItem value="rtsp">RTSP Stream</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.source_type === 'rtsp' && (
                <div className="space-y-2">
                  <Label htmlFor="source_uri">Source URI</Label>
                  <Input
                    id="source_uri"
                    value={formData.source_uri}
                    onChange={(e) => setFormData({ ...formData, source_uri: e.target.value })}
                    required
                  />
                </div>
              )}
              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Camera
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {cameras.length === 0 ? (
        <div className="text-center py-12 border rounded-lg border-dashed">
          <p className="text-muted-foreground">No cameras yet. Add your first camera.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cameras.map(cam => (
            <CameraCard key={cam.id} camera={cam} />
          ))}
        </div>
      )}
    </div>
  );
}
