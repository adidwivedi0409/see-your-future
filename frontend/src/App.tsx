import { useEffect, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Nav from './components/Nav';
import Toast from './components/Toast';
import { AppStateProvider, useAppState } from './hooks/useAppState';
import LandingPage from './pages/LandingPage';
import BrainBuilderPage from './pages/BrainBuilderPage';
import PresentProfilePage from './pages/PresentProfilePage';
import FutureMapPage from './pages/FutureMapPage';
import ActionPlanPage from './pages/ActionPlanPage';

const STAGE_PATH: Record<number, string> = { 1: '/brain', 2: '/present', 3: '/future', 4: '/plan' };

/** Progressive disclosure: a locked stage redirects to the highest unlocked one. */
function StageGuard({ stage, children }: { stage: number; children: ReactNode }) {
  const { unlockedStages, brainStatus, markStageVisited, showToast } = useAppState();
  const { search } = useLocation();
  const unlocked = unlockedStages.includes(stage);
  const highest = Math.max(...unlockedStages);

  useEffect(() => {
    if (unlocked) markStageVisited(stage);
  }, [unlocked, stage, markStageVisited]);

  useEffect(() => {
    if (!unlocked) showToast(brainStatus === 'ready' ? 'Finish the previous step first' : 'Build your brain first', 'warning');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked]);

  if (!unlocked) return <Navigate to={`${STAGE_PATH[highest] ?? '/brain'}${search}`} replace />;
  return <>{children}</>;
}

/** Global ⌘K / Ctrl+K toggles the smart search; Esc closes it. */
function Hotkeys() {
  const { searchOpen, setSearchOpen } = useAppState();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(!searchOpen);
      } else if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchOpen, setSearchOpen]);
  return null;
}

export default function App() {
  return (
    <AppStateProvider>
      <BrowserRouter>
        <div className="bg-scene" />
        <Hotkeys />
        <Nav />
        <main>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/brain" element={<StageGuard stage={1}><BrainBuilderPage /></StageGuard>} />
            <Route path="/present" element={<StageGuard stage={2}><PresentProfilePage /></StageGuard>} />
            <Route path="/future" element={<StageGuard stage={3}><FutureMapPage /></StageGuard>} />
            <Route path="/plan" element={<StageGuard stage={4}><ActionPlanPage /></StageGuard>} />
            <Route path="*" element={<LandingPage />} />
          </Routes>
        </main>
        <Toast />
      </BrowserRouter>
    </AppStateProvider>
  );
}
