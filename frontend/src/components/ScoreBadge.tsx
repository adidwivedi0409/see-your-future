import { useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import { SCENARIO_TOOLTIP } from '../types';

interface Props {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  animate?: boolean;
  tone?: string;
}

export function useCountUp(target: number, enabled = true, ms = 700) {
  const [val, setVal] = useState(target);
  useEffect(() => {
    if (!enabled) {
      setVal(target);
      return;
    }
    const from = val;
    if (from === target) return;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, enabled]);
  return val;
}

export default function ScoreBadge({ score, size = 'md', animate = true, tone }: Props) {
  const val = useCountUp(score, animate);
  const color = tone ?? (score >= 70 ? 'var(--green)' : score >= 45 ? 'var(--cyan)' : 'var(--amber)');
  const cls = size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-base' : 'text-xl';
  return (
    <div className="inline-flex items-center gap-2" title={SCENARIO_TOOLTIP}>
      <div className="flex flex-col leading-none">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">Scenario likelihood</span>
        <span className={`${cls} font-bold tabular-nums`} style={{ color }}>
          {val}
        </span>
      </div>
      <Info size={12} className="text-[var(--muted)]" aria-label={SCENARIO_TOOLTIP} />
    </div>
  );
}
