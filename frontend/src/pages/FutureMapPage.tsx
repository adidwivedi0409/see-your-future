import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowRight, Briefcase, Gauge, RotateCcw, Undo2 } from 'lucide-react';
import FutureNodeCard, { CATEGORY_COLORS, type FutureFlowNode } from '../components/FutureNodeCard';
import DecisionPanel from '../components/DecisionPanel';
import OpportunityCard from '../components/OpportunityCard';
import NavigatorTrace from '../components/NavigatorTrace';
import { api, demoTrace } from '../services/api';
import Legend from '../components/Legend';
import { useAppState } from '../hooks/useAppState';
import type { DecisionChange, FutureGraph, TimeHorizon, TraceStep } from '../types';
import { SCENARIO_TOOLTIP } from '../types';
import { depthMap } from '../utils/scoring';

const nodeTypes: NodeTypes = { future: FutureNodeCard };
const HORIZONS: (TimeHorizon | 'all')[] = ['all', 'now', 'days', 'weeks', 'months'];
const EDGE_COLORS = { leads_to: '#34d399', enables: '#8b5cf6', risks: '#fb7185' } as const;

function layout(graph: FutureGraph): Record<string, { x: number; y: number }> {
  const depth = depthMap(graph);
  const order: string[] = [];
  const seen = new Set<string>();
  const queue = [graph.root_id];
  seen.add(graph.root_id);
  while (queue.length) {
    const cur = queue.shift()!;
    order.push(cur);
    graph.edges.filter((e) => e.source === cur).forEach((e) => {
      if (!seen.has(e.target)) {
        seen.add(e.target);
        queue.push(e.target);
      }
    });
  }
  graph.nodes.forEach((n) => {
    if (!seen.has(n.id)) order.push(n.id);
  });
  const layers: Record<number, string[]> = {};
  order.forEach((id) => {
    const d = depth[id] ?? 0;
    (layers[d] = layers[d] ?? []).push(id);
  });
  const pos: Record<string, { x: number; y: number }> = {};
  const GAP_Y = 150;
  Object.entries(layers).forEach(([d, ids]) => {
    const n = ids.length;
    ids.forEach((id, i) => {
      pos[id] = { x: Number(d) * 330, y: (i - (n - 1) / 2) * GAP_Y };
    });
  });
  return pos;
}

