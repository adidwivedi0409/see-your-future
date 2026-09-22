import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ChevronDown, ChevronRight, Cpu, Loader2, Play } from 'lucide-react';
import type { TraceStep } from '../types';

interface Props {
  steps: TraceStep[];
  model: string;
  mode: 'demo' | 'strands';
  busy?: boolean;
  onRerun: () => void;
  defaultOpen?: boolean;
  className?: string;
}

const TOOL_COLORS: Record<string, string> = {
  recall_personal_context: '#22d3ee',
  analyze_schedule: '#fbbf24',
  find_opportunities: '#60a5fa',
  generate_future_paths: '#a78bfa',
  simulate_decision: '#f472b6',
  create_action_plan: '#34d399',
  remember_user_feedback: '#f97316',
};

export default function NavigatorTrace({ steps, model, mode, busy, onRerun, defaultOpen = true, className = '' }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [visible, setVisible] = useState(0);
  const [runKey, setRunKey] = useState(0);

  // Restart the typing effect when a fresh run replaces the steps (first step id resets); continue when steps are appended.
  useEffect(() => {
    if (steps.length < visible) {
      setVisible(0);
      setRunKey((k) => k + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps]);

  useEffect(() => {
    if (visible >= steps.length) return;
    const t = setTimeout(() => setVisible((v) => Math.min(v + 1, steps.length)), 250);
    return () => clearTimeout(t);
  }, [visible, steps.length, runKey]);

  const total = steps.reduce((a, s) => a + s.duration_ms, 0);
  const typing = visible < steps.length || busy;

  return (
    <div className={`overflow-hidden rounded-xl border border-white/15 bg-black font-mono text-[11.5px] text-emerald-100/90 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] ${className}`}>
      <button className="flex w-full items-center gap-2 border-b border-white/10 px-3 py-2 text-left hover:bg-white/5" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? <ChevronDown size={13} className="text-white/60" /> : <ChevronRight size={13} className="text-white/60" />}
        <span className="text-[10.5px] font-bold tracking-[0.18em] text-white">FUTURE NAVIGATOR · AWS STRANDS</span>
        <span className="ml-auto flex items-center gap-1.5">
          <span className="rounded border border-white/20 px-1.5 py-0.5 text-[10px] text-white/70">FutureNavigatorAgent</span>
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${mode === 'strands' ? 'bg-violet-500/30 text-violet-200' : 'bg-amber-400/20 text-amber-200'}`} title={mode === 'strands' ? 'Live Strands agent loop' : 'Deterministic demo pipeline, same tool order'}>
            {mode === 'strands' ? model : 'demo mode'}
          </span>
        </span>
      </button>
      {open && (
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 text-white/50">
            <Cpu size={12} />
            <span>$ strands run FutureNavigatorAgent --tools 7 --user aditya</span>
          </div>
          <ol className="mt-1.5 space-y-1">
            {steps.slice(0, visible).map((s) => (
              <motion.li key={`${runKey}-${s.step}-${s.tool}`} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.18 }} className="grid grid-cols-[14px_1fr_auto] items-start gap-2">
                <Check size={12} className="mt-0.5 text-emerald-400" aria-label="done" />
                <div className="min-w-0">
                  <span className="text-white/40">[{String(s.step).padStart(2, '0')}]</span>{' '}
                  <span className="font-semibold" style={{ color: TOOL_COLORS[s.tool] ?? '#e2e8f0' }}>{s.tool}</span>
                  <span className="text-white/40">(</span>
                  <span className="text-white/60">{s.input_summary}</span>
                  <span className="text-white/40">)</span>
                  <div className="truncate pl-1 text-emerald-200/90" title={s.output_summary}>→ {s.output_summary}</div>
                </div>
                <span className="text-white/40">{s.duration_ms} ms</span>
              </motion.li>
            ))}
            {typing && (
              <li className="flex items-center gap-2 text-white/50">
                <Loader2 size={12} className="animate-spin" /> <span className="animate-pulse">{busy ? 'agent reasoning…' : '▌'}</span>
              </li>
            )}
          </ol>
          <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2">
            <span className="text-white/45">
              {visible}/{steps.length} tool calls · {total} ms · scenario likelihood, not prediction
            </span>
            <button className="flex items-center gap-1 rounded border border-emerald-400/40 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-300 hover:bg-emerald-400/10 disabled:opacity-40" onClick={onRerun} disabled={busy}>
              <Play size={10} /> Re-run Navigator
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
