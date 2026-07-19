import type { ReactNode } from 'react';

export type BadgeVariant = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

export interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = 'neutral', className }: BadgeProps) {
  const classes = ['status-badge', `badge--${variant}`, className ?? ''].filter(Boolean).join(' ');
  return <span className={classes}>{children}</span>;
}
