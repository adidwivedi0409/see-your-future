import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../services/api';
import { useAppState, type SearchCategory, type SearchItem } from './useAppState';

export type { SearchCategory, SearchItem };

export interface SearchGroup {
  category: SearchCategory;
  label: string;
  items: SearchItem[];
}

export const CATEGORY_LABELS: Record<SearchCategory, string> = {
  action: 'ACTIONS',
  event: 'CALENDAR',
  attribute: 'ABOUT YOU',
  opportunity: 'OPPORTUNITIES',
  node: 'FUTURE MAP',
  evidence: 'EVIDENCE',
  brain: 'FROM YOUR BRAIN (Cognee)',
};

const ORDER: SearchCategory[] = ['action', 'event', 'attribute', 'opportunity', 'node', 'evidence', 'brain'];
const MAX_PER_GROUP = 8;

function score(item: SearchItem, q: string, tokens: string[]): number {
  const title = item.title.toLowerCase();
  const sub = (item.subtitle ?? '').toLowerCase();
  const kw = (item.keywords ?? '').toLowerCase();
  let s = 0;
  if (title === q) s += 100;
  else if (title.startsWith(q)) s += 60;
  else if (title.includes(q)) s += 40;
  if (sub.includes(q)) s += 15;
  if (kw.includes(q)) s += 8;
  for (const t of tokens) {
    if (!t) continue;
    if (title.includes(t)) s += 12;
    else if (sub.includes(t)) s += 5;
    else if (kw.includes(t)) s += 3;
  }
  return s;
}

/** Shape returned by the optional backend search endpoint; tolerant to variations. */
interface BrainHit {
  id?: string;
  title?: string;
  text?: string;
  snippet?: string;
  source?: string;
  source_ref?: string;
  score?: number;
}

type SearchFn = (query: string) => Promise<{ data: unknown; fromApi: boolean } | unknown>;

async function brainSearch(query: string): Promise<BrainHit[]> {
  // Prefer a search helper if api.ts exposes one; otherwise hit the endpoint directly.
  const bag = api as unknown as Record<string, unknown>;
  const fn = (bag.search ?? bag.brainSearch ?? bag.searchBrain) as SearchFn | undefined;
  let raw: unknown;
  if (typeof fn === 'function') {
    raw = await fn(query);
    if (raw && typeof raw === 'object' && 'data' in (raw as object)) {
      const r = raw as { data: unknown; fromApi?: boolean };
      if (r.fromApi === false) return [];
      raw = r.data;
    }
  } else {
    const ctrl = new AbortController();
    const t = window.setTimeout(() => ctrl.abort(), 2500);
    try {
      const res = await fetch('/api/brain/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        signal: ctrl.signal,
      });
      if (!res.ok) return [];
      raw = await res.json();
    } finally {
      window.clearTimeout(t);
    }
  }
  if (Array.isArray(raw)) return raw as BrainHit[];
  if (raw && typeof raw === 'object') {
    const r = raw as { results?: BrainHit[]; hits?: BrainHit[]; items?: BrainHit[] };
    return r.results ?? r.hits ?? r.items ?? [];
  }
  return [];
}

export function useSearch(query: string) {
  const { searchIndex } = useAppState();
  const [brainItems, setBrainItems] = useState<SearchItem[]>([]);
  const seq = useRef(0);

  const q = query.trim().toLowerCase();
  const tokens = useMemo(() => q.split(/\s+/).filter(Boolean), [q]);

  const localGroups = useMemo<SearchGroup[]>(() => {
    const byCat = new Map<SearchCategory, { item: SearchItem; s: number }[]>();
    if (!q) {
      // Empty query: show actions as a launcher.
      const actions = searchIndex.filter((i) => i.category === 'action');
      return actions.length ? [{ category: 'action', label: CATEGORY_LABELS.action, items: actions }] : [];
    }
    for (const item of searchIndex) {
      const s = score(item, q, tokens);
      if (s <= 0) continue;
      const list = byCat.get(item.category) ?? [];
      list.push({ item, s });
      byCat.set(item.category, list);
    }
    return ORDER.filter((c) => byCat.has(c)).map((c) => ({
      category: c,
      label: CATEGORY_LABELS[c],
      items: (byCat.get(c) ?? []).sort((a, b) => b.s - a.s).slice(0, MAX_PER_GROUP).map((x) => x.item),
    }));
  }, [q, tokens, searchIndex]);

  // Debounced backend search; failures are silent.
  useEffect(() => {
    if (!q || q.length < 2) {
      setBrainItems([]);
      return;
    }
    const mine = ++seq.current;
    const t = window.setTimeout(async () => {
      try {
        const hits = await brainSearch(q);
        if (mine !== seq.current) return;
        setBrainItems(
          hits.slice(0, MAX_PER_GROUP).map((h, i) => ({
            id: `brain:${h.id ?? i}`,
            category: 'brain',
            title: h.title ?? h.text ?? h.snippet ?? 'Result',
            subtitle: [h.source ?? h.source_ref, h.title && (h.text ?? h.snippet)].filter(Boolean).join(' · '),
            target: { kind: 'brain', id: String(h.id ?? i), path: '/present', sourceRef: h.source ?? h.source_ref },
          })),
        );
      } catch {
        if (mine === seq.current) setBrainItems([]);
      }
    }, 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const groups = useMemo<SearchGroup[]>(
    () => (brainItems.length ? [...localGroups, { category: 'brain', label: CATEGORY_LABELS.brain, items: brainItems }] : localGroups),
    [localGroups, brainItems],
  );

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  return { groups, flat };
}
