import type { HTMLAttributes, ReactNode } from 'react';

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  strong?: boolean;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
}

export default function GlassPanel({ children, strong, title, subtitle, action, className = '', ...rest }: Props) {
  return (
    <div className={`glass ${strong ? 'glass-strong' : ''} p-5 ${className}`} {...rest}>
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">{title}</h3>}
            {subtitle && <p className="mt-1 text-sm text-slate-300">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
