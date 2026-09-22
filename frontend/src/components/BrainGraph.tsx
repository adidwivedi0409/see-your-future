import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { demoAttributes, demoCalendar, demoOpportunities, demoSources } from '../data/demo';
import type { BrainGraphData, BrainGraphEdge, BrainGraphNode, BrainNodeKind } from '../types';

export const KIND_COLORS: Record<BrainNodeKind, string> = {
  source: '#22d3ee',
  event: '#fbbf24',
  goal: '#34d399',
  interest: '#a78bfa',
  attribute: '#f472b6',
  opportunity: '#60a5fa',
};

/** Client-side mirror of GET /api/brain/graph (demo mode) built from src/data/demo.ts. */
export function buildLocalBrainGraph(): BrainGraphData {
  const nodes: BrainGraphNode[] = [{ id: 'me', label: 'Aditya Dwivedi', kind: 'attribute' }];
  const edges: BrainGraphEdge[] = [];
  const seen = new Set(['me']);
  const add = (n: BrainGraphNode) => {
    if (!seen.has(n.id)) {
      seen.add(n.id);
      nodes.push(n);
    }
  };
  demoSources.forEach((s) => add({ id: s.id, label: s.name, kind: 'source' }));
  demoAttributes.forEach((a) => {
    const kind: BrainNodeKind = a.kind === 'goal' ? 'goal' : a.kind === 'interest' || a.kind === 'strength' ? 'interest' : 'attribute';
    add({ id: a.id, label: a.label, kind });
    edges.push({ source: 'me', target: a.id, relation: a.kind });
    a.source_ids.forEach((sid) => seen.has(sid) && edges.push({ source: sid, target: a.id, relation: 'evidence' }));
  });
  let cluster = false;
  demoCalendar.forEach((ev) => {
    if (ev.kind === 'deadline' || ev.kind === 'interview' || ev.kind === 'event') {
      add({ id: ev.id, label: ev.title, kind: 'event' });
      edges.push({ source: ev.source_id, target: ev.id, relation: 'recorded_in' });
      if (ev.kind !== 'event') {
        if (!cluster) {
          add({ id: 'cluster_week', label: 'Deadline cluster · this week', kind: 'event' });
          cluster = true;
        }
        edges.push({ source: ev.id, target: 'cluster_week', relation: 'clusters' });
      }
    }
  });
  if (cluster) demoAttributes.filter((a) => a.kind === 'constraint' || a.kind === 'habit' || a.kind === 'overload').forEach((a) => edges.push({ source: 'cluster_week', target: a.id, relation: 'supports' }));
  const goals = demoAttributes.filter((a) => a.kind === 'goal').map((a) => a.id);
  const interests = demoAttributes.filter((a) => a.kind === 'interest' || a.kind === 'strength').map((a) => a.id);
  demoOpportunities.forEach((o) => {
    add({ id: o.id, label: o.title, kind: 'opportunity' });
    const targets = o.type === 'research' || o.type === 'event' || o.type === 'hackathon' ? interests : goals;
    (targets.length ? targets : goals).slice(0, 2).forEach((t) => edges.push({ source: t, target: o.id, relation: `relevance ${Math.round(o.relevance_score)}` }));
  });
  return { mode: 'demo', nodes, edges };
}

interface Props {
  data: BrainGraphData;
  height?: number;
  className?: string;
}

interface Pt { x: number; y: number; vx: number; vy: number }

function layoutForce(data: BrainGraphData, W: number, H: number): Record<string, Pt> {
  const pts: Record<string, Pt> = {};
  const n = data.nodes.length;
  // seed on concentric rings by kind so the result is stable and readable
  const ringOf: Record<BrainNodeKind, number> = { attribute: 0.22, goal: 0.3, interest: 0.3, source: 0.55, event: 0.62, opportunity: 0.78 };
  data.nodes.forEach((nd, i) => {
    const r = (nd.id === 'me' ? 0 : ringOf[nd.kind]) * Math.min(W, H) * 0.5;
    const a = (i / n) * Math.PI * 2 + (nd.kind === 'opportunity' ? 0.4 : 0);
    pts[nd.id] = { x: W / 2 + r * Math.cos(a), y: H / 2 + r * Math.sin(a), vx: 0, vy: 0 };
  });
  const ids = data.nodes.map((d) => d.id);
  for (let it = 0; it < 60; it++) {
    const k = 1 - it / 60;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = pts[ids[i]], b = pts[ids[j]];
        let dx = a.x - b.x, dy = a.y - b.y;
        let d2 = dx * dx + dy * dy || 0.01;
        if (d2 < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 1; }
        const f = (2600 * k) / d2;
        const fx = dx * f, fy = dy * f;
        a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
      }
    }
    data.edges.forEach((e) => {
      const a = pts[e.source], b = pts[e.target];
      if (!a || !b) return;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = ((d - 80) / d) * 0.03 * k;
      a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f;
    });
    ids.forEach((id) => {
      const p = pts[id];
      // gentle pull to centre + damping
      p.vx += (W / 2 - p.x) * 0.004; p.vy += (H / 2 - p.y) * 0.004;
      p.x += p.vx * 0.5; p.y += p.vy * 0.5; p.vx *= 0.6; p.vy *= 0.6;
      p.x = Math.max(16, Math.min(W - 16, p.x)); p.y = Math.max(16, Math.min(H - 16, p.y));
    });
  }
  if (pts.me) { pts.me.x = W / 2; pts.me.y = H / 2; }
  return pts;
}

