import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Zone, VirtualLine } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle } from 'lucide-react';

export function RuleForm({ onSubmit, initialData, cameraId }: { onSubmit: (data: any) => void, initialData?: any, cameraId: string }) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [lines, setLines] = useState<VirtualLine[]>([]);
  const [geometry, setGeometry] = useState('');
  const [threshold, setThreshold] = useState(5);

  useEffect(() => {
    Promise.all([api.getZones(cameraId), api.getLines(cameraId)]).then(([z, l]) => {
      setZones(z);
      setLines(l);
    });
  }, [cameraId]);

  const [name, setName] = useState(initialData?.name || '');
  const [type, setType] = useState(initialData?.rule_type || 'zone_entry');
  const [severity, setSeverity] = useState(initialData?.severity || 'medium');
  const [cooldown, setCooldown] = useState(initialData?.cooldown_seconds || 60);

  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardContent className="space-y-4 p-0 pt-2 text-black select-none">
        <div className="space-y-1.5">
          <label className="text-xs font-black uppercase tracking-wider text-black block">
            Rule Policy Name
          </label>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. PERIMETER_TRESPASS_NORTH"
            className="font-mono text-sm"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-black block">
              Rule Trigger Type
            </label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="zone_entry">Zone Entry</SelectItem>
                <SelectItem value="zone_exit">Zone Exit</SelectItem>
                <SelectItem value="line_crossing">Line Crossing</SelectItem>
                <SelectItem value="dwell_time">Dwell Threshold</SelectItem>
                <SelectItem value="occupancy_threshold">Occupancy Limit</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-black block">
              Alert Severity
            </label>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low (Advisory)</SelectItem>
                <SelectItem value="medium">Medium (Standard)</SelectItem>
                <SelectItem value="high">High (Security Alert)</SelectItem>
                <SelectItem value="critical">Critical (Breach)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-black block">
              Cooldown Window (Sec)
            </label>
            <Input
              type="number"
              min={1}
              value={cooldown}
              onChange={e => setCooldown(parseInt(e.target.value) || 30)}
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-black block">
              {type === 'line_crossing' ? 'Virtual Line Target' : 'Spatial Zone Target'}
            </label>
            <select
              className="flex h-10 w-full rounded-none border-2 border-black bg-white px-3 py-2 text-xs font-bold uppercase tracking-wider text-black shadow-[2px_2px_0px_#000000] focus:outline-none focus:ring-2 focus:ring-black"
              value={geometry}
              onChange={e => setGeometry(e.target.value)}
            >
              <option value="">-- SELECT BOUNDARY REGION --</option>
              {(type === 'line_crossing' ? lines : zones).map(g => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {(type === 'dwell_time' || type === 'occupancy_threshold') && (
          <div className="space-y-1.5 border-2 border-black bg-neo-yellow/30 p-3">
            <label className="text-xs font-black uppercase tracking-wider text-black block">
              {type === 'dwell_time' ? 'Minimum Dwell Threshold (Seconds)' : 'Maximum Zone Occupancy (Count)'}
            </label>
            <Input
              type="number"
              min={1}
              value={threshold}
              onChange={e => setThreshold(Number(e.target.value))}
              className="font-mono text-sm bg-white"
            />
          </div>
        )}

        <Button
          className="w-full h-11 text-xs font-black tracking-widest bg-black text-white hover:bg-neo-yellow hover:text-black border-2 border-black shadow-neo-sm mt-2"
          onClick={() =>
            onSubmit({
              name,
              rule_type: type,
              severity,
              cooldown_seconds: cooldown,
              ...(type === 'line_crossing' ? { line_id: geometry } : { zone_id: geometry }),
              threshold_value: threshold,
            })
          }
          disabled={!name || !geometry}
        >
          <PlusCircle className="h-4 w-4 mr-2" strokeWidth={2.5} />
          ESTABLISH SURVEILLANCE RULE
        </Button>
      </CardContent>
    </Card>
  );
}
