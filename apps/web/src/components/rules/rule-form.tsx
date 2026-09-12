import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Zone, VirtualLine } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function RuleForm({ onSubmit, initialData, cameraId }: { onSubmit: (data: any) => void, initialData?: any, cameraId: string }) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [lines, setLines] = useState<VirtualLine[]>([]);
  const [geometry, setGeometry] = useState('');
  const [threshold, setThreshold] = useState(5);
  useEffect(() => {
    Promise.all([api.getZones(cameraId), api.getLines(cameraId)]).then(([z, l]) => {setZones(z); setLines(l);});
  }, [cameraId]);
  const [name, setName] = useState(initialData?.name || '');
  const [type, setType] = useState(initialData?.rule_type || 'zone_entry');
  const [severity, setSeverity] = useState(initialData?.severity || 'medium');
  const [cooldown, setCooldown] = useState(initialData?.cooldown_seconds || 60);

  return (
    <Card className="border-0 shadow-none">
      <CardContent className="space-y-4 p-0 pt-2">
        <div>
          <label className="text-sm font-medium">Rule Name</label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Front Door Entry" />
        </div>
        <div>
          <label className="text-sm font-medium">Rule Type</label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="zone_entry">Zone Entry</SelectItem>
              <SelectItem value="zone_exit">Zone Exit</SelectItem>
              <SelectItem value="line_crossing">Line Crossing</SelectItem>
              <SelectItem value="dwell_time">Dwell Time</SelectItem>
              <SelectItem value="occupancy_threshold">Occupancy</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium">Severity</label>
          <Select value={severity} onValueChange={setSeverity}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium">Cooldown (Seconds)</label>
          <Input type="number" value={cooldown} onChange={e => setCooldown(parseInt(e.target.value))} />
        </div>
        <div>
          <label className="text-sm font-medium">{type === 'line_crossing' ? 'Line' : 'Zone'}</label>
          <select className="w-full rounded border bg-background p-2" value={geometry} onChange={e => setGeometry(e.target.value)}>
            <option value="">Select geometry</option>
            {(type === 'line_crossing' ? lines : zones).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        {(type === 'dwell_time' || type === 'occupancy_threshold') && <div>
          <label className="text-sm font-medium">{type === 'dwell_time' ? 'Dwell seconds' : 'Occupancy threshold'}</label>
          <Input type="number" min={1} value={threshold} onChange={e => setThreshold(Number(e.target.value))} />
        </div>}
        <button 
          className="w-full py-2 bg-primary text-primary-foreground rounded-md mt-4 disabled:opacity-50" 
          onClick={() => onSubmit({ name, rule_type: type, severity, cooldown_seconds: cooldown, ...(type === 'line_crossing' ? {line_id: geometry} : {zone_id: geometry}), threshold_value: threshold })}
          disabled={!name || !geometry}
        >
          Save Rule
        </button>
      </CardContent>
    </Card>
  );
}
