'use client';
import { useEffect, useRef, useState } from 'react';

interface Point { x: number; y: number; }
interface ZoneEditorProps {
  initialZones?: any[];
  onSave: (zones: any[]) => void;
  imageUrl?: string;
}

export function ZoneEditor({ initialZones = [], onSave, imageUrl }: ZoneEditorProps) {
  const [size, setSize] = useState({width: 800, height: 450});
  useEffect(() => setZones(initialZones), [initialZones]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zones, setZones] = useState<any[]>(initialZones);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw existing zones
    zones.forEach(zone => {
      ctx.beginPath();
      zone.points.forEach((p: Point, i: number) => {
        const x = p.x * canvas.width;
        const y = p.y * canvas.height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fillStyle = zone.color || 'rgba(255, 0, 0, 0.3)';
      ctx.fill();
      ctx.strokeStyle = zone.color || 'red';
      ctx.stroke();
    });

    // Draw current points
    if (currentPoints.length > 0) {
      ctx.beginPath();
      currentPoints.forEach((p, i) => {
        const x = p.x * canvas.width;
        const y = p.y * canvas.height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = 'blue';
      ctx.stroke();
    }
  }, [zones, currentPoints, size]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    if (e.detail === 1) setCurrentPoints([...currentPoints, { x, y }]);
  };

  const handleDoubleClick = () => {
    if (currentPoints.length > 2) {
      setZones([...zones, { name: `Zone ${zones.length + 1}`, points: currentPoints, color: '#00ff00' }]);
      setCurrentPoints([]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative inline-block border border-dashed rounded-lg overflow-hidden">
        {imageUrl && <img src={imageUrl} alt="Reference" onLoad={e => setSize({width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight})} className="absolute inset-0 w-full h-full pointer-events-none" />}
        <canvas
          ref={canvasRef}
          width={size.width}
          height={size.height}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          className="relative z-10 cursor-crosshair w-full h-auto"
        />
      </div>
      <div className="flex space-x-2">
        <button className="px-4 py-2 bg-secondary rounded" onClick={() => setCurrentPoints([])}>Clear Current</button>
        <button className="px-4 py-2 bg-primary text-primary-foreground rounded" onClick={() => onSave(zones)}>Save Zones</button>
      </div>
      <p className="text-xs text-muted-foreground">Click to add points. Double-click to close polygon.</p>
    </div>
  );
}
