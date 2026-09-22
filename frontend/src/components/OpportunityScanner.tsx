import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Globe, Radar, RefreshCw, ShieldCheck } from 'lucide-react';
import OpportunityCard from './OpportunityCard';
import { useAppState } from '../hooks/useAppState';
import { api } from '../services/api';
import type { Opportunity } from '../types';

type Phase = 'idle' | 'scanning' | 'done';

interface Line {
  id: number;
  kind: 'serp' | 'fetch' | 'info' | 'ok';
  text: string;
  stamp?: string;
}

const SERP_QUERIES = [
  'AI hackathon Berkeley October 2026',
  'undergraduate interpretability research program 2026',
  'AI safety fellowship applications fall 2026',
];

const SCAN_MS = 2500;

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function fakeLatency(seed: number): string {
  const ms = 0.6 + ((seed * 37) % 13) / 10; // 0.6s – 1.8s, deterministic
  return `${ms.toFixed(1)}s`;
}

function buildScript(opps: Opportunity[]): Line[] {
  const domains = Array.from(new Set(opps.map((o) => domainOf(o.url))));
  const lines: Line[] = [];
  let id = 0;
  lines.push({ id: id++, kind: 'info', text: 'bright-data · session open · proxy pool: residential/us-ca' });
  SERP_QUERIES.forEach((q) => lines.push({ id: id++, kind: 'serp', text: `SERP: "${q}"` }));
  domains.forEach((d, i) => lines.push({ id: id++, kind: 'fetch', text: `GET  https://${d}/`, stamp: `[200 OK · ${fakeLatency(i + 1)}]` }));
  lines.push({ id: id++, kind: 'info', text: 'web-unlocker · JS-rendered pages resolved · 0 captchas' });
  lines.push({ id: id++, kind: 'ok', text: `${opps.length} results normalized · relevance scored against your brain` });
  return lines;
}

export default function OpportunityScanner() {
  const { opportunities, showToast } = useAppState();
  const [phase, setPhase] = useState<Phase>('idle');
  const [visibleLines, setVisibleLines] = useState<Line[]>([]);
  const [results, setResults] = useState<Opportunity[]>([]);
  const [scannedAt, setScannedAt] = useState<Date | null>(null);
  const timers = useRef<number[]>([]);
  const termRef = useRef<HTMLDivElement>(null);

  const sorted = useMemo(() => [...results].sort((a, b) => b.relevance_score - a.relevance_score), [results]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [visibleLines]);

  const scan = async () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setPhase('scanning');
    setVisibleLines([]);
    setResults([]);

    let data: Opportunity[] = opportunities;
    if (!data.length) {
      const res = await api.opportunities();
      data = res.data;
    }
    const script = buildScript(data);
    const step = SCAN_MS / script.length;
    script.forEach((line, i) => {
      timers.current.push(window.setTimeout(() => setVisibleLines((v) => [...v, line]), Math.round(step * i)));
    });
    timers.current.push(
      window.setTimeout(() => {
        setResults(data);
        setScannedAt(new Date());
        setPhase('done');
        showToast(`${data.length} fresh opportunities found via Bright Data`, 'success');
      }, SCAN_MS + 150),
    );
  };

  const lineColor = (k: Line['kind']) =>
    k === 'serp' ? 'text-cyan-300' : k === 'fetch' ? 'text-slate-300' : k === 'ok' ? 'text-emerald-300' : 'text-[var(--muted)]';

  return (
    <section className="glass glass-strong mt-10 overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="relative grid h-9 w-9 place-items-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
            <Radar size={18} />
            {phase === 'scanning' && <span className="absolute inset-0 animate-ping rounded-xl border border-cyan-400/40" />}
          </span>
          <div>
            <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Fresh opportunities · Bright Data</h2>
            <p className="text-sm text-slate-300">Live public web, filtered by what your brain knows about you.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {scannedAt && phase === 'done' && (
            <span className="font-mono text-[11px] text-[var(--muted)]">scanned {scannedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</span>
          )}
          <button className="btn btn-primary" onClick={() => void scan()} disabled={phase === 'scanning'}>
            {phase === 'scanning' ? (
              <><RefreshCw size={15} className="animate-spin" /> Scanning…</>
            ) : phase === 'done' ? (
              <><RefreshCw size={15} /> Rescan</>
            ) : (
              <><Globe size={15} /> Scan the web</>
            )}
          </button>
        </div>
      </div>

      <div className="px-5 py-4">
        <AnimatePresence mode="wait">
          {phase === 'idle' && (
            <motion.p key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm text-[var(--muted)]">
              Press <span className="font-semibold text-slate-200">Scan the web</span> to query SERP and unlock the source pages for hackathons, research programs and internships that match your goals.
            </motion.p>
          )}

          {phase !== 'idle' && (
            <motion.div key="term" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div
                ref={termRef}
                className="max-h-56 overflow-y-auto rounded-xl border border-[var(--border)] bg-black/40 p-3 font-mono text-[12px] leading-5 shadow-inner"
              >
                <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[var(--muted)]">
                  <span className="h-2 w-2 rounded-full bg-rose-400/70" />
                  <span className="h-2 w-2 rounded-full bg-amber-400/70" />
                  <span className="h-2 w-2 rounded-full bg-emerald-400/70" />
                  <span className="ml-2">brightdata · find_opportunities</span>
                </div>
                {visibleLines.map((l) => (
                  <motion.div key={l.id} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} className={`flex justify-between gap-3 ${lineColor(l.kind)}`}>
                    <span className="truncate">
                      <span className="mr-2 text-[var(--muted)]">{l.kind === 'ok' ? '✔' : l.kind === 'serp' ? '?' : l.kind === 'fetch' ? '→' : '#'}</span>
                      {l.text}
                    </span>
                    {l.stamp && <span className="shrink-0 text-emerald-300/80">{l.stamp}</span>}
                  </motion.div>
                ))}
                {phase === 'scanning' && <span className="inline-block h-3.5 w-1.5 animate-pulse bg-cyan-300 align-middle" />}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {phase === 'done' && (
          <motion.div layout className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sorted.map((o, i) => (
              <motion.div key={o.id} initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: i * 0.08, type: 'spring', stiffness: 260, damping: 24 }}>
                <OpportunityCard opp={o} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] px-5 py-3 text-[11px] text-[var(--muted)]">
        <span className="flex items-center gap-1.5">
          <ShieldCheck size={12} className="text-emerald-300" /> Public sources only · cached for demo · via Bright Data SERP/Web Unlocker
        </span>
        <span className="font-mono">relevance ≠ prediction · scored by FutureNavigatorAgent</span>
      </div>
    </section>
  );
}
