import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Brain, Calendar, CornerDownLeft, FileText, GitBranch, Search, Sparkles, Target, Zap } from 'lucide-react';
import { useAppState, type SearchCategory, type SearchItem } from '../hooks/useAppState';
import { useSearch } from '../hooks/useSearch';

const ICONS: Record<SearchCategory, typeof Search> = {
  action: Zap,
  event: Calendar,
  attribute: Sparkles,
  opportunity: Target,
  node: GitBranch,
  evidence: FileText,
  brain: Brain,
};

const PLACEHOLDER = "Ask your brain… e.g. 'midterm', 'CHAI deadline', 'hackathon'";

export default function SmartSearch() {
  const navigate = useNavigate();
  const {
    searchOpen, setSearchOpen, setHighlightId, selectNode, resetDemo, generatePlan, showToast, unlockedStages, brainStatus,
  } = useAppState();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { groups, flat } = useSearch(query);

  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  useEffect(() => {
    if (searchOpen) {
      setQuery('');
      setCursor(0);
      window.setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [searchOpen]);

  useEffect(() => setCursor(0), [query]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${cursor}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const close = useCallback(() => setSearchOpen(false), [setSearchOpen]);

  const stageFor = (path: string) => ({ '/brain': 1, '/present': 2, '/future': 3, '/plan': 4 })[path] ?? 1;

  const go = useCallback(
    (path: string) => {
      const stage = stageFor(path);
      if (!unlockedStages.includes(stage)) {
        showToast(brainStatus === 'ready' ? 'Finish the previous step first' : 'Build your brain first', 'warning');
        navigate(`/${['', 'brain', 'present', 'future', 'plan'][Math.max(...unlockedStages)]}`);
        return false;
      }
      navigate(path);
      return true;
    },
    [unlockedStages, brainStatus, navigate, showToast],
  );

  const select = useCallback(
    (item: SearchItem) => {
      const { target } = item;
      close();
      switch (target.kind) {
        case 'action': {
          if (target.id === 'reset') {
            resetDemo();
            navigate('/');
          } else if (target.id === 'plan') {
            if (go('/plan')) void generatePlan();
          } else {
            go(target.path);
          }
          break;
        }
        case 'node': {
          if (go('/future')) selectNode(target.id);
          break;
        }
        case 'opportunity': {
          if (go('/future')) {
            selectNode(null);
            setHighlightId(target.id);
          }
          break;
        }
        default: {
          // event / evidence / attribute / brain → present profile page
          if (go('/present')) setHighlightId(target.id);
        }
      }
    },
    [close, go, navigate, resetDemo, generatePlan, selectNode, setHighlightId],
  );

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(flat.length - 1, c + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = flat[cursor];
      if (item) select(item);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  let runningIdx = -1;

  return (
    <>
      {/* Trigger in the nav */}
      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        className="group flex w-full max-w-[420px] items-center gap-2 border border-white/12 bg-white/[0.03] px-3 py-1.5 text-left text-xs text-white/45 transition hover:border-white/25 hover:bg-white/[0.06] hover:text-white/70"
        aria-label="Open smart search"
      >
        <Search size={13} className="shrink-0 text-white/50 group-hover:text-white/80" />
        <span className="hidden truncate sm:inline">Ask your brain…</span>
        <span className="inline truncate sm:hidden">Search</span>
        <span className="mono-label ml-auto hidden shrink-0 border border-white/15 px-1.5 py-0.5 text-[9px] text-white/40 md:inline">
          {isMac ? '⌘K' : 'Ctrl K'}
        </span>
      </button>

      <AnimatePresence>
        {searchOpen && (
          <motion.div
            key="search-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[80] flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-sm"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) close();
            }}
          >
            <motion.div
              initial={{ y: -12, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -8, opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="w-full max-w-[640px] overflow-hidden border border-white/15 bg-[rgba(6,6,8,0.92)] shadow-[0_30px_120px_rgba(0,0,0,0.7),0_0_0_1px_rgba(139,92,246,0.15)] backdrop-blur-2xl"
              role="dialog"
              aria-label="Smart search"
            >
              <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
                <Search size={16} className="shrink-0 text-violet-300" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onKey}
                  placeholder={PLACEHOLDER}
                  className="w-full bg-transparent text-[15px] text-white outline-none placeholder:text-white/35"
                  spellCheck={false}
                  autoComplete="off"
                />
                <button className="mono-label shrink-0 border border-white/15 px-1.5 py-0.5 text-[9px] text-white/50 hover:text-white" onClick={close}>
                  ESC
                </button>
              </div>

              <div ref={listRef} className="max-h-[56vh] overflow-y-auto py-1">
                {flat.length === 0 && (
                  <div className="px-4 py-8 text-center text-sm text-white/40">
                    {query ? (
                      <>No matches for <span className="text-white/70">“{query}”</span>. Try a class, a deadline, or an opportunity.</>
                    ) : (
                      'Type to search your calendar, evidence, opportunities and future map.'
                    )}
                  </div>
                )}
                {groups.map((g) => {
                  const Icon = ICONS[g.category];
                  return (
                    <div key={g.category} className="py-1">
                      <div className="mono-label flex items-center gap-2 px-4 pb-1 pt-2 text-[9.5px] text-white/35">
                        <span className={g.category === 'brain' ? 'text-violet-300/80' : ''}>{g.label}</span>
                        <span className="h-px flex-1 bg-white/8" />
                      </div>
                      {g.items.map((item) => {
                        runningIdx += 1;
                        const idx = runningIdx;
                        const active = idx === cursor;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            data-idx={idx}
                            onMouseEnter={() => setCursor(idx)}
                            onClick={() => select(item)}
                            className={`flex w-full items-center gap-3 px-4 py-2 text-left transition ${
                              active ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'
                            }`}
                          >
                            <span
                              className={`grid h-7 w-7 shrink-0 place-items-center border ${
                                active ? 'border-violet-400/50 text-violet-200' : 'border-white/12 text-white/50'
                              }`}
                            >
                              <Icon size={13} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className={`block truncate text-sm ${active ? 'text-white' : 'text-white/85'}`}>{item.title}</span>
                              {item.subtitle && <span className="block truncate text-[11px] text-white/40">{item.subtitle}</span>}
                            </span>
                            {item.target.sourceRef && g.category === 'brain' && (
                              <span className="mono-label hidden shrink-0 text-[9px] text-white/35 sm:inline">{item.target.sourceRef}</span>
                            )}
                            {active && <CornerDownLeft size={12} className="shrink-0 text-white/40" />}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              <div className="mono-label flex items-center gap-4 border-t border-white/10 px-4 py-2 text-[9px] text-white/35">
                <span>↑↓ navigate</span>
                <span>↵ open</span>
                <span>esc close</span>
                <span className="ml-auto text-white/25">Local + Cognee</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
