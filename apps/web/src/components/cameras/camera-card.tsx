import { Camera } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Video, Activity, Eye, Play, Square } from 'lucide-react';
import Link from 'next/link';

export function CameraCard({ camera, onToggleAnalytics }: { camera: Camera, onToggleAnalytics?: (c: Camera) => void }) {
  return (
    <Card className="border-4 border-black bg-white shadow-neo-sm hover:shadow-neo-md transition-all rounded-none flex flex-col justify-between">
      <div>
        <CardHeader className="p-3 bg-neo-yellow border-b-2 border-black flex flex-row items-center justify-between gap-2">
          <Link href={`/cameras/${camera.id}`} className="hover:underline flex-1 min-w-0">
            <CardTitle className="text-base font-black truncate text-black flex items-center gap-1.5">
              <Video className="h-4 w-4 shrink-0" strokeWidth={2.5} />
              <span className="truncate">{camera.name}</span>
            </CardTitle>
          </Link>
          <StatusBadge status={camera.status} />
        </CardHeader>

        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-black/60 font-bold uppercase">SOURCE TYPE:</span>
            <span className="bg-neo-cream border border-black px-2 py-0.5 font-bold uppercase text-black">
              {camera.source_type.replace('_', ' ')}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-black/60 font-bold uppercase">RESOLUTION:</span>
            <span className="font-bold text-black">
              {camera.width && camera.height ? `${camera.width}×${camera.height}` : 'AUTO DETECT'}
            </span>
          </div>

          {camera.fps !== null && camera.fps !== undefined && (
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-black/60 font-bold uppercase">CURRENT FPS:</span>
              <span className="font-bold text-black bg-neo-muted px-1.5 py-0.5 border border-black/30">
                {camera.fps} FPS
              </span>
            </div>
          )}
        </CardContent>
      </div>

      <CardFooter className="p-3 border-t-2 border-black bg-neo-cream/50 flex items-center justify-between gap-2">
        <Link href={`/cameras/${camera.id}`} className="flex-1">
          <Button variant="outline" size="sm" className="w-full text-xs font-black">
            <Eye className="h-3.5 w-3.5 mr-1.5" strokeWidth={2.5} />
            Monitor Feed
          </Button>
        </Link>

        {onToggleAnalytics && (
          <Button
            size="sm"
            variant={camera.analytics_enabled ? "destructive" : "secondary"}
            onClick={() => onToggleAnalytics(camera)}
            className="text-xs font-black shrink-0"
          >
            {camera.analytics_enabled ? (
              <>
                <Square className="h-3.5 w-3.5 mr-1" strokeWidth={2.5} />
                STOP
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 mr-1" strokeWidth={2.5} />
                START
              </>
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