export default function FutureMapPage() {
  const navigate = useNavigate();
  const {
    graph, profile, brainStatus, ensureLoaded, opportunities, selectedNodeId, selectNode,
    applyChange, simulation, changedNodeIds, chosenNodeIds, undo, resetGraph, history, showToast,
  } = useAppState();
  const [horizon, setHorizon] = useState<TimeHorizon | 'all'>('all');
  const [panel, setPanel] = useState<'decision' | 'opportunities'>('opportunities');
  const [busy, setBusy] = useState(false);
  const [trace, setTrace] = useState<TraceStep[]>([]);
  const [traceMeta, setTraceMeta] = useState<{ model: string; mode: 'demo' | 'strands' }>({ model: 'demo', mode: 'demo' });
  const [navBusy, setNavBusy] = useState(false);
  const positions = useRef<Record<string, { x: number; y: number }>>({});

  // Load the last FutureNavigatorAgent run (falls back to a local demo trace when the API is offline).
  useEffect(() => {
    let alive = true;
    void api.agentTrace().then(({ data }) => {
      if (!alive) return;
      const steps = data.steps.length ? data.steps : demoTrace(graph ?? undefined);
      setTrace(steps);
      setTraceMeta({ model: data.model, mode: steps[0]?.mode ?? 'demo' });
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rerunNavigator = useCallback(async () => {
    setNavBusy(true);
    setTrace([]);
    try {
      const { data, fromApi } = await api.generate();
      const steps = data.trace && data.trace.length ? data.trace : demoTrace(data);
      setTrace(steps);
      setTraceMeta({ model: fromApi ? (steps[0]?.mode === 'strands' ? 'strands' : 'demo') : 'demo', mode: steps[0]?.mode ?? 'demo' });
      showToast(`Navigator re-ran ${steps.length} tools · ${data.nodes.length} scenarios re-scored`, 'success');
    } finally {
      setNavBusy(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (!graph && brainStatus !== 'building') void ensureLoaded();
  }, [graph, brainStatus, ensureLoaded]);

  useEffect(() => {
    if (selectedNodeId) setPanel('decision');
  }, [selectedNodeId]);

  const flowNodes = useMemo<FutureFlowNode[]>(() => {
    if (!graph) return [];
    const key = graph.nodes.map((n) => n.id).join('|');
    if ((positions.current as { __key?: string }).__key !== key) {
      positions.current = { ...layout(graph), __key: key } as never;
    }
    return graph.nodes.map((n) => ({
      id: n.id,
      type: 'future',
      position: positions.current[n.id] ?? { x: 0, y: 0 },
      data: {
        node: n,
        changed: changedNodeIds.includes(n.id),
        selected: n.id === selectedNodeId,
        chosen: chosenNodeIds.includes(n.id),
        dimmed: horizon !== 'all' && n.time_horizon !== horizon && n.category !== 'present',
      },
    }));
  }, [graph, changedNodeIds, selectedNodeId, chosenNodeIds, horizon]);

  const flowEdges = useMemo<Edge[]>(() => {
    if (!graph) return [];
    return graph.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label ?? undefined,
      animated: true,
      style: { stroke: EDGE_COLORS[e.kind], strokeWidth: 1.8, opacity: 0.8 },
      labelStyle: { fill: '#8f97ad', fontSize: 10 },
      labelBgStyle: { fill: '#0b1124' },
      markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLORS[e.kind] },
    }));
  }, [graph]);

  const [nodes, setNodes, onNodesChange] = useNodesState<FutureFlowNode>(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(flowEdges);
  useEffect(() => {
    setNodes((prev) => {
      const prevPos = new Map(prev.map((p) => [p.id, p.position]));
      return flowNodes.map((n) => ({ ...n, position: prevPos.get(n.id) ?? n.position }));
    });
  }, [flowNodes, setNodes]);
  useEffect(() => setEdges(flowEdges), [flowEdges, setEdges]);

  const selected = graph?.nodes.find((n) => n.id === selectedNodeId) ?? null;

  const onChange = useCallback(
    async (change: DecisionChange) => {
      setBusy(true);
      try {
        const sim = await applyChange(change);
        if (sim) {
          const top = [...sim.changed_nodes]
            .sort((a, b) => Math.abs(b.after_score - b.before_score) - Math.abs(a.after_score - a.before_score))
            .slice(0, 2)
            .map((c) => `${c.title}: ${c.before_score} → ${c.after_score}`)
            .join(' · ');
          showToast(top || 'No scenario changed', sim.changed_nodes.length ? 'success' : 'info');
          setTrace((prev) => [
            ...prev,
            {
              step: prev.length + 1,
              tool: 'simulate_decision',
              input_summary: `${change.change_type} on ${change.node_id}`,
              output_summary: `${sim.changed_nodes.length} scenarios changed, pressure ${sim.schedule_pressure_before} → ${sim.schedule_pressure_after}`,
              duration_ms: 12 + sim.changed_nodes.length * 3,
              mode: prev[0]?.mode ?? 'demo',
            },
          ]);
        }
      } finally {
        setBusy(false);
      }
    },
    [applyChange, showToast],
  );

  if (!graph || !profile) {
    return <div className="grid min-h-[60vh] place-items-center text-slate-400">Building your scenario map…</div>;
  }

  const pressureColor = graph.schedule_pressure === 'High' ? 'var(--coral)' : graph.schedule_pressure === 'Medium' ? 'var(--amber)' : 'var(--green)';

  return (
    <div className="mx-auto flex h-[calc(100vh-61px)] max-w-[1600px] flex-col px-4 py-4 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="chip border-violet-400/40 text-violet-300">Stage 3 · See future</span>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Your scenario map</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">1. Click a blue decision &nbsp;·&nbsp; 2. Adjust it and watch the scores move &nbsp;·&nbsp; 3. Turn it into a plan</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip" style={{ borderColor: `${pressureColor}66`, color: pressureColor }} title="Average workload across scenarios">
            <Gauge size={12} /> Schedule pressure: {graph.schedule_pressure}
          </span>
          <div className="flex items-center gap-1 rounded-full border border-[var(--border)] p-1">
            {HORIZONS.map((h) => (
              <button
                key={h}
                onClick={() => setHorizon(h)}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize transition ${horizon === h ? 'bg-violet-500/30 text-white' : 'text-[var(--muted)] hover:text-white'}`}
              >
                {h}
              </button>
            ))}
          </div>
          {history.length > 0 && (
            <>
              <button className="btn btn-sm" onClick={undo}>
                <Undo2 size={13} /> Undo
              </button>
              <button className="btn btn-sm" onClick={resetGraph}>
                <RotateCcw size={13} /> Reset
              </button>
            </>
          )}
          <button className={`btn btn-sm ${panel === 'opportunities' && !selected ? 'btn-primary' : ''}`} onClick={() => { selectNode(null); setPanel('opportunities'); }}>
            <Briefcase size={13} /> Opportunities ({opportunities.length})
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/plan')}>
            Turn This Future Into a Plan <ArrowRight size={13} />
          </button>
        </div>
      </div>

      <div className="mt-3 grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_400px]">
        <div className="glass relative min-h-[420px] overflow-hidden">
          <div className="absolute left-3 top-3 z-10">
            <Legend />
          </div>
          <div className="absolute bottom-3 left-3 z-10 max-w-xs text-[11px] text-[var(--muted)]" title={SCENARIO_TOOLTIP}>
            Scores are estimates, not predictions. Hover a score for how it is calculated.
          </div>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={(_, n) => {
              selectNode(n.id);
              setPanel('decision');
            }}
            onPaneClick={() => selectNode(null)}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.3}
            maxZoom={1.6}
            proOptions={{ hideAttribution: true }}
            nodesConnectable={false}
          >
            <Background color="rgba(255,255,255,0.06)" gap={28} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>

        <div className="flex min-h-0 flex-col gap-3">
          <NavigatorTrace steps={trace} model={traceMeta.model} mode={traceMeta.mode} busy={navBusy} onRerun={() => void rerunNavigator()} defaultOpen={false} className="shrink-0" />
          <div className="min-h-0 flex-1">
          <AnimatePresence mode="wait">
            {selected && panel === 'decision' ? (
              <DecisionPanel
                key={selected.id}
                node={selected}
                simulation={simulation}
                busy={busy}
                chosen={chosenNodeIds.includes(selected.id)}
                onChange={onChange}
                onClose={() => selectNode(null)}
              />
            ) : (
              <motion.aside key="opps" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="glass glass-strong flex h-full flex-col overflow-hidden">
                <div className="border-b border-[var(--border)] p-4">
                  <h3 className="font-bold">Opportunities near you</h3>
                  <p className="text-xs text-[var(--muted)]">Ranked by relevance to your goals and interests · source: Bright Data (demo cache)</p>
                  <p className="mt-2 text-xs text-slate-300">Click a blue decision node to explore and change a path.</p>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  {[...opportunities].sort((a, b) => b.relevance_score - a.relevance_score).map((o) => (
                    <OpportunityCard key={o.id} opp={o} compact />
                  ))}
                </div>
              </motion.aside>
            )}
          </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
