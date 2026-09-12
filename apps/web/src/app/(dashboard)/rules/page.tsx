'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { AnalyticsRule, Camera } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RuleForm } from '@/components/rules/rule-form';

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
      setRules(rules.map(r => r.id === rule.id ? updated : r));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Rules Management</h1>
        <div className="flex items-center space-x-4">
          <Select value={selectedCamera} onValueChange={setSelectedCamera}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Select Camera" />
            </SelectTrigger>
            <SelectContent>
              {cameras.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={!selectedCamera}>Add Rule</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Rule</DialogTitle>
              </DialogHeader>
              <RuleForm onSubmit={handleCreateRule} cameraId={selectedCamera} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : !selectedCamera ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            No cameras available. Please add a camera first.
          </CardContent>
        </Card>
      ) : rules.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            No rules defined for this camera. Add a rule to start detecting events.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {rules.map(rule => (
            <Card key={rule.id}>
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-semibold">{rule.name}</h3>
                    <Badge variant={rule.enabled ? 'default' : 'secondary'}>
                      {rule.enabled ? 'Active' : 'Disabled'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Type: {rule.rule_type.replace('_', ' ')} | Severity: {rule.severity} | Cooldown: {rule.cooldown_seconds}s
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" onClick={() => handleToggle(rule)}>
                    {rule.enabled ? 'Disable' : 'Enable'}
                  </Button>
                  <Button variant="destructive" onClick={() => handleDelete(rule.id)}>
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
