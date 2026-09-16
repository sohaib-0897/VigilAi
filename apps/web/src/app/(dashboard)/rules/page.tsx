'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { AnalyticsRule, Camera } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SeverityBadge } from '@/components/ui/severity-badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RuleForm } from '@/components/rules/rule-form';
import { SectionHeader } from '@/components/ui/section-header';
import { Sliders, Plus, Trash2, Power, Camera as CameraIcon, ShieldCheck } from 'lucide-react';

export default function RulesPage() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [rules, setRules] = useState<AnalyticsRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    api.getCameras().then(res => {
      setCameras(res.items);
      if (res.items.length > 0) {
        setSelectedCamera(res.items[0].id);
      } else {
        setLoading(false);
      }
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedCamera) return;
    setLoading(true);
    api.getRules(selectedCamera).then(setRules).catch(console.error).finally(() => setLoading(false));
  }, [selectedCamera]);

  const handleCreateRule = async (data: any) => {
    if (!selectedCamera) return;
    try {
      const newRule = await api.createRule(selectedCamera, data);
      setRules([...rules, newRule]);
      setIsDialogOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (ruleId: string) => {
    if (!selectedCamera) return;
    try {
      await api.deleteRule(selectedCamera, ruleId);
      setRules(rules.filter(r => r.id !== ruleId));
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggle = async (rule: AnalyticsRule) => {
    if (!selectedCamera) return;
    try {
      const updated = await api.updateRule(selectedCamera, rule.id, { enabled: !rule.enabled });
      setRules(rules.map(r => (r.id === rule.id ? updated : r)));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        tag="POLICY DEFINITION PROTOCOL"
        title="Surveillance Rules"
        description="Establish automated alert criteria for spatial zone entry/exit, virtual tripwire crossing, dwell thresholds, and occupancy maximums."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 border-2 border-black bg-white p-1.5 shadow-neo-sm">
              <CameraIcon className="h-4 w-4 ml-1.5 text-black" strokeWidth={2.5} />
              <span className="text-xs font-black uppercase tracking-wider text-black">Camera Node:</span>
              <Select value={selectedCamera} onValueChange={setSelectedCamera}>
                <SelectTrigger className="w-[180px] sm:w-[220px] h-8 text-xs font-black">
                  <SelectValue placeholder="Select Camera Node" />
                </SelectTrigger>
                <SelectContent>
                  {cameras.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary" size="sm" disabled={!selectedCamera} className="text-xs font-black">
                  <Plus className="h-3.5 w-3.5 mr-1" strokeWidth={3} />
                  Add Surveillance Rule
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[550px]">
                <DialogHeader>
                  <div className="flex items-center space-x-2 text-black">
                    <Sliders className="h-5 w-5" strokeWidth={2.5} />
                    <DialogTitle>Provision Rule Policy</DialogTitle>
                  </div>
                </DialogHeader>
                <RuleForm onSubmit={handleCreateRule} cameraId={selectedCamera} />
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {loading ? (
        <div className="flex h-48 items-center justify-center border-4 border-black bg-white shadow-neo-sm font-mono text-xs font-black uppercase">
          <span className="h-3 w-3 bg-black animate-ping mr-2" />
          POLLING CONFIGURED RULES...
        </div>
      ) : !selectedCamera ? (
        <div className="border-4 border-black bg-white p-12 text-center shadow-neo-md font-mono text-xs font-black uppercase text-black/60">
          No camera nodes available. Provision a camera before establishing surveillance rules.
        </div>
      ) : rules.length === 0 ? (
        <div className="border-4 border-black bg-white p-12 text-center shadow-neo-md space-y-3">
          <div className="inline-flex h-12 w-12 items-center justify-center border-2 border-black bg-neo-yellow text-black mb-2">
            <Sliders className="h-6 w-6" strokeWidth={2.5} />
          </div>
          <h2 className="text-xl font-black uppercase tracking-tight text-black">
            Zero Rules Defined for Node
          </h2>
          <p className="text-xs font-medium text-black/70 max-w-md mx-auto">
            Establish automated policies to detect perimeter breaches, loitering dwell times, or directional line crossing on this camera.
          </p>
          <Button
            variant="secondary"
            onClick={() => setIsDialogOpen(true)}
            className="text-xs font-black uppercase tracking-wider mt-2"
          >
            Create First Surveillance Rule
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {rules.map(rule => (
            <Card
              key={rule.id}
              className="border-4 border-black bg-white shadow-neo-sm hover:shadow-neo-md transition-all rounded-none"
            >
              <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black text-base uppercase tracking-tight text-black truncate">
                      {rule.name}
                    </span>
                    <SeverityBadge severity={rule.severity} />
                    <StatusBadge
                      status={rule.enabled ? 'online' : 'offline'}
                      label={rule.enabled ? 'RULE ACTIVE' : 'RULE DISABLED'}
                      showPulse={false}
                    />
                  </div>

                  <div className="font-mono text-xs text-black/70 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>TYPE: <strong className="text-black uppercase">{rule.rule_type.replace('_', ' ')}</strong></span>
                    <span>·</span>
                    <span>COOLDOWN: <strong className="text-black">{rule.cooldown_seconds}s</strong></span>
                    {rule.threshold_value !== null && rule.threshold_value !== undefined && (
                      <>
                        <span>·</span>
                        <span>THRESHOLD: <strong className="text-black">{rule.threshold_value}</strong></span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant={rule.enabled ? "outline" : "secondary"}
                    size="sm"
                    onClick={() => handleToggle(rule)}
                    className="text-xs font-black"
                  >
                    <Power className="h-3.5 w-3.5 mr-1" strokeWidth={2.5} />
                    {rule.enabled ? 'Disable' : 'Enable'}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(rule.id)}
                    className="text-xs font-black"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" strokeWidth={2.5} />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
