import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Brain } from 'lucide-react';
import { useAppState } from '../hooks/useAppState';
import { PRIVACY_LINE, TAGLINE } from '../types';
import BootSequence from '../components/BootSequence';
import Constellation from '../components/Constellation';

type Health = {
  status?: string;
  demo_mode?: boolean;
  brain_mode?: string;
  strands_available?: boolean;
  bright_data_mode?: string;
  cognee_mode?: string;
  version?: string;
};

const FALLBACK: Health = {
  status: 'ok',
  demo_mode: true,
  brain_mode: 'demo',
  strands_available: true,
  bright_data_mode: 'demo',
  cognee_mode: 'demo',
  version: '0.1.0',
};

const MISSIONS = [
  {
    idx: '01',
    title: 'SEE YOUR LIFE',
    accent: 'var(--violet)',
    dot: 'violet',
    stat: '32 NODES · 41 EDGES',
    text: 'Calendar, notes and goals become a personal knowledge graph in Cognee. Every interpretation is linked to the evidence behind it.',
    tool: 'recall_personal_context',
  },
  {
    idx: '02',
    title: 'SEE YOUR FUTURE',
    accent: 'var(--cyan)',
    dot: 'cyan',
    stat: '16 FUTURES SCORED',
    text: 'The Strands Future Navigator branches decisions into scored scenarios grounded in fresh Bright Data opportunities.',
    tool: 'generate_future_paths',
  },
  {
    idx: '03',
    title: 'CHANGE YOUR FUTURE',
    accent: 'var(--coral)',
    dot: 'coral',
    stat: '3 ACTIONS · 1 PLAN',
    text: 'Adjust a decision, watch the map respond, and turn the path you prefer into three concrete actions.',
    tool: 'simulate_decision',
  },
];

const FLOW: { label: string; sub?: string; split?: [string, string] }[] = [
  { label: 'PERSONAL DATA', sub: 'calendar · notes · documents' },
  { label: 'COGNEE PERSONAL BRAIN', sub: 'memory graph · remembers you' },
  { label: 'AWS STRANDS FUTURE NAVIGATOR', sub: '7 tools · reasons across personal + public' },
  { label: 'ANALYSIS', split: ['SCHEDULE ANALYSIS', 'BRIGHT DATA OPPORTUNITIES'] },
  { label: 'TRANSPARENT SCENARIO ENGINE', sub: 'scenario likelihood · never a prediction' },
  { label: 'INTERACTIVE FUTURE MAP', sub: 'branches you can inspect and challenge' },
  { label: 'YOU CHANGE A DECISION', sub: 'simulate_decision · remember_user_feedback' },
  { label: 'UPDATED PLAN', sub: 'create_action_plan · three concrete actions' },
];

const fade = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
};

function tag(mode: string | undefined, live: string, demo: string) {
  if (!mode) return demo;
  return mode === 'demo' ? demo : live;
}

