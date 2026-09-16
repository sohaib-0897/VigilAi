'use client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { use, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Camera, Zone, VirtualLine } from '@/lib/types';
import { ZoneEditor } from '@/components/cameras/zone-editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SectionHeader } from '@/components/ui/section-header';
import { Sliders, Plus, Trash2, ArrowLeft, GitCommit, Split } from 'lucide-react';
import Link from 'next/link';

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
      setError(e instanceof Error ? e.message : 'Configuration persistence failed');
    }
  };

  const handleDeleteZone = async (zoneId: string) => {
    try {
      await api.deleteZone(id, zoneId);
      setZones(zones.filter(z => z.id !== zoneId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Zone deletion failed');
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
      setError(e instanceof Error ? e.message : 'Line creation failed');
    }
  };

  const handleDeleteLine = async (lineId: string) => {
    try {
      await api.deleteLine(id, lineId);
      setLines(lines.filter(l => l.id !== lineId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Line deletion failed');
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center border-4 border-black bg-white shadow-neo-sm font-mono text-xs font-black uppercase">
        <span className="h-3 w-3 bg-black animate-ping mr-3" />
        LOADING GEOMETRY WORKSTATION...
      </div>
    );
  }

  if (!camera) {
    return (
      <div className="border-4 border-black bg-neo-red p-6 text-white shadow-neo-md font-mono text-xs font-black uppercase">
        CAMERA NODE NOT FOUND
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        tag="SPATIAL CALIBRATION WORKSTATION"
        title={`Configure: ${camera.name}`}
        description="Establish normalized [0, 1] polygon zones and virtual tripwires. Coordinates persist independently of viewport resolution."
        action={
          <Link href={`/cameras/${id}`}>
            <Button variant="outline" size="sm" className="text-xs font-black">
              <ArrowLeft className="h-4 w-4 mr-1.5" strokeWidth={2.5} />
              Return to Monitor
            </Button>
          </Link>
        }
      />

      {error && (
        <div className="border-2 border-black bg-neo-red p-3 text-white text-xs font-black uppercase shadow-neo-sm">
          {error}
        </div>
      )}

      {/* Structured 70 / 30 Technical Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 8 Cols: Visual Canvas Editor */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="border-4 border-black bg-white shadow-neo-md">
            <CardHeader className="bg-neo-yellow p-4 border-b-2 border-black">
              <CardTitle className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-2">
                <Sliders className="h-4 w-4" strokeWidth={2.5} />
                Polygon Zone Drawing Board
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-5">
              <ZoneEditor
                initialZones={zones}
                imageUrl={`/api/v1/cameras/${id}/stream`}
                onSave={handleSaveZones}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right 4 Cols: Configuration Inspector */}
        <div className="lg:col-span-4 space-y-6">
          {/* Active Zones Inspector */}
          <Card className="border-4 border-black bg-white shadow-neo-md">
            <CardHeader className="bg-neo-cream p-3.5 border-b-2 border-black flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                <GitCommit className="h-4 w-4" strokeWidth={2.5} />
                Active Zones ({zones.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              {zones.length === 0 ? (
                <div className="p-4 text-center font-mono text-xs text-black/60 uppercase border border-dashed border-black/40">
                  No spatial zones saved for this camera
                </div>
              ) : (
                <ul className="space-y-2">
                  {zones.map((z, i) => (
                    <li
                      key={z.id}
                      className="flex items-center justify-between border-2 border-black bg-white p-2 text-xs font-mono shadow-[2px_2px_0px_#000000]"
                    >
                      <div className="flex items-center space-x-2 min-w-0">
                        <span
                          className="h-3 w-3 border border-black shrink-0"
                          style={{ backgroundColor: z.color || '#FF5C5C' }}
                        />
                        <span className="font-black uppercase truncate text-black">{z.name}</span>
                        <span className="text-[10px] text-black/60">({z.points?.length || 0} pts)</span>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-6 px-2 text-[10px] font-black"
                        onClick={() => handleDeleteZone(z.id)}
                      >
                        <Trash2 className="h-3 w-3" strokeWidth={2.5} />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Virtual Lines Inspector */}
          <Card className="border-4 border-black bg-white shadow-neo-md">
            <CardHeader className="bg-neo-violet p-3.5 border-b-2 border-black">
              <CardTitle className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                <Split className="h-4 w-4" strokeWidth={2.5} />
                Virtual Tripwires ({lines.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* Add New Line Form */}
              <div className="space-y-3 border-2 border-black bg-neo-cream p-3 shadow-[2px_2px_0px_#000000]">
                <span className="text-[11px] font-mono font-black uppercase text-black block border-b border-black pb-1">
                  PROVISION NEW TRIPWIRE
                </span>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-black block">
                    Line Identifier
                  </label>
                  <Input
                    value={newLineName}
                    onChange={e => setNewLineName(e.target.value)}
                    placeholder="e.g. INGRESS_LINE_NORTH"
                    className="h-8 text-xs font-mono bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-black block">
                    Direction Mode
                  </label>
                  <Select value={newLineMode} onValueChange={setNewLineMode}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="a_to_b">Left to Right (A → B)</SelectItem>
                      <SelectItem value="b_to_a">Right to Left (B → A)</SelectItem>
                      <SelectItem value="both">Bidirectional (Both)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
                  <div>
                    <label className="font-bold">START (X, Y)</label>
                    <div className="flex gap-1 mt-0.5">
                      <Input
                        type="number"
                        step="0.05"
                        min="0"
                        max="1"
                        value={startX}
                        onChange={e => setStartX(parseFloat(e.target.value) || 0)}
                        className="h-7 text-[10px] bg-white px-1.5"
                      />
                      <Input
                        type="number"
                        step="0.05"
                        min="0"
                        max="1"
                        value={startY}
                        onChange={e => setStartY(parseFloat(e.target.value) || 0)}
                        className="h-7 text-[10px] bg-white px-1.5"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="font-bold">END (X, Y)</label>
                    <div className="flex gap-1 mt-0.5">
                      <Input
                        type="number"
                        step="0.05"
                        min="0"
                        max="1"
                        value={endX}
                        onChange={e => setEndX(parseFloat(e.target.value) || 0)}
                        className="h-7 text-[10px] bg-white px-1.5"
                      />
                      <Input
                        type="number"
                        step="0.05"
                        min="0"
                        max="1"
                        value={endY}
                        onChange={e => setEndY(parseFloat(e.target.value) || 0)}
                        className="h-7 text-[10px] bg-white px-1.5"
                      />
                    </div>
                  </div>
                </div>

                <Button
                  size="sm"
                  className="w-full text-xs font-black bg-black text-white hover:bg-neo-yellow hover:text-black border-2 border-black mt-1"
                  onClick={handleAddLine}
                  disabled={!newLineName}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" strokeWidth={3} />
                  Add Virtual Line
                </Button>
              </div>

              {/* Existing Lines */}
              <div className="space-y-2">
                <span className="text-[10px] font-mono font-bold uppercase text-black/70 block">
                  Configured Tripwires
                </span>
                {lines.length === 0 ? (
                  <p className="text-[11px] font-mono text-black/60 p-2 border border-dashed border-black/30 text-center">
                    No virtual lines configured
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {lines.map(l => (
                      <li
                        key={l.id}
                        className="flex items-center justify-between border-2 border-black bg-white p-2 text-xs font-mono shadow-[2px_2px_0px_#000000]"
                      >
                        <div className="min-w-0">
                          <div className="font-black uppercase truncate text-black">{l.name}</div>
                          <div className="text-[10px] text-black/60">MODE: {l.direction_mode}</div>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-6 px-2 text-[10px] font-black"
                          onClick={() => handleDeleteLine(l.id)}
                        >
                          <Trash2 className="h-3 w-3" strokeWidth={2.5} />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
