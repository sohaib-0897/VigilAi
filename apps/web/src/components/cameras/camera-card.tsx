import { Camera } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export function CameraCard({ camera, onToggleAnalytics }: { camera: Camera, onToggleAnalytics?: (c: Camera) => void }) {
  return (
    <Card className="hover:border-primary transition-colors">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <Link href={`/cameras/${camera.id}`} className="hover:underline flex-1">
          <CardTitle className="text-xl truncate">{camera.name}</CardTitle>
        </Link>
        <Badge variant={camera.status === 'online' ? 'default' : 'secondary'}>{camera.status}</Badge>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm text-muted-foreground">{camera.source_type}</span>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-muted-foreground">Analytics</span>
            {onToggleAnalytics && (
              <button onClick={() => onToggleAnalytics(camera)} className={`px-2 py-1 text-xs rounded ${camera.analytics_enabled ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                {camera.analytics_enabled ? 'On' : 'Off'}
              </button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
