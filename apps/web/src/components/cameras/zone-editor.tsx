'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Trash2, Save, Crosshair, Undo2 } from 'lucide-react';

interface Point { x: number; y: number; }
interface ZoneEditorProps {
  initialZones?: any[];
  onSave: (zones: any[]) => void;
  imageUrl?: string;
}

export function ZoneEditor({ initialZones = [], onSave, imageUrl }: ZoneEditorProps) {
  const [size, setSize] = useState({ width: 800, height: 450 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zones, setZones] = useState<any[]>(initialZones);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);

  useEffect(() => {
    setZones(initialZones);
  }, [initialZones]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw existing persisted zones
    zones.forEach((zone, idx) => {
      if (!zone.points || zone.points.length < 3) return;
      ctx.beginPath();
      zone.points.forEach((p: Point, i: number) => {
        const x = p.x * canvas.width;
        const y = p.y * canvas.height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();

      // Semi-transparent colored fill
      ctx.fillStyle = zone.color ? `${zone.color}40` : 'rgba(255, 92, 92, 0.25)';
      ctx.fill();

      // Sharp stroke boundary
      ctx.strokeStyle = zone.color || '#FF5C5C';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Label background & text
      const firstX = zone.points[0].x * canvas.width;
      const firstY = zone.points[0].y * canvas.height;
      ctx.fillStyle = '#000000';
      ctx.fillRect(firstX, firstY - 20, 90, 18);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(zone.name || `ZONE ${idx + 1}`, firstX + 6, firstY - 6);
    });

    // Draw currently drawing polygon
    if (currentPoints.length > 0) {
      ctx.beginPath();
      currentPoints.forEach((p, i) => {
        const x = p.x * canvas.width;
        const y = p.y * canvas.height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#FFD93D';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 6]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw active vertex points
      currentPoints.forEach((p) => {
        const x = p.x * canvas.width;
        const y = p.y * canvas.height;
        ctx.fillStyle = '#FF5C5C';
        ctx.fillRect(x - 5, y - 5, 10, 10);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 5, y - 5, 10, 10);
      });
    }
  }, [zones, currentPoints, size]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    if (e.detail === 1) {
      setCurrentPoints((prev) => [...prev, { x, y }]);
    }
  };

  const handleDoubleClick = () => {
    if (currentPoints.length >= 3) {
      const palette = ['#FF5C5C', '#FFD93D', '#5DE271', '#C4B5FD'];
      const assignedColor = palette[zones.length % palette.length];
      const newZone = {
        name: `Zone ${zones.length + 1}`,
        points: currentPoints,
        color: assignedColor,
      };
      setZones((prev) => [...prev, newZone]);
      setCurrentPoints([]);
    }
  };

  return (
    <div className="space-y-4 select-none">
      {/* HUD Instruction bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-2 border-black bg-neo-yellow p-2.5 shadow-neo-sm font-mono text-xs font-bold">
        <div className="flex items-center gap-2">
          <Crosshair className="h-4 w-4" strokeWidth={2.5} />
          <span>CANVAS: {size.width}×{size.height} PX</span>
          <span className="border-l border-black pl-2">
            ACTIVE VERTICES: <span className="font-black underline">{currentPoints.length}</span>
          </span>
        </div>
        <div className="text-[11px] bg-black text-white px-2 py-0.5 font-sans uppercase">
          CLICK = ADD POINT · DOUBLE-CLICK = CLOSE POLYGON (≥ 3)
        </div>
      </div>

      {/* Drawing Canvas Area */}
      <div className="relative border-4 border-black bg-black overflow-hidden shadow-neo-md">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Camera Preview Frame"
            onLoad={(e) =>
              setSize({ width: e.currentTarget.naturalWidth || 800, height: e.currentTarget.naturalHeight || 450 })
            }
            className="absolute inset-0 w-full h-full object-contain pointer-events-none opacity-80"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/40 font-mono text-xs uppercase tracking-widest bg-tech-grid">
            NO REFERENCE STREAM FRAME LOADED
          </div>
        )}

        <canvas
          ref={canvasRef}
          width={size.width}
          height={size.height}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          className="relative z-10 cursor-crosshair w-full h-auto block"
        />
      </div>

      {/* Action Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-2 border-black bg-white p-3 shadow-neo-sm">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPoints((prev) => prev.slice(0, -1))}
            disabled={currentPoints.length === 0}
            className="text-xs font-black"
          >
            <Undo2 className="h-3.5 w-3.5 mr-1 text-black" strokeWidth={2.5} />
            Undo Vertex
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPoints([])}
            disabled={currentPoints.length === 0}
            className="text-xs font-black"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1 text-neo-red" strokeWidth={2.5} />
            Discard In-Progress
          </Button>

          {currentPoints.length >= 3 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDoubleClick}
              className="text-xs font-black"
            >
              Close Polygon ({currentPoints.length} pts)
            </Button>
          )}
        </div>

        <Button
          variant="default"
          size="sm"
          onClick={() => onSave(zones)}
          className="text-xs font-black bg-black text-white hover:bg-neo-green hover:text-black"
        >
          <Save className="h-3.5 w-3.5 mr-1" strokeWidth={2.5} />
          Commit Zones to Camera
        </Button>
      </div>
    </div>
  );

}
