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
      className={`glass-panel relative overflow-hidden ${className}`}
    >

      {(title || icon) && (
        <div className="flex items-center justify-between glass-header p-4">
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
