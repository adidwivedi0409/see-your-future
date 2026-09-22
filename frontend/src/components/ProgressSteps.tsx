import { motion } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';

interface Props {
  steps: string[];
  current: number;
  done: boolean;
}

export default function ProgressSteps({ steps, current, done }: Props) {
  return (
    <ol className="space-y-3">
      {steps.map((label, i) => {
        const state = done || i < current ? 'done' : i === current ? 'active' : 'todo';
        return (
          <motion.li
            key={label}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: state === 'todo' ? 0.45 : 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center gap-3"
          >
            <span
              className={`grid h-7 w-7 place-items-center rounded-full border text-xs font-bold ${
                state === 'done'
                  ? 'border-emerald-400/60 bg-emerald-400/20 text-emerald-300'
                  : state === 'active'
                    ? 'border-violet-400/70 bg-violet-500/20 text-violet-200 shadow-[0_0_16px_rgba(139,92,246,0.5)]'
                    : 'border-[var(--border-strong)] text-[var(--muted)]'
              }`}
            >
              {state === 'done' ? <Check size={14} /> : state === 'active' ? <Loader2 size={14} className="animate-spin" /> : i + 1}
            </span>
            <span className={`text-sm ${state === 'active' ? 'font-semibold text-white' : ''}`}>{label}</span>
          </motion.li>
        );
      })}
    </ol>
  );
}
