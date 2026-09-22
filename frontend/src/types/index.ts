export type SourceType = 'calendar' | 'note' | 'document' | 'upload' | 'demo';

export interface PersonalSource {
  id: string;
  name: string;
  type: SourceType;
  date: string | null;
  excerpt: string;
  record_id: string;
}

export type EventKind = 'class' | 'deadline' | 'interview' | 'event' | 'personal' | 'study';

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  kind: EventKind;
  location: string | null;
  source_id: string;
}

export interface PersonalEvidence {
  id: string;
  text: string;
  source_id: string;
  date: string | null;
}

export type AttributeKind =
  | 'commitment'
  | 'goal'
  | 'interest'
  | 'strength'
  | 'habit'
  | 'constraint'
  | 'overload'
  | 'growth';

export interface ProfileAttribute {
  id: string;
  kind: AttributeKind;
  label: string;
  confidence: number;
  evidence_ids: string[];
  source_ids: string[];
  disclaimer: string;
}

export interface TimeAllocation {
  category: string;
  hours: number;
}

export interface PersonalProfile {
  user_id: string;
  summary: string;
  weekly_commitment_hours: number;
  time_allocation: TimeAllocation[];
  upcoming_deadlines: CalendarEvent[];
  attributes: ProfileAttribute[];
  evidence: PersonalEvidence[];
  sources: PersonalSource[];
  overload_warnings: string[];
  brain_mode: 'cognee' | 'demo';
}

export type OpportunityType = 'hackathon' | 'internship' | 'research' | 'scholarship' | 'event' | 'course';

export interface Opportunity {
  id: string;
  title: string;
  type: OpportunityType;
  organization: string;
  description: string;
  location: string;
  start_date: string | null;
  deadline: string | null;
  url: string;
  source: string;
  relevance_score: number;
  relevance_reasons: string[];
  is_demo: boolean;
}

export interface ScoreFactor {
  name: string;
  value: number;
  weight: number;
  reason: string;
}

export type NodeCategory = 'present' | 'decision' | 'opportunity' | 'outcome' | 'risk';
export type TimeHorizon = 'now' | 'days' | 'weeks' | 'months' | 'years';

export interface FutureNode {
  id: string;
  title: string;
  description: string;
  category: NodeCategory;
  time_horizon: TimeHorizon;
  scenario_score: number;
  score_factors: ScoreFactor[];
  positive_effects: string[];
  tradeoffs: string[];
  assumptions: string[];
  evidence_ids: string[];
  opportunity_ids: string[];
  recommended_action: string;
  explanation: string;
}

export type EdgeKind = 'leads_to' | 'enables' | 'risks';

export interface FutureEdge {
  id: string;
  source: string;
  target: string;
  label: string | null;
  kind: EdgeKind;
}

export type SchedulePressure = 'Low' | 'Medium' | 'High';

export interface FutureGraph {
  id: string;
  generated_at: string;
  root_id: string;
  nodes: FutureNode[];
  edges: FutureEdge[];
  schedule_pressure: SchedulePressure;
  assumptions: string[];
}

export type ChangeType =
  | 'choose'
  | 'reject'
  | 'increase_time'
  | 'decrease_time'
  | 'move_event'
  | 'add_prep_task'
  | 'change_priority'
  | 'mark_assumption_incorrect';

export interface DecisionChange {
  node_id: string;
  change_type: ChangeType;
  value: number | string | null;
  note: string | null;
}

export interface ChangedNode {
  node_id: string;
  title: string;
  before_score: number;
  after_score: number;
  explanation: string;
}

export interface SimulationResult {
  before: FutureGraph;
  after: FutureGraph;
  changed_nodes: ChangedNode[];
  schedule_pressure_before: SchedulePressure;
  schedule_pressure_after: SchedulePressure;
  explanation: string;
}

export type ActionKind = 'action' | 'calendar_block' | 'risk' | 'opportunity';

export interface ActionItem {
  id: string;
  title: string;
  description: string;
  when: string;
  duration_minutes: number;
  kind: ActionKind;
}

export interface ActionPlan {
  path_node_ids: string[];
  next_actions: ActionItem[];
  calendar_blocks: ActionItem[];
  risk: ActionItem;
  opportunity: ActionItem;
  explanation: string;
  requires_confirmation: true;
}

export interface BrainStatus {
  mode: 'cognee' | 'demo';
  ready: boolean;
  source_count: number;
  message: string;
}

export const SCENARIO_TOOLTIP =
  'An estimate derived from your current commitments, preferences, available opportunities, and the assumptions shown here. This is not a prediction or guarantee.';
export const PRIVACY_LINE = 'Your data is used only to build your personal scenario map.';
export const TAGLINE = 'Your future is not predicted. It is shaped.';

// ---- agent trace + brain graph (appended) ----
export type TraceMode = 'demo' | 'strands';

export interface TraceStep {
  step: number;
  tool: string;
  input_summary: string;
  output_summary: string;
  duration_ms: number;
  mode: TraceMode;
}

export interface AgentTrace {
  agent: string;
  framework: string;
  model: string;
  tools: string[];
  steps: TraceStep[];
}

export interface FutureGenerateResponse extends FutureGraph {
  trace?: TraceStep[];
}

export type BrainNodeKind = 'source' | 'event' | 'goal' | 'interest' | 'attribute' | 'opportunity';

export interface BrainGraphNode {
  id: string;
  label: string;
  kind: BrainNodeKind;
}

export interface BrainGraphEdge {
  source: string;
  target: string;
  relation: string;
}

export interface BrainGraphData {
  mode: 'cognee' | 'demo';
  nodes: BrainGraphNode[];
  edges: BrainGraphEdge[];
}
