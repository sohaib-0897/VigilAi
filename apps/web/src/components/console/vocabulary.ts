/**
 * Backend enums used by the events, rules and analytics pages. Values mirror
 * `RuleType`, `Severity` (db/models/analytics_rule.py) and `EventStatus`
 * (db/models/event.py). A rule of type X produces events of type X.
 */

export type Geometry = 'zone' | 'line' | 'optional-zone';

export interface RuleTypeInfo {
  value: string;
  label: string;
  /** What the worker needs (`services/rule.py::_validate`). */
  geometry: Geometry;
  /** The threshold the worker compares against, if the type uses one. */
  threshold?: { label: string; unit: string; hint: string; step: number };
  /** One sentence on when the worker fires it (`cv/rules/engine.py`). */
  fires: string;
}

export const RULE_TYPES: RuleTypeInfo[] = [
  { value: 'zone_entry', label: 'Zone entry', geometry: 'zone', fires: 'A tracked object’s centroid moves from outside to inside the zone.' },
  { value: 'zone_exit', label: 'Zone exit', geometry: 'zone', fires: 'A tracked object’s centroid moves from inside to outside the zone.' },
  {
    value: 'dwell_time',
    label: 'Dwell time',
    geometry: 'zone',
    threshold: { label: 'Dwell threshold', unit: 's', step: 1, hint: 'Seconds a single track must stay inside the zone.' },
    fires: 'One track stays inside the zone for at least the threshold.',
  },
  { value: 'line_crossing', label: 'Line crossing', geometry: 'line', fires: 'A track crosses the line in a direction the line counts.' },
  {
    value: 'occupancy_threshold',
    label: 'Occupancy',
    geometry: 'zone',
    threshold: { label: 'Occupancy limit', unit: 'objects', step: 1, hint: 'Fires when this many tracked objects are inside the zone at once.' },
    fires: 'The number of tracks inside the zone reaches the limit.',
  },
  {
    value: 'class_presence',
    label: 'Class presence',
    geometry: 'optional-zone',
    fires: 'Any of the chosen classes is tracked in the frame, or inside the zone if one is set.',
  },
  {
    value: 'ppe_violation',
    label: 'PPE violation',
    geometry: 'optional-zone',
    fires: 'A person track is missing required equipment for the whole confirmation window.',
  },
];

export const ruleType = (value: string) => RULE_TYPES.find(t => t.value === value);
export const ruleTypeLabel = (value: string) => ruleType(value)?.label ?? value.replace(/_/g, ' ');

export const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;

export const EVENT_STATUSES = ['active', 'acknowledged', 'resolved', 'dismissed'] as const;

/** Equipment the PPE pipeline understands (`cv/ppe/models.py::STANDARD_EQUIPMENT`). */
export const PPE_ITEMS = [
  { value: 'helmet', label: 'Helmet' },
  { value: 'vest', label: 'High-visibility vest' },
  { value: 'gloves', label: 'Gloves' },
  { value: 'goggles', label: 'Goggles' },
  { value: 'boots', label: 'Safety boots' },
] as const;
