import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Brain, Lock, RotateCcw, ShieldCheck } from 'lucide-react';
import { useAppState } from '../hooks/useAppState';
import { PRIVACY_LINE } from '../types';
import SmartSearch from './SmartSearch';

const STAGES = [
  { path: '/brain', idx: '01', label: 'See Life' },
  { path: '/present', idx: '02', label: 'Understand Present' },
  { path: '/future', idx: '03', label: 'See Future' },
  { path: '/plan', idx: '04', label: 'Change Future' },
];

export default function Nav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { demoMode, brainMode, brainStatus, resetDemo, unlockedStages } = useAppState();
  const activeIdx = STAGES.findIndex((s) => pathname.startsWith(s.path));

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[rgba(5,5,5,0.8)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-3">
          <span className="relative grid h-7 w-7 place-items-center border border-white/25">
            <span className="h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_12px_rgba(139,92,246,0.9)]" />
          </span>
          <span className="mono-label hidden text-white sm:inline">SEE YOUR FUTURE</span>
        </Link>

        <div className="order-3 flex w-full justify-center md:order-none md:mx-auto md:w-auto md:flex-1">
          <SmartSearch />
        </div>

        <nav className="order-4 flex w-full items-center justify-center gap-0.5 overflow-x-auto md:order-none md:w-auto" aria-label="Stages">
          {STAGES.map((s, i) => {
            const active = i === activeIdx;
            const done = activeIdx > i;
            const unlocked = unlockedStages.includes(i + 1);
            const cls = `mono-label flex items-center gap-1 whitespace-nowrap px-3 py-1.5 transition ${
              active
                ? 'border-b border-white text-white'
                : done
                  ? 'text-cyan-300/80 hover:text-cyan-200'
                  : unlocked
                    ? 'text-white/55 hover:text-white'
                    : 'cursor-not-allowed text-white/20'
            }`;
            const inner = (
              <>
                <span className={active ? 'text-violet-300' : unlocked ? 'text-white/30' : 'text-white/15'}>{s.idx}</span> {s.label}
                {!unlocked && <Lock size={9} className="ml-0.5 text-white/25" />}
              </>
            );
            return (
              <div key={s.path} className="flex items-center">
                {unlocked ? (
                  <Link to={s.path} className={cls} aria-current={active ? 'page' : undefined}>
                    {inner}
                  </Link>
                ) : (
                  <span className={cls} title="Unlocks after the previous step" aria-disabled="true">
                    {inner}
                  </span>
                )}
                {i < STAGES.length - 1 && <span className="mx-1 text-[10px] text-white/25">→</span>}
              </div>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          {demoMode && (
            <span
              className="mono-label flex items-center gap-1.5 border border-amber-400/40 px-2 py-1 text-amber-300"
              title={brainMode === 'demo' ? 'Running with bundled demo data' : 'Demo mode'}
            >
              <Brain size={11} /> Demo Brain
            </span>
          )}
          <span className="mono-label hidden items-center gap-1.5 text-white/40 lg:flex" title={PRIVACY_LINE}>
            <ShieldCheck size={12} className="text-emerald-400" /> {PRIVACY_LINE}
          </span>
          <button
            className="btn btn-sm btn-outline mono-label rounded-none text-white/80"
            title="Reset demo"
            disabled={brainStatus === 'idle'}
            onClick={() => {
              resetDemo();
              navigate('/');
            }}
          >
            <RotateCcw size={12} /> Reset
          </button>
        </div>
      </div>
    </header>
  );
}
