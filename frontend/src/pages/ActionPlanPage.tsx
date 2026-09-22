import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CalendarPlus, Check, CheckCircle2, Copy, Download, ListChecks, Sparkles, X } from 'lucide-react';
import GlassPanel from '../components/GlassPanel';
import { useAppState } from '../hooks/useAppState';
import type { ActionItem, ActionPlan } from '../types';
import { TAGLINE } from '../types';

function Item({ item, index }: { item: ActionItem; index?: number }) {
  return (
    <li className="flex gap-3 rounded-xl border border-[var(--border)] p-3">
      {index !== undefined && <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-blue-500 text-xs font-bold text-white">{index + 1}</span>}
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{item.title}</div>
        <p className="mt-0.5 text-sm text-slate-300">{item.description}</p>
        <div className="mt-1 text-xs text-[var(--muted)]">
          {item.when}
          {item.duration_minutes > 0 && ` · ${item.duration_minutes} min`}
        </div>
      </div>
    </li>
  );
}

// ---------- ICS helpers (client-side, no dependencies) ----------
const pad = (n: number) => String(n).padStart(2, '0');
const toIcsUtc = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
const icsEscape = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const foldLine = (line: string) => {
  // RFC 5545: lines longer than 75 octets are folded with CRLF + space
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = ' ' + rest.slice(74);
  }
  out.push(rest);
  return out.join('\r\n');
};

/** Resolve a human "when" string into a Date. Falls back to the next hour today + offset days so exports are always valid. */
function resolveStart(when: string, fallbackDayOffset: number): Date {
  const direct = new Date(when);
  if (!Number.isNaN(direct.getTime()) && /\d{4}/.test(when)) return direct;
  const d = new Date();
  d.setDate(d.getDate() + fallbackDayOffset);
  d.setHours(18, 0, 0, 0);
  // try to pull a clock time like "19:00" or "7pm" from the string
  const m24 = when.match(/(\d{1,2}):(\d{2})/);
  const m12 = when.match(/(\d{1,2})\s*(am|pm)/i);
  if (m24) d.setHours(Number(m24[1]), Number(m24[2]), 0, 0);
  else if (m12) d.setHours((Number(m12[1]) % 12) + (m12[2].toLowerCase() === 'pm' ? 12 : 0), 0, 0, 0);
  return d;
}

