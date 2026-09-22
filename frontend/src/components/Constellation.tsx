import { useEffect, useRef } from 'react';

type Pt = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hi: 0 | 1 | 2 | 3; // 0 = plain, 1 = violet, 2 = cyan, 3 = coral
  phase: number;
};

const COLORS = ['rgba(255,255,255,', 'rgba(139,92,246,', 'rgba(34,211,238,', 'rgba(251,113,133,'];

export default function Constellation({ className = '', count = 52 }: { className?: string; count?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let raf = 0;
    let w = 0;
    let h = 0;
    let dpr = 1;
    const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
    let pts: Pt[] = [];

    const seed = () => {
      pts = Array.from({ length: count }, (_, i) => {
        const hi: Pt['hi'] = i % 9 === 0 ? 1 : i % 9 === 4 ? 2 : i % 13 === 7 ? 3 : 0;
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.18,
          vy: (Math.random() - 0.5) * 0.18,
          r: hi ? 2.2 + Math.random() * 1.2 : 1 + Math.random() * 1.1,
          hi,
          phase: Math.random() * Math.PI * 2,
        };
      });
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (pts.length === 0) seed();
      else pts.forEach((p) => { p.x = Math.min(p.x, w); p.y = Math.min(p.y, h); });
    };

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.tx = (e.clientX - rect.left) / Math.max(1, rect.width);
      mouse.ty = (e.clientY - rect.top) / Math.max(1, rect.height);
    };

    const LINK = 130;
    let t = 0;

    const draw = () => {
      t += 1;
      mouse.x += (mouse.tx - mouse.x) * 0.04;
      mouse.y += (mouse.ty - mouse.y) * 0.04;
      const ox = (mouse.x - 0.5) * 22;
      const oy = (mouse.y - 0.5) * 16;

      ctx.clearRect(0, 0, w, h);

      if (!reduced) {
        for (const p of pts) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < -10) p.x = w + 10;
          if (p.x > w + 10) p.x = -10;
          if (p.y < -10) p.y = h + 10;
          if (p.y > h + 10) p.y = -10;
        }
      }

      // links
      ctx.lineWidth = 1;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        for (let j = i + 1; j < pts.length; j++) {
          const b = pts[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > LINK * LINK) continue;
          const d = Math.sqrt(d2);
          const alpha = (1 - d / LINK) * 0.22;
          const tinted = a.hi || b.hi;
          ctx.strokeStyle = tinted ? `${COLORS[a.hi || b.hi]}${alpha * 1.6})` : `rgba(255,255,255,${alpha})`;
          ctx.beginPath();
          ctx.moveTo(a.x + ox * (a.r / 3), a.y + oy * (a.r / 3));
          ctx.lineTo(b.x + ox * (b.r / 3), b.y + oy * (b.r / 3));
          ctx.stroke();
        }
      }

      // nodes
      for (const p of pts) {
        const px = p.x + ox * (p.r / 3);
        const py = p.y + oy * (p.r / 3);
        if (p.hi) {
          const pulse = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(t * 0.03 + p.phase);
          const g = ctx.createRadialGradient(px, py, 0, px, py, 14 + pulse * 10);
          g.addColorStop(0, `${COLORS[p.hi]}${0.5 + pulse * 0.3})`);
          g.addColorStop(1, `${COLORS[p.hi]}0)`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(px, py, 14 + pulse * 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = `${COLORS[p.hi]}1)`;
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.75)';
        }
        ctx.beginPath();
        ctx.arc(px, py, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!reduced) raf = requestAnimationFrame(draw);
    };

    resize();
    draw();
    const ro = new ResizeObserver(() => { resize(); if (reduced) draw(); });
    ro.observe(canvas);
    window.addEventListener('mousemove', onMove, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('mousemove', onMove);
    };
  }, [count]);

  return <canvas ref={ref} className={`pointer-events-none block h-full w-full ${className}`} aria-hidden="true" />;
}
