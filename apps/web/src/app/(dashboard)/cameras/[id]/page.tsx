'use client';
import { useEffect, useState, useRef, use } from 'react';
import { api } from '@/lib/api';
import { Camera } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SectionHeader } from '@/components/ui/section-header';
import Link from 'next/link';
import { useWebSocket } from '@/lib/hooks';
import { Upload, Loader2, Play, Square, Sliders, Video, Activity, AlertTriangle, Pause, Maximize2 } from 'lucide-react';

export default function CameraDetail({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const { id } = unwrappedParams;
  const [camera, setCamera] = useState<Camera | null>(null);
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [isStreamPaused, setIsStreamPaused] = useState(false);
  const monitorRef = useRef<HTMLDivElement>(null);

  const url = typeof window === 'undefined' ? '' : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/v1/ws/cameras/${id}/status`;
  const { lastMessage } = useWebSocket(url);

  useEffect(() => {
    if (lastMessage) {
      setCamera(c => (c ? { ...c, status: lastMessage.status, fps: lastMessage.fps } : c));
      if (lastMessage.status !== 'online') {
        api.getCamera(id).then(setCamera).catch(e => setError(e.message));
      }
    }
  }, [lastMessage, id]);

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setUploadMsg('');
    setUploadError('');
    try {
      await api.uploadVideo(id, selectedFile);
      setUploadMsg('Video uploaded successfully. Source updated.');
      setSelectedFile(null);
      api.getCamera(id).then(setCamera);
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed. Ensure format is MP4/AVI.');
    } finally {
      setUploading(false);
    }
  };

  const toggleFullscreen = () => {
    if (!monitorRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(console.error);
    } else {
      monitorRef.current.requestFullscreen().catch(console.error);
    }
  };

  useEffect(() => {

    api.getCamera(id).then(setCamera).catch(e => setError(e.message));
  }, [id]);

  if (!camera) {
    return (
      <div className="flex h-64 items-center justify-center border-4 border-black bg-white shadow-neo-sm">
        <div className="flex items-center space-x-2 font-mono text-xs font-black uppercase">
          <Loader2 className="h-4 w-4 animate-spin text-black" />
          <span>{error || 'CONNECTING TO CAMERA NODE...'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 text-xs font-mono font-bold uppercase text-black/60">
        <Link href="/cameras" className="hover:text-black flex items-center gap-1">
          Surveillance Nodes
        </Link>
        <span>/</span>
        <span className="text-black font-black">{camera.name}</span>
      </div>

      <SectionHeader
        tag={`NODE ID: ${camera.id.substring(0, 8)}`}
        title={camera.name}
        description={`Source: ${camera.source_type.toUpperCase()} · ${camera.source_uri || 'No direct URI configured'}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/cameras/${id}/configure`}>
              <Button variant="secondary" size="sm" className="font-black text-xs">
                <Sliders className="h-3.5 w-3.5 mr-1.5" strokeWidth={2.5} />
                Configure Regions
              </Button>
            </Link>
            <Button
              size="sm"
              variant={camera.analytics_enabled ? "destructive" : "default"}
              onClick={() => {
                if (camera.analytics_enabled) {
                  api.stopCamera(id).then(() => api.getCamera(id).then(setCamera));
                } else {
                  api.startCamera(id).then(() => api.getCamera(id).then(setCamera));
                }
              }}
              className="font-black text-xs"
            >
              {camera.analytics_enabled ? (
                <>
                  <Square className="h-3.5 w-3.5 mr-1.5" strokeWidth={2.5} />
                  Stop Analytics
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 mr-1.5" strokeWidth={2.5} />
                  Start Analytics
                </>
              )}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Dominant CCTV Monitor Frame (8 Cols) */}
        <div className="lg:col-span-8 space-y-2">
          <div ref={monitorRef} className="border-4 border-black bg-black shadow-neo-lg overflow-hidden flex flex-col">
            {/* Monitor Top HUD Bar */}
            <div className="border-b-2 border-black bg-neo-yellow px-4 py-2 flex items-center justify-between font-mono text-xs font-black text-black">
              <div className="flex items-center space-x-3">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-neo-red border border-black animate-ping" />
                  FEED: {camera.name.toUpperCase()}
                </span>
                <span className="border-l border-black pl-3 text-black/70">
                  {camera.width && camera.height ? `${camera.width}×${camera.height}` : 'AUTO RES'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <StatusBadge status={camera.status} />
                <span className="bg-black text-white px-1.5 py-0.5 border border-black">
                  {camera.fps !== null && camera.fps !== undefined ? `${camera.fps} FPS` : 'NOT_MEASURED'}
                </span>
                {camera.status === 'online' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsStreamPaused(!isStreamPaused)}
                    className="h-6 px-1.5 border border-black bg-white hover:bg-neo-yellow text-[10px] font-mono font-black uppercase shadow-none"
                    title={isStreamPaused ? "Resume Live Stream" : "Pause Live Stream"}
                  >
                    {isStreamPaused ? <Play className="h-3 w-3" strokeWidth={3} /> : <Pause className="h-3 w-3" strokeWidth={3} />}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleFullscreen}
                  className="h-6 px-1.5 border border-black bg-white hover:bg-neo-yellow text-[10px] font-mono font-black uppercase shadow-none"
                  title="Fullscreen Display"
                >
                  <Maximize2 className="h-3 w-3" strokeWidth={3} />
                </Button>
              </div>
            </div>

            {/* Video Canvas Container */}
            <div className="relative aspect-video bg-black flex items-center justify-center text-white overflow-hidden">
              {camera.status === 'online' && !isStreamPaused ? (
                <img
                  src={`/api/v1/cameras/${id}/stream`}
                  alt="Live Surveillance Feed"
                  className="w-full h-full object-contain"
                />
              ) : camera.status === 'online' && isStreamPaused ? (
                <div className="p-8 text-center space-y-2 select-none">
                  <div className="inline-flex h-10 w-10 items-center justify-center border-2 border-white bg-neo-yellow text-black mb-1">
                    <Pause className="h-6 w-6" strokeWidth={2.5} />
                  </div>
                  <div className="font-mono text-xs font-black uppercase tracking-widest text-white">
                    FEED PAUSED BY OPERATOR
                  </div>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => setIsStreamPaused(false)}
                    className="h-8 border-2 border-white bg-neo-green text-black font-black text-xs font-mono"
                  >
                    <Play className="h-3.5 w-3.5 mr-1" strokeWidth={3} /> RESUME FEED
                  </Button>
                </div>
              ) : (
                <div className="p-8 text-center space-y-2 select-none">
                  <div className="inline-flex h-10 w-10 items-center justify-center border-2 border-white bg-neo-red text-white mb-1">
                    <AlertTriangle className="h-6 w-6" strokeWidth={2.5} />
                  </div>
                  <div className="font-mono text-xs font-black uppercase tracking-widest text-white">
                    INFERENCE PIPELINE OFFLINE
                  </div>
                  <p className="text-[11px] font-mono text-white/60 max-w-xs">
                    Start analytics or confirm that video source is active to view live overlay.
                  </p>
                </div>
              )}
            </div>

            {/* Monitor Bottom Telemetry Ticker */}
            <div className="border-t-2 border-black bg-neo-cream px-4 py-2 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] font-bold text-black">
              <div className="flex items-center space-x-4">
                <span>INFERENCE: <strong className="text-neo-red">YOLOv8n</strong></span>
                <span className="border-l border-black/40 pl-4">TRACKER: <strong>BYTETRACK</strong></span>
              </div>
              <div className="flex items-center space-x-3">
                <span className="text-black/70">QUEUE: BOUNDED FIFO (30 MAX)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Rail: Telemetry & Ingress Controls (4 Cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Pipeline Stats Panel */}
          <Card className="border-4 border-black bg-white shadow-neo-md">
            <CardHeader className="bg-neo-cream p-4 border-b-2 border-black">
              <CardTitle className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                <Activity className="h-4 w-4" strokeWidth={2.5} />
                Node Telemetry
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2.5 font-mono text-xs">
              <div className="flex justify-between border-b border-black/30 pb-2">
                <span className="text-black/70 font-bold">SOURCE TYPE</span>
                <span className="font-black uppercase bg-neo-muted px-1.5 border border-black/40">
                  {camera.source_type.replace('_', ' ')}
                </span>
              </div>
              <div className="flex justify-between border-b border-black/30 pb-2">
                <span className="text-black/70 font-bold">ACTIVE PIPELINE FPS</span>
                <span className="font-black text-black">
                  {camera.fps !== null && camera.fps !== undefined ? `${camera.fps} FPS` : 'NOT_MEASURED'}
                </span>
              </div>
              <div className="flex justify-between border-b border-black/30 pb-2">
                <span className="text-black/70 font-bold">FRAME DIMENSIONS</span>
                <span className="font-black text-black">
                  {camera.width && camera.height ? `${camera.width} × ${camera.height}` : 'Auto-detected'}
                </span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-black/70 font-bold">ANALYTICS ENGINE</span>
                <span className={`font-black px-1.5 py-0.5 border border-black text-[10px] ${camera.analytics_enabled ? 'bg-neo-green text-black' : 'bg-neo-muted text-black/60'}`}>
                  {camera.analytics_enabled ? 'RUNNING' : 'STOPPED'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Video Ingress Upload Card (for local_video) */}
          {camera.source_type === 'local_video' && (
            <Card className="border-4 border-black bg-white shadow-neo-md">
              <CardHeader className="bg-neo-yellow p-4 border-b-2 border-black">
                <CardTitle className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                  <Upload className="h-4 w-4" strokeWidth={2.5} />
                  Video Footage Ingress
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="space-y-1">
                  <span className="text-[11px] font-mono font-bold text-black/70 block truncate">
                    {camera.source_uri ? `Attached: ${camera.source_uri.split('/').pop()?.split('\\').pop()}` : 'No video file uploaded'}
                  </span>
                  <Input
                    type="file"
                    accept=".mp4,.avi,.mov,.mkv"
                    onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                    disabled={uploading}
                    className="bg-white text-xs file:font-black file:text-xs file:uppercase file:border-r file:border-black file:mr-2"
                  />
                </div>

                <Button
                  size="sm"
                  onClick={handleUpload}
                  disabled={!selectedFile || uploading}
                  className="w-full text-xs font-black bg-black text-white hover:bg-neo-yellow hover:text-black border-2 border-black shadow-neo-sm"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      Uploading Stream Media...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-3.5 w-3.5" strokeWidth={2.5} />
                      Upload Replacement Video
                    </>
                  )}
                </Button>

                {uploadMsg && (
                  <div className="border border-black bg-neo-green p-2 text-xs font-black text-black">
                    {uploadMsg}
                  </div>
                )}
                {uploadError && (
                  <div className="border border-black bg-neo-red p-2 text-xs font-black text-white">
                    {uploadError}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
