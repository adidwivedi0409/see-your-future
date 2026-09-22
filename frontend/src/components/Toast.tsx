import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import { useAppState } from '../hooks/useAppState';

export default function Toast() {
  const { toast, dismissToast } = useAppState();
  const Icon = toast?.tone === 'success' ? CheckCircle2 : toast?.tone === 'warning' ? TriangleAlert : Info;
  const color = toast?.tone === 'success' ? 'var(--green)' : toast?.tone === 'warning' ? 'var(--amber)' : 'var(--cyan)';
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          className="glass glass-strong fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 px-4 py-3 text-sm"
          style={{ borderColor: `${color}66` }}
          onClick={dismissToast}
        >
          <Icon size={16} style={{ color }} />
          {toast.message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