export function buildIcs(plan: ActionPlan, pathTitles: string[]): string {
  const now = toIcsUtc(new Date());
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//See Your Future//FutureNavigatorAgent//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape('See Your Future · Action Plan')}`,
  ];
  plan.calendar_blocks.forEach((b, i) => {
    const start = resolveStart(b.when, i + 1);
    const end = new Date(start.getTime() + Math.max(15, b.duration_minutes || 60) * 60_000);
    const desc = `${b.description}\n\nPath: ${pathTitles.join(' → ')}\nScenario likelihood, not a prediction. ${TAGLINE}`;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${b.id}-${start.getTime()}@see-your-future`,
      `DTSTAMP:${now}`,
      `DTSTART:${toIcsUtc(start)}`,
      `DTEND:${toIcsUtc(end)}`,
      `SUMMARY:${icsEscape(b.title)}`,
      `DESCRIPTION:${icsEscape(desc)}`,
      `CATEGORIES:${icsEscape(b.kind)}`,
      'STATUS:CONFIRMED',
      'BEGIN:VALARM',
      'TRIGGER:-PT30M',
      'ACTION:DISPLAY',
      `DESCRIPTION:${icsEscape(b.title)}`,
      'END:VALARM',
      'END:VEVENT',
    );
  });
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

export function planToText(plan: ActionPlan, pathTitles: string[]): string {
  const out: string[] = [];
  out.push('SEE YOUR FUTURE · ACTION PLAN');
  out.push(`Path: ${pathTitles.join(' → ')}`);
  out.push('');
  out.push('THREE IMMEDIATE ACTIONS');
  plan.next_actions.forEach((a, i) => out.push(`${i + 1}. ${a.title} — ${a.when}${a.duration_minutes ? ` (${a.duration_minutes} min)` : ''}\n   ${a.description}`));
  out.push('');
  out.push('CALENDAR BLOCKS');
  plan.calendar_blocks.forEach((b) => out.push(`• ${b.title} — ${b.when}${b.duration_minutes ? ` (${b.duration_minutes} min)` : ''}`));
  out.push('');
  out.push(`RISK TO WATCH: ${plan.risk.title}\n${plan.risk.description}`);
  out.push('');
  out.push(`OPPORTUNITY: ${plan.opportunity.title}\n${plan.opportunity.description}`);
  out.push('');
  out.push(`WHY THIS PLAN: ${plan.explanation}`);
  out.push('');
  out.push(TAGLINE);
  return out.join('\n');
}

export default function ActionPlanPage() {
  const navigate = useNavigate();
  const { graph, plan, brainStatus, ensureLoaded, generatePlan, confirmPlan, planConfirmed, showToast } = useAppState();
  const [preview, setPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!graph && brainStatus !== 'building') void ensureLoaded();
  }, [graph, brainStatus, ensureLoaded]);

  useEffect(() => {
    if (graph && !plan && !loading) {
      setLoading(true);
      void generatePlan().finally(() => setLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, plan]);

  if (!graph || !plan) {
    return <div className="grid min-h-[60vh] place-items-center text-slate-400">Turning your future into a plan…</div>;
  }

  const pathTitles = plan.path_node_ids.map((id) => graph.nodes.find((n) => n.id === id)?.title).filter(Boolean) as string[];

  const copyPlan = async () => {
    const text = planToText(plan, pathTitles);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      showToast('Plan copied to clipboard', 'success');
    } catch {
      showToast('Could not access clipboard', 'warning');
    }
  };

  const exportIcs = () => {
    if (!planConfirmed) {
      showToast('Confirm the preview first', 'warning');
      return;
    }
    const ics = buildIcs(plan, pathTitles);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'see-your-future-plan.ics';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(`${plan.calendar_blocks.length} calendar blocks exported (.ics)`, 'success');
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="chip border-emerald-400/40 text-emerald-300">Stage 4 · Change future</span>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Your action plan</h1>
          <p className="mt-2 max-w-2xl text-slate-300">Path: {pathTitles.join(' → ')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={() => navigate('/future')}>Back to map</button>
          <button className="btn" onClick={() => void copyPlan()} title="Copy the full plan as text">
            {copied ? <><Check size={16} className="text-emerald-300" /> Copied</> : <><Copy size={16} /> Copy plan</>}
          </button>
          <span title={planConfirmed ? 'Download calendar blocks as .ics' : 'Confirm the preview first'} className="inline-flex">
            <button
              className="btn disabled:cursor-not-allowed disabled:opacity-40"
              onClick={exportIcs}
              disabled={!planConfirmed}
              aria-disabled={!planConfirmed}
            >
              <Download size={16} /> Export .ics
            </button>
          </span>
          <button className="btn btn-primary" onClick={() => setPreview(true)} disabled={planConfirmed}>
            {planConfirmed ? <><CheckCircle2 size={16} /> Plan confirmed</> : <><CalendarPlus size={16} /> Preview and confirm</>}
          </button>
        </div>
      </motion.div>

      {planConfirmed && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-400/30 bg-emerald-400/5 px-4 py-3 text-sm text-emerald-200">
          <CheckCircle2 size={16} />
          <span>Plan saved to your brain. Export the calendar blocks or copy the plan to share it.</span>
        </motion.div>
      )}

      <div className="mt-8 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-5">
          <GlassPanel strong title="Three immediate actions">
            <ul className="space-y-3">
              {plan.next_actions.map((a, i) => <Item key={a.id} item={a} index={i} />)}
            </ul>
          </GlassPanel>
          <GlassPanel
            title="Proposed calendar blocks"
            subtitle={planConfirmed ? 'Confirmed. Export as .ics to add them to any calendar.' : 'Nothing is written to your calendar until you confirm.'}
          >
            <ul className="space-y-3">
              {plan.calendar_blocks.map((b) => <Item key={b.id} item={b} />)}
            </ul>
          </GlassPanel>
        </div>
        <div className="space-y-5">
          <GlassPanel title="One risk to watch" className="border-rose-400/30">
            <div className="flex gap-3">
              <AlertTriangle className="shrink-0 text-rose-300" size={18} />
              <div>
                <div className="font-semibold">{plan.risk.title}</div>
                <p className="mt-1 text-sm text-slate-300">{plan.risk.description}</p>
              </div>
            </div>
          </GlassPanel>
          <GlassPanel title="One opportunity" className="border-violet-400/30">
            <div className="flex gap-3">
              <Sparkles className="shrink-0 text-violet-300" size={18} />
              <div>
                <div className="font-semibold">{plan.opportunity.title}</div>
                <p className="mt-1 text-sm text-slate-300">{plan.opportunity.description}</p>
                <div className="mt-1 text-xs text-[var(--muted)]">{plan.opportunity.when}</div>
              </div>
            </div>
          </GlassPanel>
          <GlassPanel title="Why this plan">
            <p className="text-sm leading-relaxed text-slate-300">{plan.explanation}</p>
            <p className="mt-3 font-mono text-[11px] text-[var(--muted)]">create_action_plan · scenario likelihood, not a prediction</p>
          </GlassPanel>
        </div>
      </div>

      <p className="mt-16 text-center text-sm font-medium tracking-wide text-slate-400">{TAGLINE}</p>

      <AnimatePresence>
        {preview && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPreview(false)} />
            <motion.div
              className="glass glass-strong fixed left-1/2 top-1/2 z-50 w-[min(92vw,640px)] -translate-x-1/2 -translate-y-1/2 p-6"
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold">Preview — nothing is written to your calendar until you confirm</h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">{plan.calendar_blocks.length} calendar blocks · {plan.next_actions.length} actions</p>
                </div>
                <button className="btn btn-sm" onClick={() => setPreview(false)} aria-label="Cancel"><X size={14} /></button>
              </div>
              <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto text-sm">
                {[...plan.next_actions, ...plan.calendar_blocks].map((i) => (
                  <li key={i.id} className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2">
                    <ListChecks size={14} className="text-cyan-300" />
                    <span className="flex-1">{i.title}</span>
                    <span className="text-xs text-[var(--muted)]">{i.when}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex justify-end gap-2">
                <button className="btn" onClick={() => setPreview(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={() => { confirmPlan(); setPreview(false); }}>
                  <CheckCircle2 size={16} /> Confirm
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
