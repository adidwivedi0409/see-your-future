import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, FileText, FlaskConical, Quote, StickyNote, Upload, X } from 'lucide-react';
import type { PersonalEvidence, PersonalSource, ProfileAttribute, SourceType } from '../types';

interface Props {
  attribute: ProfileAttribute | null;
  evidence: PersonalEvidence[];
  sources: PersonalSource[];
  onClose: () => void;
  onReject: (id: string) => void;
}

const SOURCE_META: Record<SourceType, { label: string; color: string; Icon: typeof Calendar }> = {
  calendar: { label: 'calendar', color: 'var(--amber)', Icon: Calendar },
  note: { label: 'note', color: 'var(--cyan)', Icon: StickyNote },
  document: { label: 'document', color: 'var(--blue)', Icon: FileText },
  upload: { label: 'upload', color: 'var(--violet)', Icon: Upload },
  demo: { label: 'demo', color: 'var(--muted)', Icon: FlaskConical },
};

function fmtDate(d: string | null): string | null {
  if (!d) return null;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function EvidenceDrawer({ attribute, evidence, sources, onClose, onReject }: Props) {
  const items = attribute ? evidence.filter((e) => attribute.evidence_ids.includes(e.id)) : [];
  const srcById = new Map(sources.map((s) => [s.id, s]));
  const distinctSources = new Set(items.map((e) => e.source_id)).size;

  return (
    <AnimatePresence>
      {attribute && (
        <>
          <motion.div key="backdrop" className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            key="drawer"
            className="glass glass-strong fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col rounded-none border-l"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            role="dialog"
            aria-label={`Evidence for ${attribute.label}`}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] p-5">
              <div className="min-w-0">
                <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300">Why we think this</div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="chip">{attribute.kind}</span>
                  <span className="text-xs tabular-nums text-[var(--muted)]">{Math.round(attribute.confidence * 100)}% confidence</span>
                </div>
                <h3 className="mt-2 text-lg font-bold leading-snug">{attribute.label}</h3>
              </div>
              <button className="btn btn-sm" onClick={onClose} aria-label="Close">
                <X size={14} />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-xs text-amber-200">
                <div className="font-semibold">This is an interpretation, not a fact.</div>
                <div className="mt-0.5 text-amber-200/80">{attribute.disclaimer}</div>
              </div>

              <div className="flex items-center justify-between">
                <h4 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">Evidence · {items.length}</h4>
                <span className="text-[11px] text-[var(--muted)]">
                  {distinctSources} source{distinctSources === 1 ? '' : 's'} · recalled from your brain
                </span>
              </div>

              {items.length === 0 && <p className="text-sm text-[var(--muted)]">No linked evidence. Treat this as a weak inference.</p>}

              {items.map((e, i) => {
                const src = srcById.get(e.source_id);
                const meta = SOURCE_META[src?.type ?? 'demo'];
                const Icon = meta.Icon;
                const date = fmtDate(e.date ?? src?.date ?? null);
                return (
                  <motion.div
                    key={e.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="relative rounded-xl border border-[var(--border)] bg-white/[0.02] p-3"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md" style={{ color: meta.color, background: `color-mix(in srgb, ${meta.color} 14%, transparent)` }}>
                          <Icon size={11} />
                        </span>
                        <span className="truncate font-medium text-slate-200">{src?.name ?? e.source_id}</span>
                        <span className="chip !px-1.5 !py-0 text-[9px]" style={{ color: meta.color, borderColor: `${meta.color}55` }}>{meta.label}</span>
                      </span>
                      {date && <span className="shrink-0 font-mono text-[10px] text-[var(--muted)]">{date}</span>}
                    </div>
                    <blockquote className="mt-2 border-l-2 pl-3 text-sm italic leading-relaxed text-slate-200" style={{ borderColor: meta.color }}>
                      <Quote size={11} className="mb-0.5 mr-1 inline opacity-50" />
                      {e.text}
                    </blockquote>
                    {src?.record_id && <div className="mt-1.5 font-mono text-[10px] text-[var(--muted)]">record {src.record_id}</div>}
                  </motion.div>
                );
              })}
            </div>

            <div className="border-t border-[var(--border)] p-5">
              <button
                className="btn btn-danger w-full justify-center"
                onClick={() => {
                  onReject(attribute.id);
                  onClose();
                }}
              >
                Reject inference
              </button>
              <p className="mt-2 text-center text-xs text-[var(--muted)]">Removes this interpretation from your profile and teaches your brain (remember_user_feedback).</p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
