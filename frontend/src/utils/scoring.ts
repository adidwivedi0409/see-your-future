// Deterministic scenario scoring. Mirrors backend/app/scoring/engine.py.
import type {
  DecisionChange,
  FutureGraph,
  FutureNode,
  SchedulePressure,
  ScoreFactor,
  SimulationResult,
  ChangedNode,
} from '../types';

export const FACTOR_NAMES = [
  'interest_alignment',
  'goal_alignment',
  'available_time',
  'existing_preparation',
  'deadline_feasibility',
  'opportunity_relevance',
  'user_commitment',
  'schedule_conflict_penalty',
  'workload_penalty',
] as const;

export type FactorName = (typeof FACTOR_NAMES)[number];

export const DEFAULT_WEIGHTS: Record<FactorName, number> = {
  interest_alignment: 0.2,
  goal_alignment: 0.2,
  available_time: 0.15,
  existing_preparation: 0.15,
  deadline_feasibility: 0.1,
  opportunity_relevance: 0.1,
  user_commitment: 0.1,
  schedule_conflict_penalty: -0.1,
  workload_penalty: -0.1,
};

export const FACTOR_LABELS: Record<FactorName, string> = {
  interest_alignment: 'Interest alignment',
  goal_alignment: 'Goal alignment',
  available_time: 'Available time',
  existing_preparation: 'Existing preparation',
  deadline_feasibility: 'Deadline feasibility',
  opportunity_relevance: 'Opportunity relevance',
  user_commitment: 'Your commitment',
  schedule_conflict_penalty: 'Schedule conflict',
  workload_penalty: 'Workload',
};

// Nodes that represent coursework capacity; they lose time when other
// commitments grow. Used when a graph does not carry explicit tags.
const COURSEWORK_NODE_IDS = new Set(['d_coursework', 'o_stable', 'r_missed_deadline', 'r_hw3_time']);

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const round4 = (v: number) => Math.round(v * 10000) / 10000;

export interface ScoreBreakdown {
  score: number;
  raw: number;
  components: { name: string; value: number; weight: number; contribution: number }[];
  weights: Record<string, number>;
  assumptions: string[];
  explanation: string;
}

export function computeScore(factors: ScoreFactor[], assumptions: string[] = []): ScoreBreakdown {
  const components = factors.map((f) => ({
    name: f.name,
    value: f.value,
    weight: f.weight,
    contribution: round4(f.weight * f.value),
  }));
  const raw = components.reduce((s, c) => s + c.weight * c.value, 0);
  const score = clamp(Math.round(raw * 100 + 1e-9), 0, 100);
  const weights: Record<string, number> = {};
  factors.forEach((f) => (weights[f.name] = f.weight));
  const top = [...components].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)).slice(0, 3);
  const explanation = `Scenario likelihood ${score}: ${top
    .map((c) => `${FACTOR_LABELS[c.name as FactorName] ?? c.name} ${c.contribution >= 0 ? '+' : ''}${Math.round(c.contribution * 100)}`)
    .join(', ')}.`;
  return { score, raw, components, weights, assumptions, explanation };
}

export function makeFactors(
  values: Record<FactorName, number>,
  reasons: Partial<Record<FactorName, string>> = {},
): ScoreFactor[] {
  return FACTOR_NAMES.map((name) => ({
    name,
    value: round4(clamp(values[name], 0, 1)),
    weight: DEFAULT_WEIGHTS[name],
    reason: reasons[name] ?? FACTOR_LABELS[name],
  }));
}

export function rescoreNode(node: FutureNode): FutureNode {
  const { score, explanation } = computeScore(node.score_factors, node.assumptions);
  return { ...node, scenario_score: score, explanation: node.explanation || explanation };
}

