import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Check, ChevronDown, Clock, Flag, Info, ListPlus, Minus, MoveRight, Plus, RotateCcw, SlidersHorizontal, Undo2, X, XCircle } from 'lucide-react';
import { SCENARIO_TOOLTIP, type DecisionChange, type FutureNode, type SimulationResult } from '../types';
import ScoreBadge from './ScoreBadge';
import { useAppState } from '../hooks/useAppState';
import { CATEGORY_COLORS } from './FutureNodeCard';
import { FACTOR_LABELS, type FactorName } from '../utils/scoring';

interface Props {
  node: FutureNode;
  simulation: SimulationResult | null;
  busy: boolean;
  chosen: boolean;
  onChange: (change: DecisionChange) => void;
  onClose: () => void;
}

export default function DecisionPanel({ node, simulation, busy, chosen, onChange, onClose }: Props) {
  const [hours, setHours] = useState(3);
  const [moreOpen, setMoreOpen] = useState(false);
  const { undo, resetGraph, history } = useAppState();
  const color = CATEGORY_COLORS[node.category];
  const isDecision = node.category === 'decision';
  const send = (change_type: DecisionChange['change_type'], value: DecisionChange['value'] = null, note: string | null = null) =>
    onChange({ node_id: node.id, change_type, value, note });

  return (
    <motion.aside
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 40, opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="glass glass-strong flex h-full w-full flex-col overflow-hidden"
    >
      <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] p-4">
        <div>
          <span className="chip" style={{ borderColor: `${color}66`, color }}>
            {node.category} · {node.time_horizon}
          </span>
          <h3 className="mt-2 text-lg font-bold leading-tight">{node.title}</h3>
          <p className="mt-1 text-sm text-slate-300">{node.description}</p>
        </div>
        <button className="btn btn-sm" onClick={onClose} aria-label="Close">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <div className="flex items-start justify-between gap-3">
          <ScoreBadge score={node.scenario_score} size="lg" />
          <span className="group relative mt-1 shrink-0 text-[var(--muted)]" tabIndex={0} aria-label="What is scenario likelihood?">
            <Info size={15} className="cursor-help" />
            <span className="pointer-events-none absolute right-0 top-6 z-20 w-64 rounded-lg border border-[var(--border)] bg-[rgba(8,8,10,0.97)] p-2.5 text-[11px] leading-relaxed text-slate-300 opacity-0 shadow-xl transition group-hover:opacity-100 group-focus:opacity-100">
              <span className="mono-label block text-[9px] text-violet-300">Scenario likelihood</span>
              {SCENARIO_TOOLTIP}
            </span>
          </span>
        </div>

        {isDecision && (
          <section className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Change this decision</h4>
            <div className="grid grid-cols-2 gap-2">
              <button className={`btn btn-sm ${chosen ? 'btn-primary' : ''}`} disabled={busy} onClick={() => send('choose')}>
                <Check size={14} /> {chosen ? 'Chosen' : 'Choose this path'}
              </button>
              <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => send('reject')}>
                <XCircle size={14} /> Reject this path
              </button>
            </div>

            <div className="rounded-xl border border-[var(--border)] p-3">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5">
                  <Clock size={14} className="text-cyan-300" /> Weekly time
                </span>
                <span className="flex items-center gap-1">
                  <button className="grid h-6 w-6 place-items-center rounded-md border border-[var(--border)] text-slate-300 hover:bg-white/10 disabled:opacity-40" disabled={hours <= 0} onClick={() => setHours((h) => Math.max(0, h - 1))} aria-label="Less time">
                    <Minus size={12} />
                  </button>
                  <span className="w-9 text-center font-semibold tabular-nums">{hours}h</span>
                  <button className="grid h-6 w-6 place-items-center rounded-md border border-[var(--border)] text-slate-300 hover:bg-white/10 disabled:opacity-40" disabled={hours >= 10} onClick={() => setHours((h) => Math.min(10, h + 1))} aria-label="More time">
                    <Plus size={12} />
                  </button>
                </span>
              </div>
              <input type="range" min={0} max={10} step={1} value={hours} onChange={(e) => setHours(Number(e.target.value))} className="w-full" />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button className="btn btn-sm" disabled={busy || hours === 0} onClick={() => send('increase_time', hours)}>
                  <Plus size={14} /> Spend +{hours}h/wk
                </button>
                <button className="btn btn-sm" disabled={busy || hours === 0} onClick={() => send('decrease_time', hours)}>
                  <Minus size={14} /> Free up {hours}h/wk
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border)]">
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)] hover:text-white"
                onClick={() => setMoreOpen((o) => !o)}
                aria-expanded={moreOpen}
              >
                <span className="flex items-center gap-1.5"><SlidersHorizontal size={13} /> More adjustments</span>
                <ChevronDown size={14} className={`transition ${moreOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence initial={false}>
                {moreOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                    <div className="grid grid-cols-2 gap-2 px-3 pb-3">
                      <button className="btn btn-sm" disabled={busy} onClick={() => send('move_event', null, 'Moved to a non-conflicting slot')}>
                        <MoveRight size={14} /> Move event
                      </button>
                      <button className="btn btn-sm" disabled={busy} onClick={() => send('add_prep_task')}>
                        <ListPlus size={14} /> Add a preparation task
                      </button>
                      <button className="btn btn-sm" disabled={busy} onClick={() => send('change_priority', 'high')}>
                        <Flag size={14} className="text-emerald-400" /> Priority: high
                      </button>
                      <button className="btn btn-sm" disabled={busy} onClick={() => send('change_priority', 'low')}>
                        <Flag size={14} className="text-amber-300" /> Priority: low
                      </button>
                    </div>
                    {node.assumptions.length > 0 && (
                      <div className="border-t border-[var(--border)] px-3 py-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">Mark an assumption incorrect</span>
                        <ul className="mt-1.5 space-y-1">
                          {node.assumptions.map((a) => (
                            <li key={a} className="flex items-start justify-between gap-2 text-xs text-slate-300">
                              <span>{a}</span>
                              <button className="shrink-0 text-[var(--muted)] hover:text-rose-300" title="Mark this assumption incorrect" disabled={busy} onClick={() => send('mark_assumption_incorrect', a)}>
                                <X size={13} />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>
        )}

        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Assumptions</h4>
          {node.assumptions.length === 0 && <p className="text-sm text-slate-400">No open assumptions.</p>}
          <ul className="space-y-1.5">
            {node.assumptions.map((a) => (
              <li key={a} className="flex items-start justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </section>

        {simulation && (
          <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-cyan-400/30 bg-cyan-400/5 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Before → After</h4>
              <span className="flex items-center gap-1">
                <button className="btn btn-sm !px-2 !py-1 text-xs" disabled={busy || history.length === 0} onClick={undo} title="Undo last change">
                  <Undo2 size={12} /> Undo
                </button>
                <button className="btn btn-sm !px-2 !py-1 text-xs" disabled={busy} onClick={resetGraph} title="Reset to baseline">
                  <RotateCcw size={12} /> Reset
                </button>
              </span>
            </div>
            <ul className="space-y-1 text-sm">
              {[...simulation.changed_nodes].sort((a, b) => Math.abs(b.after_score - b.before_score) - Math.abs(a.after_score - a.before_score)).map((c) => (
                <li key={c.node_id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{c.title}</span>
                  <span className="flex items-center gap-1 tabular-nums">
                    <span className="text-slate-400">{c.before_score}</span>
                    <ArrowRight size={12} />
                    <span className={c.after_score >= c.before_score ? 'text-emerald-300' : 'text-rose-300'}>{c.after_score}</span>
                  </span>
                </li>
              ))}
              <li className="flex items-center justify-between gap-2 border-t border-[var(--border)] pt-1">
                <span>Schedule pressure</span>
                <span className="flex items-center gap-1">
                  <span className="text-slate-400">{simulation.schedule_pressure_before}</span>
                  <ArrowRight size={12} />
                  <span className={simulation.schedule_pressure_after === 'High' ? 'text-rose-300' : simulation.schedule_pressure_after === 'Medium' ? 'text-amber-300' : 'text-emerald-300'}>
                    {simulation.schedule_pressure_after}
                  </span>
                </span>
              </li>
            </ul>
            <p className="mt-2 text-xs text-slate-300">{simulation.explanation}</p>
            {simulation.changed_nodes.length > 0 && (
              <details className="mt-2 text-xs text-slate-400">
                <summary className="cursor-pointer">Factor movements</summary>
                <ul className="mt-1 space-y-1">
                  {simulation.changed_nodes.map((c) => (
                    <li key={c.node_id}>{c.explanation}</li>
                  ))}
                </ul>
              </details>
            )}
          </motion.section>
        )}

        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Score factors</h4>
          <ul className="space-y-1.5">
            {node.score_factors.map((f) => (
              <li key={f.name} className="text-xs">
                <div className="flex justify-between">
                  <span>{FACTOR_LABELS[f.name as FactorName] ?? f.name}</span>
                  <span className="tabular-nums text-slate-400">
                    {f.value.toFixed(2)} × {f.weight > 0 ? '+' : ''}{f.weight.toFixed(2)}
                  </span>
                </div>
                <div className="mt-1 h-1 rounded-full bg-white/10">
                  <div className="h-1 rounded-full" style={{ width: `${f.value * 100}%`, background: f.weight < 0 ? 'var(--coral)' : color }} />
                </div>
              </li>
            ))}
          </ul>
        </section>

        {(node.positive_effects.length > 0 || node.tradeoffs.length > 0) && (
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-emerald-300">Positive effects</h4>
              <ul className="space-y-1 text-sm text-slate-300">{node.positive_effects.map((p) => <li key={p}>• {p}</li>)}</ul>
            </div>
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-amber-300">Trade-offs</h4>
              <ul className="space-y-1 text-sm text-slate-300">{node.tradeoffs.map((p) => <li key={p}>• {p}</li>)}</ul>
            </div>
          </section>
        )}

        <section className="rounded-xl border border-[var(--border)] p-3 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Recommended action</span>
          <p className="mt-1">{node.recommended_action}</p>
        </section>
      </div>
    </motion.aside>
  );
}
