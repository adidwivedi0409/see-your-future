import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type {
  ActionPlan,
  DecisionChange,
  FutureGraph,
  Opportunity,
  PersonalProfile,
  PersonalSource,
  SimulationResult,
} from '../types';
import { api, DEMO_MODE, type IngestPayload } from '../services/api';
import { demoGraph, demoOpportunities, demoProfile } from '../data/demo';

export type BrainStatusKind = 'idle' | 'building' | 'ready';

export interface ToastState {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'warning';
}

export type SearchCategory = 'event' | 'evidence' | 'attribute' | 'opportunity' | 'node' | 'action' | 'brain';

export interface SearchItem {
  id: string;
  category: SearchCategory;
  title: string;
  subtitle?: string;
  /** Extra text that should match but is not shown */
  keywords?: string;
  /** Where selecting this item should take the user */
  target: { kind: SearchCategory; id: string; path: string; sourceRef?: string };
}

export const STAGE_PATHS = ['/brain', '/present', '/future', '/plan'] as const;

interface AppState {
  demoMode: boolean;
  brainStatus: BrainStatusKind;
  brainMode: 'cognee' | 'demo';
  buildStep: number;
  profile: PersonalProfile | null;
  opportunities: Opportunity[];
  graph: FutureGraph | null;
  baselineGraph: FutureGraph | null;
  history: FutureGraph[];
  selectedNodeId: string | null;
  simulation: SimulationResult | null;
  changedNodeIds: string[];
  chosenNodeIds: string[];
  rejectedAttributeIds: string[];
  plan: ActionPlan | null;
  planConfirmed: boolean;
  toast: ToastState | null;
  pendingSources: PersonalSource[];
  usingApi: boolean;
  /** Progressive disclosure: stages 1..4 currently available to the user */
  unlockedStages: number[];
  visitedStages: number[];
  highlightId: string | null;
  searchOpen: boolean;
  searchIndex: SearchItem[];
}

interface AppActions {
  loadDemo: () => Promise<void>;
  buildBrain: (payload: IngestPayload) => Promise<void>;
  addPendingSource: (s: PersonalSource) => void;
  removePendingSource: (id: string) => void;
  ensureLoaded: () => Promise<void>;
  selectNode: (id: string | null) => void;
  applyChange: (change: DecisionChange) => Promise<SimulationResult | null>;
  undo: () => void;
  resetGraph: () => void;
  resetDemo: () => void;
  rejectAttribute: (id: string) => void;
  restoreAttribute: (id: string) => void;
  generatePlan: () => Promise<ActionPlan | null>;
  confirmPlan: () => void;
  showToast: (message: string, tone?: ToastState['tone']) => void;
  dismissToast: () => void;
  markStageVisited: (stage: number) => void;
  setHighlightId: (id: string | null) => void;
  setSearchOpen: (open: boolean) => void;
}

const Ctx = createContext<(AppState & AppActions) | null>(null);