export function schedulePressure(graph: FutureGraph): SchedulePressure {
  if (!graph.nodes.length) return 'Low';
  // Match backend: average over non-present nodes (the root's zero penalties would dilute the mean).
  const pool = graph.nodes.filter((n) => n.category !== 'present');
  const nodesForAvg = pool.length ? pool : graph.nodes;
  const vals = nodesForAvg.map((n) => n.score_factors.find((f) => f.name === 'workload_penalty')?.value ?? 0);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  if (avg < 0.35) return 'Low';
  if (avg < 0.6) return 'Medium';
  return 'High';
}

export function rescoreGraph(graph: FutureGraph): FutureGraph {
  const nodes = graph.nodes.map(rescoreNode);
  const g = { ...graph, nodes };
  return { ...g, schedule_pressure: schedulePressure(g) };
}

export function descendants(graph: FutureGraph, nodeId: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>([nodeId]);
  const queue = [nodeId];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const e of graph.edges) {
      if (e.source === cur && !seen.has(e.target)) {
        seen.add(e.target);
        out.push(e.target);
        queue.push(e.target);
      }
    }
  }
  return out;
}

export function depthMap(graph: FutureGraph): Record<string, number> {
  const depth: Record<string, number> = { [graph.root_id]: 0 };
  const queue = [graph.root_id];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const e of graph.edges) {
      if (e.source === cur && depth[e.target] === undefined) {
        depth[e.target] = depth[cur] + 1;
        queue.push(e.target);
      }
    }
  }
  graph.nodes.forEach((n) => {
    if (depth[n.id] === undefined) depth[n.id] = 1;
  });
  return depth;
}

const deepClone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

type Delta = Record<string, Record<string, number>>; // nodeId -> factor -> delta

function adjust(node: FutureNode, name: FactorName, fn: (v: number) => number, deltas: Delta) {
  const f = node.score_factors.find((x) => x.name === name);
  if (!f) return;
  const before = f.value;
  const after = round4(clamp(fn(before), 0, 1));
  f.value = after;
  const d = round4(after - before);
  if (d !== 0) {
    deltas[node.id] = deltas[node.id] ?? {};
    deltas[node.id][name] = round4((deltas[node.id][name] ?? 0) + d);
  }
}

export const CHANGE_LABELS: Record<DecisionChange['change_type'], string> = {
  choose: 'Choose this path',
  reject: 'Reject this path',
  increase_time: 'Increase weekly time',
  decrease_time: 'Decrease weekly time',
  move_event: 'Move event',
  add_prep_task: 'Add a preparation task',
  change_priority: 'Change priority',
  mark_assumption_incorrect: 'Mark assumption incorrect',
};

