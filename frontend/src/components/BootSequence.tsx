import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useState } from 'react';

const SESSION_KEY = 'syf_booted';
const LINE_MS = 140;

type BootLine = { text: string; status?: string; tone?: 'cyan' | 'green' | 'amber' | 'violet' };

const LINES: BootLine[] = [
  { text: 'BOOT SEQUENCE…' },
  { text: 'PERSONAL DATA: CALENDAR / NOTES / DOCUMENTS', status: 'LOADED', tone: 'green' },
  { text: 'COGNEE MEMORY GRAPH: 32 NODES / 41 EDGES', status: 'ONLINE', tone: 'cyan' },
  { text: 'AWS STRANDS AGENT: FUTURE NAVIGATOR / 7 TOOLS', status: 'ACTIVE', tone: 'green' },
  { text: 'BRIGHT DATA: PUBLIC OPPORTUNITY SCAN', status: 'FRESH', tone: 'cyan' },
  { text: 'SCENARIO ENGINE: 16 FUTURES SCORED', status: 'READY', tone: 'green' },
  { text: 'MODE: DEMO BRAIN — NO EXTERNAL ACTIONS WITHOUT CONFIRMATION', status: 'SAFE', tone: 'amber' },
];

const TONE: Record<NonNullable<BootLine['tone']>, string> = {
  cyan: 'text-cyan-300',
  green: 'text-emerald-300',
  amber: 'text-amber-300',
  violet: 'text-violet-300',
};

function alreadyBooted(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

function markBooted() {
  try {
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    /* ignore */
  }
}

export default function BootSequence({ onDone }: { onDone?: () => void }) {
  const [visible, setVisible] = useState(() => !alreadyBooted());
  const [count, setCount] = useState(0);
  const [showTitle, setShowTitle] = useState(false);

  const reduced = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  const finish = useCallback(() => {
    markBooted();
    setVisible(false);
    onDone?.();
  }, [onDone]);

  useEffect(() => {
    if (!visible) return;
    if (reduced) {
      finish();
      return;
    }
    const timers: number[] = [];
    LINES.forEach((_, i) => {
      timers.push(window.setTimeout(() => setCount(i + 1), 260 + i * LINE_MS));
    });
    const linesDone = 260 + LINES.length * LINE_MS; // ~1240ms
    timers.push(window.setTimeout(() => setShowTitle(true), linesDone + 350));
    timers.push(window.setTimeout(finish, linesDone + 2100)); // ~3.4s total, then dissolve
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [visible, reduced, finish]);

  useEffect(() => {
    if (!visible) return;
    const onKey = () => finish();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, finish]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="boot"
          className="fixed inset-0 z-[100] cursor-pointer select-none overflow-hidden bg-[#050505] text-[#f5f5f5]"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, filter: 'blur(12px)', scale: 1.02 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          onClick={finish}
          role="presentation"
        >
          <div className="fog" />
          <div className="grid-lines absolute inset-0" />

          <div className="absolute left-6 top-6 flex items-center gap-3 sm:left-10 sm:top-8">
            <span className="status-dot cyan" />
            <span className="mono-label">SEE YOUR FUTURE · SYSTEM INIT</span>
          </div>
          <button
            type="button"
            className="mono-label absolute right-6 top-6 border border-white/15 px-3 py-1.5 transition hover:border-white/50 hover:text-white sm:right-10 sm:top-8"
            onClick={(e) => {
              e.stopPropagation();
              finish();
            }}
          >
            SKIP ↵
          </button>

          <div className="relative mx-auto flex h-full w-full max-w-4xl flex-col justify-center px-6 sm:px-10">
            <ol className="mono-text space-y-2 text-[11px] uppercase leading-relaxed tracking-[0.16em] text-white/80 sm:text-xs">
              {LINES.slice(0, count).map((l, i) => {
                const last = i === count - 1 && !showTitle;
                return (
                  <motion.li
                    key={l.text}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.18 }}
                    className={`flex flex-wrap items-baseline gap-x-3 ${last ? 'blink-cursor' : ''}`}
                  >
                    <span className="text-white/35">{String(i + 1).padStart(2, '0')}</span>
                    <span>{l.text}</span>
                    {l.status && <span className={TONE[l.tone ?? 'cyan']}>[{l.status}]</span>}
                  </motion.li>
                );
              })}
            </ol>

            <motion.div
              className="mt-8 h-px w-full origin-left bg-gradient-to-r from-violet-400 via-cyan-300 to-transparent"
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: count / LINES.length, opacity: count > 0 ? 1 : 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />

            <AnimatePresence>
              {showTitle && (
                <motion.div
                  initial={{ opacity: 0, y: 12, letterSpacing: '0.2em' }}
                  animate={{ opacity: 1, y: 0, letterSpacing: '0.02em' }}
                  transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                  className="mt-8"
                >
                  <div className="mono-label mb-3 text-cyan-300/80">ALL SYSTEMS NOMINAL</div>
                  <div className="text-4xl font-semibold tracking-tight sm:text-6xl">SEE YOUR FUTURE</div>
                  <div className="mono-label mt-3">YOUR FUTURE IS NOT PREDICTED. IT IS SHAPED.</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mono-label absolute bottom-6 left-6 sm:bottom-8 sm:left-10">
            COGNEE · BRIGHT DATA · AWS STRANDS · DOCKER
          </div>
          <div className="mono-label absolute bottom-6 right-6 sm:bottom-8 sm:right-10">SF · 2026</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
