import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Brain, Calendar, FileJson, FileText, FileUp, Sparkles, Trash2, Upload } from 'lucide-react';
import GlassPanel from '../components/GlassPanel';
import ProgressSteps from '../components/ProgressSteps';
import BrainGraph from '../components/BrainGraph';
import { api } from '../services/api';
import { BUILD_STEPS, useAppState } from '../hooks/useAppState';
import type { BrainGraphData, PersonalSource } from '../types';
import { PRIVACY_LINE } from '../types';

const ACCEPT = ['.txt', '.md', '.pdf', '.json', '.ics'];
const MAX_MB = 5;

const iconFor = (type: PersonalSource['type'], name: string) => {
  if (type === 'calendar' || name.endsWith('.ics')) return Calendar;
  if (name.endsWith('.json')) return FileJson;
  if (type === 'upload') return FileUp;
  return FileText;
};

export default function BrainBuilderPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { brainStatus, brainMode, buildStep, pendingSources, addPendingSource, removePendingSource, buildBrain, loadDemo, showToast, profile } = useAppState();
  const [notes, setNotes] = useState('');
  const [dragging, setDragging] = useState(false);
  const [useSample, setUseSample] = useState(false);
  const fileContents = useRef<Record<string, string | null>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const [brainGraph, setBrainGraph] = useState<BrainGraphData | null>(null);

  // Once the 5-step build completes, fetch the Cognee knowledge graph (client-side demo graph if the API is offline).
  useEffect(() => {
    if (brainStatus !== 'ready') {
      setBrainGraph(null);
      return;
    }
    let alive = true;
    void api.brainGraph().then(({ data }) => {
      if (alive) setBrainGraph(data);
    });
    return () => {
      alive = false;
    };
  }, [brainStatus]);

  useEffect(() => {
    if (params.get('demo') === '1' && brainStatus === 'idle' && !profile) void loadDemo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      Array.from(files).forEach((f) => {
        const ext = '.' + f.name.split('.').pop()?.toLowerCase();
        if (!ACCEPT.includes(ext)) {
          showToast(`${f.name}: unsupported type. Accepted: ${ACCEPT.join(' ')}`, 'warning');
          return;
        }
        if (f.size > MAX_MB * 1024 * 1024) {
          showToast(`${f.name} exceeds ${MAX_MB} MB`, 'warning');
          return;
        }
        const id = `up_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const type: PersonalSource['type'] = ext === '.ics' ? 'calendar' : ext === '.pdf' ? 'document' : ext === '.md' || ext === '.txt' ? 'note' : 'upload';
        const src: PersonalSource = { id, name: f.name, type, date: new Date().toISOString().slice(0, 10), excerpt: `${(f.size / 1024).toFixed(1)} KB`, record_id: id };
        addPendingSource(src);
        if (ext === '.pdf') fileContents.current[id] = null;
        else f.text().then((t) => (fileContents.current[id] = t.slice(0, 200_000)));
      });
    },
    [addPendingSource, showToast],
  );

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const importSample = () => {
    setUseSample(true);
    if (!pendingSources.some((s) => s.id === 'src_cal')) {
      addPendingSource({ id: 'src_cal', name: 'Sam_fall2026.ics', type: 'calendar', date: '2026-09-21', excerpt: '10 events, Mon 21 Sep – Sun 27 Sep 2026 (sample)', record_id: 'rec_cal_001' });
    }
    showToast('Sample calendar imported', 'success');
  };

  const addNotes = () => {
    if (!notes.trim()) return;
    addPendingSource({ id: `note_${Date.now()}`, name: 'Pasted notes', type: 'note', date: new Date().toISOString().slice(0, 10), excerpt: notes.slice(0, 90), record_id: `note_${Date.now()}` });
    setNotes('');
  };

  const build = async () => {
    const files = pendingSources
      .filter((s) => s.id.startsWith('up_'))
      .map((s) => ({ name: s.name, type: s.type, size: 0, content: fileContents.current[s.id] ?? null }));
    const pasted = pendingSources.filter((s) => s.id.startsWith('note_')).map((s) => s.excerpt).join('\n\n');
    await buildBrain({ notes: pasted || notes, files, use_sample_calendar: useSample || pendingSources.length === 0 });
  };

  const building = brainStatus === 'building';
  const ready = brainStatus === 'ready';

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <span className="chip border-cyan-400/40 text-cyan-300">Stage 1 · See life</span>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Build your personal brain</h1>
        <p className="mt-2 max-w-2xl text-slate-300">Add a calendar export, notes or documents. {PRIVACY_LINE}</p>
      </motion.div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <div
            className={`glass grid place-items-center border-dashed p-8 text-center transition ${dragging ? 'border-violet-400 bg-violet-500/10' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <Upload size={28} className="text-violet-300" />
            <p className="mt-3 font-semibold">Drag and drop files here</p>
            <p className="mt-1 text-xs text-[var(--muted)]">Accepted: {ACCEPT.join(', ')} · max {MAX_MB} MB per file</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button className="btn btn-sm" onClick={() => inputRef.current?.click()} disabled={building}>
                <FileUp size={14} /> Choose files
              </button>
              <button className="btn btn-sm" onClick={importSample} disabled={building}>
                <Calendar size={14} /> Import sample calendar
              </button>
            </div>
            <input ref={inputRef} type="file" multiple accept={ACCEPT.join(',')} className="hidden" onChange={(e) => e.target.files && addFiles(e.target.files)} />
          </div>

          <GlassPanel title="Paste notes" subtitle="Goals, reflections, plans — plain text is fine.">
            <textarea
              className="h-32 w-full resize-none rounded-xl border border-[var(--border)] bg-black/20 p-3 text-sm outline-none focus:border-violet-400/60"
              placeholder="e.g. This semester I want to join a research lab and ship one public project..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={building}
            />
            <div className="mt-2 flex justify-end">
              <button className="btn btn-sm" onClick={addNotes} disabled={building || !notes.trim()}>
                Add notes
              </button>
            </div>
          </GlassPanel>

          <GlassPanel title={`Sources (${pendingSources.length})`}>
            {pendingSources.length === 0 && <p className="text-sm text-[var(--muted)]">No sources yet. Add files, paste notes, or continue with the demo brain.</p>}
            <ul className="space-y-2">
              {pendingSources.map((s) => {
                const Icon = iconFor(s.type, s.name);
                return (
                  <li key={s.id} className="flex items-center gap-3 rounded-xl border border-[var(--border)] px-3 py-2">
                    <Icon size={16} className="text-cyan-300" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{s.name}</div>
                      <div className="truncate text-xs text-[var(--muted)]">{s.type} · {s.date ?? '—'} · {s.excerpt}</div>
                    </div>
                    {!building && (
                      <button className="text-[var(--muted)] hover:text-rose-300" onClick={() => removePendingSource(s.id)} aria-label="Remove">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </GlassPanel>
        </div>

        <div className="space-y-5">
          <GlassPanel strong title="Brain status">
            <div className="flex items-center gap-3">
              <span className={`grid h-12 w-12 place-items-center rounded-2xl ${ready ? 'bg-emerald-400/20 text-emerald-300 glow-green' : 'bg-violet-500/20 text-violet-200'}`}>
                <Brain size={22} />
              </span>
              <div>
                <div className="text-lg font-bold">{brainMode === 'cognee' ? 'Cognee' : 'Demo Brain'}</div>
                <div className="text-xs text-[var(--muted)]">
                  {ready ? 'Knowledge graph ready' : building ? 'Building…' : 'Not built yet'}
                  {brainMode === 'demo' && ' · offline demo data'}
                </div>
              </div>
            </div>
            <div className="mt-5">
              <ProgressSteps steps={BUILD_STEPS} current={brainStatus === 'idle' ? -1 : buildStep} done={ready} />
            </div>
            {ready && brainGraph && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-5">
                <BrainGraph data={brainGraph} height={300} />
                <p className="mt-2 text-[11px] text-[var(--muted)]">Every attribute links back to a source; hover a node to see what it is connected to.</p>
              </motion.div>
            )}
          </GlassPanel>

          <GlassPanel>
            {!ready ? (
              <button className="btn btn-primary w-full justify-center" onClick={build} disabled={building}>
                <Sparkles size={16} /> {pendingSources.length ? 'Build my brain' : 'Build with demo data'}
              </button>
            ) : (
              <button className="btn btn-primary w-full justify-center" onClick={() => navigate('/present')}>
                Continue to Current Self <ArrowRight size={16} />
              </button>
            )}
            <p className="mt-3 text-center text-xs text-[var(--muted)]">Every interpretation is linked to its source and can be rejected.</p>
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}