export default function BrainGraph({ data, height = 300, className = '' }: Props) {
  const W = 520, H = height;
  const [hover, setHover] = useState<string | null>(null);
  const [pos, setPos] = useState<Record<string, Pt>>({});
  useEffect(() => { setPos(layoutForce(data, W, H)); }, [data, H]);
  const counts = useMemo(() => data.nodes.reduce<Record<string, number>>((acc, n) => ({ ...acc, [n.kind]: (acc[n.kind] ?? 0) + 1 }), {}), [data]);
  const neighbours = useMemo(() => {
    if (!hover) return new Set<string>();
    const s = new Set<string>([hover]);
    data.edges.forEach((e) => { if (e.source === hover) s.add(e.target); if (e.target === hover) s.add(e.source); });
    return s;
  }, [hover, data]);
  const hovered = data.nodes.find((n) => n.id === hover);
  const ready = Object.keys(pos).length > 0;

  return (
    <div className={`rounded-xl border border-white/10 bg-black/30 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <span className="text-[10.5px] font-bold tracking-[0.18em] text-white">COGNEE PERSONAL BRAIN · knowledge graph</span>
        <span className="flex items-center gap-1.5 text-[10.5px] text-white/60">
          <span>{data.nodes.length} nodes · {data.edges.length} edges</span>
          <span className={`rounded px-1.5 py-0.5 font-semibold ${data.mode === 'cognee' ? 'bg-emerald-400/20 text-emerald-200' : 'bg-amber-400/20 text-amber-200'}`}>{data.mode === 'cognee' ? 'cognee' : 'demo graph'}</span>
        </span>
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" onMouseLeave={() => setHover(null)}>
          {ready && data.edges.map((e, i) => {
            const a = pos[e.source], b = pos[e.target];
            if (!a || !b) return null;
            const lit = hover ? neighbours.has(e.source) && neighbours.has(e.target) && (e.source === hover || e.target === hover) : false;
            return (
              <motion.line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={lit ? '#e2e8f0' : 'rgba(255,255,255,0.14)'} strokeWidth={lit ? 1.4 : 0.8}
                initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: hover && !lit ? 0.35 : 1 }} transition={{ duration: 0.8, delay: 0.2 + (i / data.edges.length) * 0.6 }} />
            );
          })}
          {ready && data.nodes.map((n, i) => {
            const p = pos[n.id];
            const r = n.id === 'me' ? 9 : n.kind === 'opportunity' || n.kind === 'goal' ? 6 : 5;
            const dim = hover ? !neighbours.has(n.id) : false;
            return (
              <motion.g key={n.id} initial={{ opacity: 0, scale: 0 }} animate={{ opacity: dim ? 0.3 : 1, scale: 1 }} transition={{ delay: (i / data.nodes.length) * 0.7, type: 'spring', stiffness: 220, damping: 16 }} style={{ transformOrigin: `${p.x}px ${p.y}px` }}
                onMouseEnter={() => setHover(n.id)} className="cursor-pointer">
                <circle cx={p.x} cy={p.y} r={r + 5} fill={KIND_COLORS[n.kind]} opacity={hover === n.id ? 0.35 : 0.12} />
                <circle cx={p.x} cy={p.y} r={r} fill={KIND_COLORS[n.kind]} stroke="#05070f" strokeWidth={1.2} />
                {(n.id === 'me' || n.kind === 'goal' || hover === n.id) && (
                  <text x={p.x} y={p.y - r - 5} textAnchor="middle" fontSize={9} fill="#e5e7eb" style={{ pointerEvents: 'none' }}>{n.label.length > 30 ? n.label.slice(0, 29) + '…' : n.label}</text>
                )}
              </motion.g>
            );
          })}
        </svg>
        <div className="pointer-events-none absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2 text-[10px]">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(KIND_COLORS) as BrainNodeKind[]).map((k) => (
              <span key={k} className="flex items-center gap-1 text-white/60">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: KIND_COLORS[k] }} /> {k} {counts[k] ?? 0}
              </span>
            ))}
          </div>
          <span className="max-w-[45%] truncate rounded bg-black/70 px-2 py-1 text-white/85">
            {hovered ? `${hovered.kind} · ${hovered.label}` : 'hover a node'}
          </span>
        </div>
      </div>
    </div>
  );
}