export default function LandingPage() {
  const navigate = useNavigate();
  const { loadDemo } = useAppState();
  const [health, setHealth] = useState<Health>(FALLBACK);
  const [booted, setBooted] = useState<boolean>(() => {
    // If the boot intro already played this session it is skipped, so reveal the hero immediately.
    try { return sessionStorage.getItem('syf_booted') === '1'; } catch { return false; }
  });

  useEffect(() => {
    const ctrl = new AbortController();
    fetch('/api/health', { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: Health) => setHealth({ ...FALLBACK, ...j }))
      .catch(() => setHealth(FALLBACK));
    return () => ctrl.abort();
  }, []);

  const explore = () => {
    navigate('/brain?demo=1');
    void loadDemo();
  };

  const TELEMETRY = [
    { k: 'COGNEE', v: tag(health.cognee_mode, 'LIVE GRAPH', 'DEMO BRAIN'), dot: 'violet' },
    { k: 'STRANDS', v: health.strands_available ? 'ACTIVE' : 'STANDBY', dot: health.strands_available ? '' : 'amber' },
    { k: 'BRIGHT DATA', v: tag(health.bright_data_mode, 'LIVE SCAN', 'DEMO CACHE'), dot: 'cyan' },
    { k: 'DOCKER SANDBOX', v: 'OPTIONAL', dot: 'amber' },
    { k: 'SCENARIO ENGINE', v: '16 FUTURES', dot: 'coral' },
    { k: 'AGENT TOOLS', v: '7 / 7', dot: '' },
    { k: 'BACKEND', v: health.status === 'ok' ? `OK · v${health.version ?? '0.1.0'}` : 'FALLBACK', dot: health.status === 'ok' ? '' : 'coral' },
    { k: 'EXTERNAL ACTIONS', v: 'CONFIRM FIRST', dot: 'amber' },
  ];

  return (
    <div className="relative overflow-x-hidden bg-[#050505] text-[#f5f5f5]">
      <BootSequence onDone={() => setBooted(true)} />

      {/* ---------- HERO ---------- */}
      <section className="relative min-h-[calc(100vh-57px)] overflow-hidden">
        <div className="fog" />
        <div className="grid-lines absolute inset-0" />
        <div className="absolute inset-0 opacity-90">
          <Constellation />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#050505] to-transparent" />

        <div className="relative mx-auto flex min-h-[calc(100vh-57px)] max-w-6xl flex-col justify-center px-6 py-24 sm:px-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={booted ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mono-label mb-8 flex items-center gap-3">
              <span className="status-dot cyan" />
              BATTLE OF THE PERSONAL BRAINS · SF · 2026
            </div>
            <h1 className="text-[clamp(2.75rem,8vw,7.5rem)] font-semibold leading-[0.95] tracking-[-0.03em]">
              <span className="block">SEE YOUR FUTURE</span>
              <span className="headline-gradient block">CHANGE YOUR FUTURE</span>
            </h1>
            <p className="mt-8 max-w-xl text-base font-light leading-relaxed text-white/70 sm:text-lg">
              Understand the life you are living. Explore where your choices could lead. Change what happens next.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button className="btn btn-white px-6 py-3 text-sm" onClick={() => navigate('/brain')}>
                <Brain size={16} /> Build My Brain
              </button>
              <button className="btn btn-outline px-6 py-3 text-sm" onClick={explore}>
                Explore Demo <ArrowRight size={16} />
              </button>
            </div>
            <p className="mono-label mt-8">{PRIVACY_LINE}</p>
          </motion.div>

          <motion.div
            className="absolute bottom-8 right-6 hidden flex-col items-end gap-1 sm:right-8 md:flex"
            initial={{ opacity: 0 }}
            animate={booted ? { opacity: 1 } : { opacity: 0 }}
            transition={{ delay: 0.6, duration: 1 }}
          >
            <span className="mono-label">SCENARIO LIKELIHOOD · NOT A PREDICTION</span>
            <span className="mono-label text-white/35">SCROLL ↓</span>
          </motion.div>
        </div>
      </section>

      {/* ---------- TELEMETRY STRIP ---------- */}
      <section className="hairline border-y bg-black">
        <div className="relative overflow-hidden py-3">
          <div className="ticker-track">
            {[0, 1].map((rep) => (
              <div key={rep} className="flex shrink-0 items-center" aria-hidden={rep === 1}>
                {TELEMETRY.map((t) => (
                  <span key={`${rep}-${t.k}`} className="mono-label flex items-center gap-3 px-8 text-white/70">
                    <span className={`status-dot ${t.dot}`} />
                    {t.k} <span className="text-white/40">[{t.v}]</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- MISSIONS ---------- */}
      <section className="mx-auto max-w-6xl px-6 py-24 sm:px-8 sm:py-32">
        <motion.div {...fade}>
          <div className="mono-label mb-6">02 · MISSIONS</div>
          <h2 className="max-w-3xl text-4xl font-semibold leading-[1.02] tracking-[-0.02em] sm:text-6xl">
            One brain, <span className="text-white/45">many futures.</span>
          </h2>
          <p className="mt-6 max-w-2xl text-base font-light leading-relaxed text-white/60">
            A personal brain that remembers you, finds what is out there, reasons across both, and acts only when you say so.
          </p>
        </motion.div>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {MISSIONS.map((m, i) => (
            <motion.article
              key={m.idx}
              {...fade}
              transition={{ ...fade.transition, delay: i * 0.1 }}
              className="mission-card flex min-h-[300px] flex-col p-7"
              style={{ ['--accent' as string]: m.accent }}
            >
              <div className="flex items-center justify-between">
                <span className="mono-label text-white/40">{m.idx}</span>
                <span className="mono-label flex items-center gap-2 text-white/50">
                  <span className={`status-dot ${m.dot}`} /> {m.stat}
                </span>
              </div>
              <h3 className="mt-10 text-2xl font-semibold tracking-tight">{m.title}</h3>
              <p className="mt-4 text-sm font-light leading-relaxed text-white/65">{m.text}</p>
              <div className="mono-text mt-auto pt-8 text-[11px] text-white/35">tool · {m.tool}()</div>
            </motion.article>
          ))}
        </div>
      </section>

      {/* ---------- HOW IT WORKS ---------- */}
      <section className="hairline border-t">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-24 sm:px-8 sm:py-32 md:grid-cols-[1fr_1.2fr]">
          <motion.div {...fade}>
            <div className="mono-label mb-6">03 · SYSTEM</div>
            <h2 className="text-4xl font-semibold leading-[1.02] tracking-[-0.02em] sm:text-5xl">
              Remember. Find. Reason. <span className="text-white/45">Act.</span>
            </h2>
            <p className="mt-6 max-w-md text-base font-light leading-relaxed text-white/60">
              Every scenario is a likelihood you can inspect, not a prediction you must accept. Change one decision and the whole map
              responds.
            </p>
            <ul className="mono-label mt-10 space-y-3 text-white/55">
              <li className="flex items-center gap-3"><span className="status-dot violet" /> REMEMBERING · COGNEE</li>
              <li className="flex items-center gap-3"><span className="status-dot cyan" /> FINDING · BRIGHT DATA</li>
              <li className="flex items-center gap-3"><span className="status-dot" /> REASONING · AWS STRANDS AGENT</li>
              <li className="flex items-center gap-3"><span className="status-dot coral" /> ACTING · WITH YOUR CONFIRMATION</li>
            </ul>
          </motion.div>

          <motion.ol {...fade} className="mono-text relative text-[11px] uppercase tracking-[0.16em] sm:text-xs">
            {FLOW.map((step, i) => (
              <li key={step.label} className="relative pl-8">
                <span className="absolute left-0 top-[3px] grid h-3 w-3 place-items-center">
                  <span className={`h-2 w-2 rounded-full ${i === 6 ? 'bg-[var(--coral)]' : i === 2 ? 'bg-[var(--cyan)]' : 'bg-white/60'}`} />
                </span>
                {i < FLOW.length - 1 && <span className="absolute left-[5px] top-4 h-[calc(100%-4px)] w-px bg-white/15" />}
                <div className="pb-7">
                  {step.split ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {step.split.map((s) => (
                        <div key={s} className="border border-white/12 px-3 py-2 text-white/80">{s}</div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-white/85">{step.label}</div>
                  )}
                  {step.sub && <div className="mt-1 normal-case tracking-normal text-white/40">{step.sub}</div>}
                </div>
              </li>
            ))}
          </motion.ol>
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="hairline relative overflow-hidden border-t">
        <div className="fog opacity-70" />
        <div className="relative mx-auto max-w-6xl px-6 py-28 text-center sm:px-8 sm:py-40">
          <motion.div {...fade}>
            <div className="mono-label mb-6">04 · YOUR MOVE</div>
            <h2 className="text-4xl font-semibold leading-[1.02] tracking-[-0.03em] sm:text-7xl">
              Autonomy over <span className="headline-gradient">your own future.</span>
            </h2>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button className="btn btn-white px-6 py-3 text-sm" onClick={() => navigate('/brain')}>
                <Brain size={16} /> Build My Brain
              </button>
              <button className="btn btn-outline px-6 py-3 text-sm" onClick={explore}>
                Explore Demo <ArrowRight size={16} />
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ---------- FOOTER ---------- */}
      <footer className="hairline border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div className="mono-label text-white/80">{TAGLINE}</div>
          <div className="mono-label text-white/40">{PRIVACY_LINE}</div>
          <div className="mono-label text-white/40">Built with Cognee · Bright Data · AWS Strands Agents · Docker</div>
        </div>
      </footer>
    </div>
  );
}