export const BUILD_STEPS = [
  'Reading personal data',
  'Identifying commitments',
  'Connecting goals and interests',
  'Building knowledge graph',
  'Brain ready',
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const PERSIST_KEY = 'syf_session_v1';
type Persisted = {
  brainStatus?: BrainStatusKind; brainMode?: 'cognee' | 'demo'; profile?: PersonalProfile | null;
  opportunities?: Opportunity[]; graph?: FutureGraph | null; baselineGraph?: FutureGraph | null;
  history?: FutureGraph[]; chosenNodeIds?: string[]; rejectedAttributeIds?: string[];
  plan?: ActionPlan | null; planConfirmed?: boolean; visitedStages?: number[]; pendingSources?: PersonalSource[];
};
function readPersisted(): Persisted {
  try { const raw = sessionStorage.getItem(PERSIST_KEY); return raw ? (JSON.parse(raw) as Persisted) : {}; } catch { return {}; }
}
const persisted: Persisted = readPersisted();
const restored = persisted.brainStatus === 'ready' && !!persisted.profile && !!persisted.graph;

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [brainStatus, setBrainStatus] = useState<BrainStatusKind>(restored ? 'ready' : 'idle');
  const [brainMode, setBrainMode] = useState<'cognee' | 'demo'>(restored ? (persisted.brainMode ?? 'demo') : 'demo');
  const [buildStep, setBuildStep] = useState(0);
  const [profile, setProfile] = useState<PersonalProfile | null>(restored ? (persisted.profile ?? null) : null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>(restored ? (persisted.opportunities ?? []) : []);
  const [graph, setGraph] = useState<FutureGraph | null>(restored ? (persisted.graph ?? null) : null);
  const [baselineGraph, setBaselineGraph] = useState<FutureGraph | null>(restored ? (persisted.baselineGraph ?? null) : null);
  const [history, setHistory] = useState<FutureGraph[]>(restored ? (persisted.history ?? []) : []);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [changedNodeIds, setChangedNodeIds] = useState<string[]>([]);
  const [chosenNodeIds, setChosenNodeIds] = useState<string[]>(restored ? (persisted.chosenNodeIds ?? []) : []);
  const [rejectedAttributeIds, setRejectedAttributeIds] = useState<string[]>(restored ? (persisted.rejectedAttributeIds ?? []) : []);
  const [plan, setPlan] = useState<ActionPlan | null>(restored ? (persisted.plan ?? null) : null);
  const [planConfirmed, setPlanConfirmed] = useState(restored ? !!persisted.planConfirmed : false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [pendingSources, setPendingSources] = useState<PersonalSource[]>(restored ? (persisted.pendingSources ?? []) : []);
  const [usingApi, setUsingApi] = useState(false);
  const [visitedStages, setVisitedStages] = useState<number[]>(restored ? (persisted.visitedStages ?? [1]) : [1]);
  const [highlightId, setHighlightIdState] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  // Persist the session so a page refresh during a demo keeps the built brain and unlocked stages.
  useEffect(() => {
    try {
      if (brainStatus === 'idle') { sessionStorage.removeItem(PERSIST_KEY); return; }
      if (brainStatus !== 'ready') return;
      const snap: Persisted = { brainStatus, brainMode, profile, opportunities, graph, baselineGraph, history, chosenNodeIds, rejectedAttributeIds, plan, planConfirmed, visitedStages, pendingSources };
      sessionStorage.setItem(PERSIST_KEY, JSON.stringify(snap));
    } catch { /* storage unavailable: ignore */ }
  }, [brainStatus, brainMode, profile, opportunities, graph, baselineGraph, history, chosenNodeIds, rejectedAttributeIds, plan, planConfirmed, visitedStages, pendingSources]);
  const toastTimer = useRef<number | null>(null);
  const highlightTimer = useRef<number | null>(null);

  const markStageVisited = useCallback((stage: number) => {
    setVisitedStages((v) => (v.includes(stage) ? v : [...v, stage]));
  }, []);
  const setHighlightId = useCallback((id: string | null) => {
    setHighlightIdState(id);
    if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
    if (id) highlightTimer.current = window.setTimeout(() => setHighlightIdState(null), 4000);
  }, []);

  const showToast = useCallback((message: string, tone: ToastState['tone'] = 'info') => {
    setToast({ id: Date.now(), message, tone });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);
  const dismissToast = useCallback(() => setToast(null), []);

  const runBuildAnimation = useCallback(async () => {
    setBrainStatus('building');
    for (let i = 0; i < BUILD_STEPS.length; i++) {
      setBuildStep(i);
      await sleep(i === BUILD_STEPS.length - 1 ? 500 : 650);
    }
    setBrainStatus('ready');
  }, []);

  const hydrate = useCallback(async (p: PersonalProfile, fromApi: boolean) => {
    const [opp, g] = await Promise.all([api.opportunities(), api.graph()]);
    setProfile(p);
    setOpportunities(opp.data);
    setGraph(g.data);
    setBaselineGraph(g.data);
    setHistory([]);
    setSimulation(null);
    setChangedNodeIds([]);
    setChosenNodeIds([]);
    setPlan(null);
    setPlanConfirmed(false);
    setBrainMode(p.brain_mode ?? 'demo');
    setUsingApi(fromApi);
  }, []);

  const loadDemo = useCallback(async () => {
    setPendingSources(demoProfile.sources);
    const anim = runBuildAnimation();
    await hydrate(demoProfile, false);
    setOpportunities(demoOpportunities);
    setGraph(demoGraph);
    setBaselineGraph(demoGraph);
    setBrainMode('demo');
    await anim;
  }, [hydrate, runBuildAnimation]);

  const buildBrain = useCallback(
    async (payload: IngestPayload) => {
      const anim = runBuildAnimation();
      const res = DEMO_MODE && !payload.files.length && !payload.notes && !payload.use_sample_calendar
        ? { data: demoProfile, fromApi: false }
        : await api.ingest(payload);
      await hydrate(res.data, res.fromApi);
      await anim;
    },
    [hydrate, runBuildAnimation],
  );

  const ensureLoaded = useCallback(async () => {
    if (graph && profile) return;
    await loadDemo();
  }, [graph, profile, loadDemo]);

  const addPendingSource = useCallback((s: PersonalSource) => setPendingSources((p) => [...p, s]), []);
  const removePendingSource = useCallback((id: string) => setPendingSources((p) => p.filter((s) => s.id !== id)), []);

  const applyChange = useCallback(
    async (change: DecisionChange) => {
      if (!graph) return null;
      const res = await api.simulate(graph, change);
      const sim = res.data;
      setHistory((h) => [...h, graph]);
      setGraph(sim.after);
      setSimulation(sim);
      setChangedNodeIds(sim.changed_nodes.map((c) => c.node_id));
      if (change.change_type === 'choose') setChosenNodeIds((c) => (c.includes(change.node_id) ? c : [...c, change.node_id]));
      if (change.change_type === 'reject') setChosenNodeIds((c) => c.filter((id) => id !== change.node_id));
      window.setTimeout(() => setChangedNodeIds([]), 3000);
      return sim;
    },
    [graph],
  );

  const undo = useCallback(() => {
    setHistory((h) => {
      if (!h.length) return h;
      const prev = h[h.length - 1];
      setGraph(prev);
      setSimulation(null);
      return h.slice(0, -1);
    });
  }, []);

  const resetGraph = useCallback(() => {
    if (baselineGraph) setGraph(baselineGraph);
    setHistory([]);
    setSimulation(null);
    setChosenNodeIds([]);
    setChangedNodeIds([]);
  }, [baselineGraph]);

  const resetDemo = useCallback(() => {
    setBrainStatus('idle');
    setBuildStep(0);
    setProfile(null);
    setOpportunities([]);
    setGraph(null);
    setBaselineGraph(null);
    setHistory([]);
    setSelectedNodeId(null);
    setSimulation(null);
    setChangedNodeIds([]);
    setChosenNodeIds([]);
    setRejectedAttributeIds([]);
    setPlan(null);
    setPlanConfirmed(false);
    setPendingSources([]);
    setVisitedStages([1]);
    setHighlightIdState(null);
    showToast('Demo reset. Your scenario map has been cleared.', 'info');
  }, [showToast]);

  const unlockedStages = useMemo(() => {
    const stages = [1];
    if (brainStatus === 'ready') stages.push(2);
    if (brainStatus === 'ready' && visitedStages.includes(2)) stages.push(3);
    if (stages.includes(3) && (visitedStages.includes(3) || simulation !== null || history.length > 0)) stages.push(4);
    return stages;
  }, [brainStatus, visitedStages, simulation, history.length]);

  const searchIndex = useMemo<SearchItem[]>(() => {
    const items: SearchItem[] = [];
    const sourceName = (id: string) => profile?.sources.find((s) => s.id === id)?.name ?? '';
    for (const e of profile?.upcoming_deadlines ?? []) {
      items.push({
        id: `event:${e.id}`, category: 'event', title: e.title,
        subtitle: `${e.kind} · ${e.start.slice(0, 10)}${e.location ? ' · ' + e.location : ''}`,
        keywords: `${e.kind} ${e.location ?? ''} ${sourceName(e.source_id)}`,
        target: { kind: 'event', id: e.id, path: '/present', sourceRef: sourceName(e.source_id) },
      });
    }
    for (const ev of profile?.evidence ?? []) {
      items.push({
        id: `evidence:${ev.id}`, category: 'evidence', title: ev.text,
        subtitle: `${sourceName(ev.source_id)}${ev.date ? ' · ' + ev.date : ''}`,
        keywords: sourceName(ev.source_id),
        target: { kind: 'evidence', id: ev.id, path: '/present', sourceRef: sourceName(ev.source_id) },
      });
    }
    for (const src of profile?.sources ?? []) {
      items.push({
        id: `evidence:${src.id}`, category: 'evidence', title: src.name,
        subtitle: src.excerpt, keywords: `${src.type} source`,
        target: { kind: 'evidence', id: src.id, path: '/present', sourceRef: src.name },
      });
    }
    for (const a of profile?.attributes ?? []) {
      items.push({
        id: `attribute:${a.id}`, category: 'attribute', title: a.label,
        subtitle: `${a.kind} · ${Math.round(a.confidence * 100)}% confidence`,
        keywords: a.kind,
        target: { kind: 'attribute', id: a.id, path: '/present' },
      });
    }
    for (const o of opportunities) {
      items.push({
        id: `opportunity:${o.id}`, category: 'opportunity', title: o.title,
        subtitle: `${o.type} · ${o.organization}${o.deadline ? ' · due ' + o.deadline : ''}`,
        keywords: `${o.type} ${o.organization} ${o.location} ${o.description} ${o.relevance_reasons.join(' ')}`,
        target: { kind: 'opportunity', id: o.id, path: '/future' },
      });
    }
    for (const n of graph?.nodes ?? []) {
      items.push({
        id: `node:${n.id}`, category: 'node', title: n.title,
        subtitle: `${n.category} · ${n.time_horizon} · score ${n.scenario_score}`,
        keywords: `${n.description} ${n.category} ${n.recommended_action}`,
        target: { kind: 'node', id: n.id, path: '/future' },
      });
    }
    const actions: [string, string, string, string][] = [
      ['build', 'Build my brain', 'Load your data and build the knowledge graph', '/brain'],
      ['present', 'Understand my present', 'Commitments, goals and evidence', '/present'],
      ['future', 'Go to Future Map', 'Explore scenarios and decisions', '/future'],
      ['plan', 'Generate action plan', 'Turn chosen paths into next steps', '/plan'],
      ['reset', 'Reset demo', 'Clear the scenario map and start over', '/'],
    ];
    for (const [id, title, subtitle, path] of actions) {
      items.push({ id: `action:${id}`, category: 'action', title, subtitle, keywords: 'go navigate open', target: { kind: 'action', id, path } });
    }
    return items;
  }, [profile, opportunities, graph]);

  const rejectAttribute = useCallback((id: string) => setRejectedAttributeIds((r) => (r.includes(id) ? r : [...r, id])), []);
  const restoreAttribute = useCallback((id: string) => setRejectedAttributeIds((r) => r.filter((x) => x !== id)), []);

  const generatePlan = useCallback(async () => {
    if (!graph) return null;
    const res = await api.plan(graph, chosenNodeIds, opportunities);
    setPlan(res.data);
    setPlanConfirmed(false);
    return res.data;
  }, [graph, chosenNodeIds, opportunities]);

  const confirmPlan = useCallback(() => {
    setPlanConfirmed(true);
    showToast('Plan saved to your brain', 'success');
  }, [showToast]);

  const value = useMemo(
    () => ({
      demoMode: DEMO_MODE || brainMode === 'demo',
      brainStatus,
      brainMode,
      buildStep,
      profile,
      opportunities,
      graph,
      baselineGraph,
      history,
      selectedNodeId,
      simulation,
      changedNodeIds,
      chosenNodeIds,
      rejectedAttributeIds,
      plan,
      planConfirmed,
      toast,
      pendingSources,
      usingApi,
      unlockedStages,
      visitedStages,
      highlightId,
      searchOpen,
      searchIndex,
      markStageVisited,
      setHighlightId,
      setSearchOpen,
      loadDemo,
      buildBrain,
      addPendingSource,
      removePendingSource,
      ensureLoaded,
      selectNode: setSelectedNodeId,
      applyChange,
      undo,
      resetGraph,
      resetDemo,
      rejectAttribute,
      restoreAttribute,
      generatePlan,
      confirmPlan,
      showToast,
      dismissToast,
    }),
    [
      brainStatus, brainMode, buildStep, profile, opportunities, graph, baselineGraph, history, selectedNodeId,
      simulation, changedNodeIds, chosenNodeIds, rejectedAttributeIds, plan, planConfirmed, toast, pendingSources, usingApi,
      loadDemo, buildBrain, addPendingSource, removePendingSource, ensureLoaded, applyChange, undo, resetGraph, resetDemo,
      rejectAttribute, restoreAttribute, generatePlan, confirmPlan, showToast, dismissToast,
      unlockedStages, visitedStages, highlightId, searchOpen, searchIndex, markStageVisited, setHighlightId,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAppState must be used inside AppStateProvider');
  return ctx;
}
