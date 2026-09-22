import { CATEGORY_COLORS } from './FutureNodeCard';

const ITEMS: { key: keyof typeof CATEGORY_COLORS; label: string }[] = [
  { key: 'present', label: 'Present' },
  { key: 'decision', label: 'Decision' },
  { key: 'opportunity', label: 'Opportunity' },
  { key: 'outcome', label: 'Outcome' },
  { key: 'risk', label: 'Risk / trade-off' },
];

export default function Legend() {
  return (
    <div className="glass flex flex-wrap items-center gap-3 px-3 py-2 text-xs">
      {ITEMS.map((i) => (
        <span key={i.key} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: CATEGORY_COLORS[i.key], boxShadow: `0 0 8px ${CATEGORY_COLORS[i.key]}` }} />
          {i.label}
        </span>
      ))}
      <span className="flex items-center gap-1.5 text-[var(--muted)]">
        <span className="h-0.5 w-5 bg-rose-400" /> risks
        <span className="ml-2 h-0.5 w-5 bg-violet-400" /> enables
        <span className="ml-2 h-0.5 w-5 bg-emerald-400" /> leads to
      </span>
    </div>
  );
}
