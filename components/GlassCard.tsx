import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  title,
  icon,
  actions,
}) => {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-glass-border bg-glass-100 shadow-[0_14px_40px_rgba(37,99,235,0.12)] backdrop-blur-xl transition-all duration-300 hover:bg-glass-200 ${className}`}
    >
      <div className="pointer-events-none absolute -inset-full top-0 block -skew-x-12 bg-gradient-to-r from-transparent via-white/40 to-sky-100 opacity-25 blur-lg" />

      {(title || icon) && (
        <div className="flex items-center justify-between border-b border-glass-border/80 p-4 bg-white/35">
          <div className="flex items-center gap-3">
            {icon && <div className="text-glass-text">{icon}</div>}
            {title && <h3 className="text-lg font-medium text-glass-text">{title}</h3>}
          </div>
          {actions && <div>{actions}</div>}
        </div>
      )}

      <div className="p-4 text-glass-text">{children}</div>
    </div>
  );
};
