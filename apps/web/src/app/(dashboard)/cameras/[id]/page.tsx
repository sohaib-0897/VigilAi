'use client';
import { useEffect, useState, use } from 'react';
import { api } from '@/lib/api';
import { Camera } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useWebSocket } from '@/lib/hooks';

export default function CameraDetail({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const { id } = unwrappedParams;
  const [camera, setCamera] = useState<Camera | null>(null);
  const [error, setError] = useState('');
  const url = typeof window === 'undefined' ? '' : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/v1/ws/cameras/${id}/status`;
  const {lastMessage} = useWebSocket(url);
  useEffect(() => {
    if (lastMessage) {
      setCamera(c => c ? {...c, status: lastMessage.status, fps: lastMessage.fps} : c);
      if (lastMessage.status !== 'online') api.getCamera(id).then(setCamera).catch(e => setError(e.message));
    }
  }, [lastMessage, id]);

  useEffect(() => {
    api.getCamera(id).then(setCamera).catch(e => setError(e.message));
  }, [id]);

  if (!camera) return <div>{error || 'Loading...'}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{camera.name}</h1>
          <div className="flex items-center space-x-2 mt-2">
            <Badge>{camera.status}</Badge>
            <span className="text-sm text-muted-foreground">{camera.source_uri}</span>
          </div>
        </div>
        <div className="space-x-2">
          <Link href={`/cameras/${id}/configure`}><Button variant="outline">Configure Regions</Button></Link>
          <Button variant={camera.analytics_enabled ? "destructive" : "default"} onClick={() => {
            if (camera.analytics_enabled) api.stopCamera(id).then(() => api.getCamera(id).then(setCamera));
            else api.startCamera(id).then(() => api.getCamera(id).then(setCamera));
          }}>
            {camera.analytics_enabled ? 'Stop Analytics' : 'Start Analytics'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader><CardTitle>Live Feed</CardTitle></CardHeader>
          <CardContent>
            <div className="aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center text-white relative">
              {camera.status === 'online' ? (
                <img src={`/api/v1/cameras/${id}/stream`} alt="Live stream" className="w-full h-full object-contain" />
              ) : (
                <span>Camera offline</span>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardHeader><CardTitle>Pipeline Stats</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">FPS</span>
              <span className="font-medium">{camera.fps ?? 'NOT_MEASURED'}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Resolution</span>
              <span className="font-medium">{camera.width}x{camera.height}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
