import { CalendarClock, ExternalLink, MapPin } from 'lucide-react';
import type { Opportunity } from '../types';

const TYPE_COLORS: Record<Opportunity['type'], string> = {
  hackathon: 'var(--cyan)',
  internship: 'var(--blue)',
  research: 'var(--violet)',
  scholarship: 'var(--amber)',
  event: 'var(--green)',
  course: 'var(--coral)',
};

export function daysLeft(deadline: string | null): number | null {
  if (!deadline) return null;
  const d = new Date(deadline + 'T23:59:59');
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}

export function countdownLabel(deadline: string | null): { text: string; tone: string } | null {
  const n = daysLeft(deadline);
  if (n === null) return null;
  if (n < 0) return { text: 'closed', tone: 'var(--muted)' };
  if (n === 0) return { text: 'due today', tone: 'var(--coral)' };
  if (n === 1) return { text: '1 day left', tone: 'var(--coral)' };
  return { text: `${n} days left`, tone: n <= 7 ? 'var(--coral)' : n <= 21 ? 'var(--amber)' : 'var(--green)' };
}

function RelevanceRing({ value, color, size = 44 }: { value: number; color: string; size?: number }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(100, value)) / 100);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} title="Relevance to your profile (not a prediction)">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={3} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(.2,.8,.2,1)', filter: `drop-shadow(0 0 4px ${color})` }}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-xs font-bold tabular-nums" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

export default function OpportunityCard({ opp, compact }: { opp: Opportunity; compact?: boolean }) {
  const color = TYPE_COLORS[opp.type];
  const cd = countdownLabel(opp.deadline);
  return (
    <div className="glass group relative overflow-hidden p-3 transition-colors hover:border-[var(--border-strong)]">
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity group-hover:opacity-30" style={{ background: color }} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="chip" style={{ borderColor: `${color}66`, color }}>{opp.type}</span>
            {opp.is_demo && <span className="chip border-amber-400/40 font-mono text-[10px] text-amber-300">DEMO DATA</span>}
          </div>
          <a href={opp.url} target="_blank" rel="noreferrer" className="mt-1.5 flex items-center gap-1 text-sm font-semibold leading-snug hover:text-cyan-300">
            <span className="min-w-0">{opp.title}</span> <ExternalLink size={12} className="shrink-0 opacity-70" />
          </a>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--muted)]">
            <span className="truncate">{opp.organization}</span>
            <span aria-hidden>·</span>
            <MapPin size={10} className="shrink-0" />
            <span className="truncate">{opp.location}</span>
          </p>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <RelevanceRing value={opp.relevance_score} color={color} size={compact ? 40 : 46} />
          <span className="text-[9px] uppercase tracking-wider text-[var(--muted)]">relevance</span>
        </div>
      </div>
      {!compact && <p className="mt-2 text-xs leading-relaxed text-slate-300">{opp.description}</p>}
      <ul className="mt-2 space-y-0.5 text-xs text-slate-400">
        {opp.relevance_reasons.slice(0, compact ? 2 : 3).map((r) => (
          <li key={r} className="flex gap-1.5">
            <span style={{ color }}>▸</span>
            <span>{r}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-[var(--border)] pt-2 text-[11px] text-[var(--muted)]">
        <span className="flex items-center gap-1.5">
          <CalendarClock size={11} />
          {opp.deadline ? (
            <>
              <span>Deadline {opp.deadline}</span>
              {cd && (
                <span className="rounded-md px-1.5 py-0.5 font-mono font-semibold" style={{ color: cd.tone, background: `color-mix(in srgb, ${cd.tone} 12%, transparent)` }}>
                  {cd.text}
                </span>
              )}
            </>
          ) : opp.start_date ? (
            `Starts ${opp.start_date}`
          ) : (
            'Rolling'
          )}
        </span>
        <span className="truncate font-mono text-[10px]">{opp.source}</span>
      </div>
    </div>
  );
}