export function simulate(graph: FutureGraph, change: DecisionChange): SimulationResult {
  const before = rescoreGraph(graph);
  const after = deepClone(before);
  const byId = new Map(after.nodes.map((n) => [n.id, n]));
  const target = byId.get(change.node_id);
  const deltas: Delta = {};
  if (!target) {
    return {
      before,
      after,
      changed_nodes: [],
      schedule_pressure_before: before.schedule_pressure,
      schedule_pressure_after: after.schedule_pressure,
      explanation: 'Unknown node; nothing changed.',
    };
  }
  const descIds = descendants(after, change.node_id);
  const desc = descIds.map((id) => byId.get(id)!).filter(Boolean);
  const subtree = new Set([change.node_id, ...descIds]);

  const applyTime = (hours: number) => {
    // target node (literal rule)
    adjust(target, 'existing_preparation', (v) => v + 0.06 * hours, deltas);
    adjust(target, 'available_time', (v) => v - 0.04 * hours, deltas);
    adjust(target, 'workload_penalty', (v) => v + 0.05 * hours, deltas);
    // downstream scenarios respond more strongly to invested time
    for (const n of desc) {
      adjust(n, 'existing_preparation', (v) => v + 0.2 * hours, deltas);
      adjust(n, 'user_commitment', (v) => v + 0.2 * hours, deltas);
      adjust(n, 'deadline_feasibility', (v) => v + 0.1 * hours, deltas);
    }
    // sibling coursework nodes lose capacity
    for (const n of after.nodes) {
      if (subtree.has(n.id)) continue;
      const isCoursework = n.category !== 'present' && (COURSEWORK_NODE_IDS.has(n.id) || /coursework|assignment|hw/i.test(n.title));
      if (!isCoursework) continue;
      adjust(n, 'available_time', (v) => v - 0.02 * hours, deltas);
      adjust(n, 'deadline_feasibility', (v) => v - 0.05 * hours, deltas);
      adjust(n, 'workload_penalty', (v) => v + 0.05 * hours, deltas);
    }
  };

  switch (change.change_type) {
    case 'choose':
      adjust(target, 'user_commitment', () => 1, deltas);
      desc.forEach((n) => adjust(n, 'user_commitment', (v) => v + 0.15, deltas));
      break;
    case 'reject':
      adjust(target, 'user_commitment', () => 0, deltas);
      desc.forEach((n) => adjust(n, 'user_commitment', (v) => v - 0.3, deltas));
      break;
    case 'increase_time':
      applyTime(Math.max(0, Number(change.value ?? 1)));
      break;
    case 'decrease_time':
      applyTime(-Math.max(0, Number(change.value ?? 1)));
      break;
    case 'add_prep_task':
      adjust(target, 'existing_preparation', (v) => v + 0.15, deltas);
      desc.forEach((n) => adjust(n, 'existing_preparation', (v) => v + 0.15, deltas));
      break;
    case 'change_priority': {
      const d = change.value === 'low' ? -0.15 : 0.15;
      adjust(target, 'goal_alignment', (v) => v + d, deltas);
      desc.forEach((n) => adjust(n, 'goal_alignment', (v) => v + d, deltas));
      break;
    }
    case 'mark_assumption_incorrect': {
      const text = String(change.value ?? '');
      target.assumptions = target.assumptions.filter((a) => a !== text);
      after.assumptions = after.assumptions.filter((a) => a !== text);
      adjust(target, 'deadline_feasibility', (v) => v - 0.1, deltas);
      desc.forEach((n) => adjust(n, 'deadline_feasibility', (v) => v - 0.1, deltas));
      break;
    }
    case 'move_event':
      adjust(target, 'schedule_conflict_penalty', () => 0, deltas);
      desc.forEach((n) => adjust(n, 'schedule_conflict_penalty', (v) => v * 0.5, deltas));
      break;
  }

  const rescored = rescoreGraph(after);
  const beforeById = new Map(before.nodes.map((n) => [n.id, n]));
  const changed_nodes: ChangedNode[] = [];
  for (const n of rescored.nodes) {
    const b = beforeById.get(n.id)!;
    const d = deltas[n.id];
    if (!d && b.scenario_score === n.scenario_score) continue;
    const moves = d
      ? Object.entries(d)
          .map(([k, v]) => `${FACTOR_LABELS[k as FactorName] ?? k} ${v > 0 ? '+' : ''}${v.toFixed(2)}`)
          .join(', ')
      : 'no factor changes';
    changed_nodes.push({
      node_id: n.id,
      title: n.title,
      before_score: b.scenario_score,
      after_score: n.scenario_score,
      explanation: `${n.title}: ${b.scenario_score} → ${n.scenario_score}. Factors moved: ${moves}.`,
    });
  }

  const label = CHANGE_LABELS[change.change_type];
  const valueText =
    change.change_type === 'increase_time' || change.change_type === 'decrease_time'
      ? ` by ${change.value ?? 1}h/week`
      : change.change_type === 'change_priority'
        ? ` to ${change.value}`
        : '';
  const explanation =
    `Applied "${label}${valueText}" to "${target.title}". ${changed_nodes.length} scenario${changed_nodes.length === 1 ? '' : 's'} changed. ` +
    `Schedule pressure ${before.schedule_pressure} → ${rescored.schedule_pressure}. ` +
    'Scores are scenario likelihoods derived from your commitments and the assumptions shown, not predictions.';

  return {
    before,
    after: rescored,
    changed_nodes,
    schedule_pressure_before: before.schedule_pressure,
    schedule_pressure_after: rescored.schedule_pressure,
    explanation,
  };
}
