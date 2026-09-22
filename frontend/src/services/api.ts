import type {
  ActionPlan,
  AgentTrace,
  BrainGraphData,
  BrainStatus,
  DecisionChange,
  FutureGenerateResponse,
  FutureGraph,
  Opportunity,
  PersonalProfile,
  SimulationResult,
  TraceStep,
} from '../types';
import { demoGraph, demoOpportunities, demoProfile } from '../data/demo';
import { simulate as localSimulate } from '../utils/scoring';
import { buildLocalPlan } from '../utils/plan';
import { buildLocalBrainGraph } from '../components/BrainGraph';

export const DEMO_MODE = (import.meta.env.VITE_DEMO_MODE ?? 'true') !== 'false';
const TIMEOUT_MS = 4000;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`/api${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

async function withFallback<T>(fn: () => Promise<T>, fallback: () => T | Promise<T>): Promise<{ data: T; fromApi: boolean }> {
  try {
    const data = await fn();
    return { data, fromApi: true };
  } catch {
    return { data: await fallback(), fromApi: false };
  }
}

export interface IngestPayload {
  notes: string;
  files: { name: string; type: string; size: number; content: string | null }[];
  use_sample_calendar: boolean;
}

export const NAVIGATOR_TOOLS = [
  'recall_personal_context',
  'find_opportunities',
  'analyze_schedule',
  'generate_future_paths',
  'simulate_decision',
  'create_action_plan',
  'remember_user_feedback',
];

/** Local stand-in for the FutureNavigatorAgent run (same 4 tool calls, realistic summaries). */
export function demoTrace(graph: FutureGraph = demoGraph): TraceStep[] {
  const mk = (step: number, tool: string, input_summary: string, output_summary: string, duration_ms: number): TraceStep => ({
    step, tool, input_summary, output_summary, duration_ms, mode: 'demo',
  });
  return [
    mk(1, 'recall_personal_context', 'query="goals commitments deadlines interests"', '12 facts from 6 sources (Cognee demo brain)', 38),
    mk(2, 'analyze_schedule', '13 calendar events', '2 overlaps, 3 deadlines in 5 days, 9h open', 21),
    mk(3, 'find_opportunities', 'location=Berkeley/SF, date_range=next 90 days', '6 public opportunities via Bright Data (demo cache)', 143),
    mk(4, 'generate_future_paths', 'profile + schedule + opportunities', `${graph.nodes.length} nodes / ${graph.edges.length} edges scored`, 64),
  ];
}

export function demoAgentTrace(): AgentTrace {
  return { agent: 'FutureNavigatorAgent', framework: 'AWS Strands Agents', model: 'demo', tools: NAVIGATOR_TOOLS, steps: demoTrace() };
}

export const api = {
  brainStatus: () =>
    withFallback<BrainStatus>(
      () => request('/brain/status'),
      () => ({ mode: 'demo', ready: true, source_count: demoProfile.sources.length, message: 'Demo Brain (offline)' }),
    ),
  ingest: (payload: IngestPayload) =>
    withFallback<PersonalProfile>(
      () => request('/brain/ingest', { method: 'POST', body: JSON.stringify(payload) }),
      () => demoProfile,
    ),
  profile: () => withFallback<PersonalProfile>(() => request('/profile'), () => demoProfile),
  opportunities: () => withFallback<Opportunity[]>(() => request('/opportunities'), () => demoOpportunities),
  graph: () => withFallback<FutureGraph>(() => request('/future'), () => demoGraph),
  /** POST /api/future/generate — re-runs the FutureNavigatorAgent and returns the graph plus its tool trace. */
  generate: () =>
    withFallback<FutureGenerateResponse>(
      () => request('/future/generate', { method: 'POST' }),
      () => ({ ...demoGraph, trace: demoTrace() }),
    ),
  agentTrace: () => withFallback<AgentTrace>(() => request('/agent/trace'), () => demoAgentTrace()),
  brainGraph: () => withFallback<BrainGraphData>(() => request('/brain/graph'), () => buildLocalBrainGraph()),
  simulate: (graph: FutureGraph, change: DecisionChange) =>
    withFallback<SimulationResult>(
      () => request('/future/simulate', { method: 'POST', body: JSON.stringify({ graph, change }) }),
      () => localSimulate(graph, change),
    ),
  plan: (graph: FutureGraph, chosen: string[], opportunities: Opportunity[]) =>
    withFallback<ActionPlan>(
      () => request('/plan/generate', { method: 'POST', body: JSON.stringify({ graph, path_node_ids: chosen }) }),
      () => buildLocalPlan(graph, chosen, opportunities),
    ),
};
