'use client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { use, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Camera, Zone, VirtualLine } from '@/lib/types';
import { ZoneEditor } from '@/components/cameras/zone-editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function ConfigurePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [camera, setCamera] = useState<Camera | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [lines, setLines] = useState<VirtualLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Line creation state
  const [newLineName, setNewLineName] = useState('');
  const [newLineMode, setNewLineMode] = useState('both');
  const [startX, setStartX] = useState(0.1);
  const [startY, setStartY] = useState(0.5);
  const [endX, setEndX] = useState(0.9);
  const [endY, setEndY] = useState(0.5);

  useEffect(() => {
    Promise.all([
      api.getCamera(id),
      api.getZones(id),
      api.getLines(id)
    ]).then(([cam, z, l]) => {
      setCamera(cam);
      setZones(z);
      setLines(l);
    }).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  const handleSaveZones = async (newZonesData: any[]) => {
    try {
      const toCreate = newZonesData.filter(z => !z.id);
      for (const z of toCreate) {
        const created = await api.createZone(id, {
          name: z.name || 'New Zone',
          zone_type: 'custom',
          points: z.points,
          color: z.color || '#ff0000',
          enabled: true
        });
        setZones(prev => [...prev, created]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Configuration failed');
    }
  };

  const handleDeleteZone = async (zoneId: string) => {
    try {
      await api.deleteZone(id, zoneId);
      setZones(zones.filter(z => z.id !== zoneId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Configuration failed');
    }
  };

  const handleAddLine = async () => {
    try {
      const created = await api.createLine(id, {
        name: newLineName || 'New Line',
        start_point: { x: startX, y: startY },
        end_point: { x: endX, y: endY },
        direction_mode: newLineMode,
        color: '#0000ff',
        enabled: true
      });
      setLines([...lines, created]);
      setNewLineName('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Configuration failed');
    }
  };

  const handleDeleteLine = async (lineId: string) => {
    try {
      await api.deleteLine(id, lineId);
      setLines(lines.filter(l => l.id !== lineId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Configuration failed');
    }
  };

  if (loading) return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  if (!camera) return <div className="p-12 text-center text-red-500">Camera not found</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Configure: {camera.name}</h1>
      {error && <p role="alert" className="text-red-500">{error}</p>}
      <p className="text-sm text-muted-foreground">Start the camera to draw over its preview. Stop and start analytics after saving configuration.</p>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Zones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ZoneEditor 
              initialZones={zones}
              imageUrl={`/api/v1/cameras/${id}/stream`} 
              onSave={handleSaveZones} 
            />
            <div className="mt-4">
              <h3 className="font-semibold mb-2">Existing Zones</h3>
              {zones.length === 0 ? <p className="text-sm text-muted-foreground">No zones configured.</p> : (
                <ul className="space-y-2">
                  {zones.map(z => (
                    <li key={z.id} className="flex justify-between items-center bg-secondary p-2 rounded-md px-3">
                      <span>{z.name}</span>
                      <Button variant="destructive" size="sm" onClick={() => handleDeleteZone(z.id)}>Delete</Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Virtual Lines</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4 p-4 border rounded-lg">
              <h3 className="font-semibold text-sm">Add New Line</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs">Line Name</label>
                  <Input value={newLineName} onChange={e => setNewLineName(e.target.value)} placeholder="e.g. Entrance Line" />
                </div>
                <div>
                  <label className="text-xs">Direction Mode</label>
                  <Select value={newLineMode} onValueChange={setNewLineMode}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="a_to_b">Left to Right</SelectItem>
                      <SelectItem value="b_to_a">Right to Left</SelectItem>
                      <SelectItem value="both">Both</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 grid grid-cols-4 gap-2">
                  <div>
                    <label className="text-xs">Start X (0-1)</label>
                    <Input type="number" step="0.1" value={startX} onChange={e => setStartX(parseFloat(e.target.value))} />
                  </div>
                  <div>
                    <label className="text-xs">Start Y (0-1)</label>
                    <Input type="number" step="0.1" value={startY} onChange={e => setStartY(parseFloat(e.target.value))} />
                  </div>
                  <div>
                    <label className="text-xs">End X (0-1)</label>
                    <Input type="number" step="0.1" value={endX} onChange={e => setEndX(parseFloat(e.target.value))} />
                  </div>
                  <div>
                    <label className="text-xs">End Y (0-1)</label>
                    <Input type="number" step="0.1" value={endY} onChange={e => setEndY(parseFloat(e.target.value))} />
                  </div>
                </div>
              </div>
              <Button className="w-full" onClick={handleAddLine} disabled={!newLineName}>Create Line</Button>
            </div>

            <div className="mt-4">
              <h3 className="font-semibold mb-2">Existing Lines</h3>
              {lines.length === 0 ? <p className="text-sm text-muted-foreground">No lines configured.</p> : (
                <ul className="space-y-2">
                  {lines.map(l => (
                    <li key={l.id} className="flex justify-between items-center bg-secondary p-2 rounded-md px-3">
                      <div>
                        <div className="font-medium">{l.name}</div>
                        <div className="text-xs text-muted-foreground">Mode: {l.direction_mode}</div>
                      </div>
                      <Button variant="destructive" size="sm" onClick={() => handleDeleteLine(l.id)}>Delete</Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
