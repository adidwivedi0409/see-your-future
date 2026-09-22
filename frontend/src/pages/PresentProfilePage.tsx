import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { AlertTriangle, ArrowRight, CalendarClock, HelpCircle, RotateCcw, Undo2 } from 'lucide-react';
import GlassPanel from '../components/GlassPanel';
import EvidenceDrawer from '../components/EvidenceDrawer';
import OpportunityScanner from '../components/OpportunityScanner';
import { useAppState } from '../hooks/useAppState';
import type { ProfileAttribute } from '../types';

const PALETTE = ['#8b5cf6', '#3b82f6', '#22d3ee', '#34d399', '#fbbf24', '#fb7185'];
const KIND_COLORS: Record<ProfileAttribute['kind'], string> = {
  goal: '#3b82f6',
  interest: '#8b5cf6',
  strength: '#34d399',
  habit: '#22d3ee',
  constraint: '#fbbf24',
  growth: '#fb7185',
  commitment: '#60a5fa',
  overload: '#fb7185',
};
const KIND_ORDER: ProfileAttribute['kind'][] = ['goal', 'interest', 'strength', 'habit', 'constraint', 'growth', 'commitment', 'overload'];

const fmt = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
};

export default function PresentProfilePage() {
  const navigate = useNavigate();
  const { profile, brainStatus, ensureLoaded, rejectedAttributeIds, rejectAttribute, restoreAttribute, showToast } = useAppState();
  const [open, setOpen] = useState<ProfileAttribute | null>(null);

  useEffect(() => {
    if (!profile && brainStatus !== 'building') void ensureLoaded();
  }, [profile, brainStatus, ensureLoaded]);

  if (!profile) {
    return <div className="grid min-h-[60vh] place-items-center text-slate-400">Loading your current self…</div>;
  }

  const visible = profile.attributes.filter((a) => !rejectedAttributeIds.includes(a.id));
  const rejected = profile.attributes.filter((a) => rejectedAttributeIds.includes(a.id));
  const grouped = KIND_ORDER.map((k) => ({ kind: k, items: visible.filter((a) => a.kind === k) })).filter((g) => g.items.length);
  const alloc = profile.time_allocation.filter((t) => t.hours > 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="chip border-blue-400/40 text-blue-300">Stage 2 · Understand present</span>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Current Self</h1>
          <p className="mt-2 max-w-2xl text-slate-300">{profile.summary}</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/future')}>
          See my future <ArrowRight size={16} />
        </button>
      </motion.div>

      {profile.overload_warnings.length > 0 && (
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {profile.overload_warnings.map((w, i) => (
            <div key={w} className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${i % 2 ? 'border-rose-400/40 bg-rose-400/5 text-rose-200' : 'border-amber-400/40 bg-amber-400/5 text-amber-200'}`}>
              <AlertTriangle size={16} /> {w}
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <GlassPanel title="Weekly commitment">
          <div className="text-5xl font-extrabold tabular-nums">
            {profile.weekly_commitment_hours}
            <span className="ml-1 text-lg font-semibold text-[var(--muted)]">h / week</span>
          </div>
          <p className="mt-2 text-sm text-slate-300">Across classes, assignments, events and personal time this week.</p>
          <div className="mt-4 space-y-1.5">
            {profile.time_allocation.map((t, i) => (
              <div key={t.category} className="flex items-center gap-2 text-xs">
                <span className="h-2 w-2 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                <span className="w-28">{t.category}</span>
                <div className="h-1.5 flex-1 rounded-full bg-white/10">
                  <div className="h-1.5 rounded-full" style={{ width: `${(t.hours / Math.max(1, profile.weekly_commitment_hours)) * 100}%`, background: PALETTE[i % PALETTE.length] }} />
                </div>
                <span className="w-8 text-right tabular-nums text-slate-400">{t.hours}h</span>
              </div>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel title="Time allocation">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={alloc} dataKey="hours" nameKey="category" innerRadius={55} outerRadius={90} paddingAngle={3} stroke="none">
                  {alloc.map((t, i) => (
                    <Cell key={t.category} fill={PALETTE[profile.time_allocation.indexOf(t) % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#0b1124', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: '#e8ebf5' }} formatter={(v: number) => [`${v}h`, 'Hours']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </GlassPanel>

        <GlassPanel title="Upcoming deadlines">
          <ul className="space-y-2">
            {profile.upcoming_deadlines.map((e) => (
              <li key={e.id} className="flex items-center gap-3 rounded-xl border border-[var(--border)] px-3 py-2">
                <CalendarClock size={16} className={e.kind === 'interview' ? 'text-violet-300' : 'text-amber-300'} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{e.title}</div>
                  <div className="text-xs text-[var(--muted)]">{fmt(e.start)}</div>
                </div>
                <span className="chip">{e.kind}</span>
              </li>
            ))}
          </ul>
        </GlassPanel>
      </div>

      <h2 className="mt-10 text-lg font-bold">What your brain noticed</h2>
      <p className="text-sm text-[var(--muted)]">Interpretations, not facts. Open "why?" to see the evidence, or reject anything that does not fit.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {grouped.flatMap((g) =>
          g.items.map((a, i) => (
            <motion.div key={a.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="glass p-4">
              <div className="flex items-center justify-between">
                <span className="chip" style={{ color: KIND_COLORS[a.kind], borderColor: `${KIND_COLORS[a.kind]}66` }}>{a.kind}</span>
                <span className="text-xs tabular-nums text-[var(--muted)]">{Math.round(a.confidence * 100)}% confidence</span>
              </div>
              <div className="mt-2 font-semibold">{a.label}</div>
              <div className="mt-2 h-1.5 rounded-full bg-white/10">
                <div className="h-1.5 rounded-full" style={{ width: `${a.confidence * 100}%`, background: KIND_COLORS[a.kind] }} />
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <button className="btn btn-sm" onClick={() => setOpen(a)}>
                  <HelpCircle size={13} /> why?
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => {
                    rejectAttribute(a.id);
                    showToast(`"${a.label}" removed from your profile`, 'info');
                  }}
                >
                  Correct this
                </button>
              </div>
            </motion.div>
          )),
        )}
      </div>

      {rejected.length > 0 && (
        <GlassPanel className="mt-6" title={`Rejected inferences (${rejected.length})`}>
          <ul className="space-y-1 text-sm">
            {rejected.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 text-slate-400">
                <span className="line-through">{a.label}</span>
                <button className="btn btn-sm" onClick={() => restoreAttribute(a.id)}>
                  <Undo2 size={12} /> Restore
                </button>
              </li>
            ))}
          </ul>
        </GlassPanel>
      )}

      <OpportunityScanner />

      <div className="mt-10 flex items-center justify-between text-xs text-[var(--muted)]">
        <span className="flex items-center gap-1">
          <RotateCcw size={12} /> Brain: {profile.brain_mode === 'cognee' ? 'Cognee' : 'Demo Brain'} · {profile.sources.length} sources · {profile.evidence.length} evidence items
        </span>
        <button className="btn btn-primary btn-sm" onClick={() => navigate('/future')}>
          See my future <ArrowRight size={14} />
        </button>
      </div>

      <EvidenceDrawer attribute={open} evidence={profile.evidence} sources={profile.sources} onClose={() => setOpen(null)} onReject={(id) => { rejectAttribute(id); showToast('Inference rejected', 'info'); }} />
    </div>
  );
}
