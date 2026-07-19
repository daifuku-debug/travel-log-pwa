import type { ReactNode } from 'react';

export interface InlineErrorProps {
  message: string;
  title?: string;
  action?: ReactNode;
  compact?: boolean;
}

export function InlineError({ message, title, action, compact = false }: InlineErrorProps) {
  return (
    <div className={compact ? 'form-errors inline-error inline-error--compact' : 'form-errors inline-error'} role="alert">
      {title && <strong>{title}</strong>}
      <span>{message}</span>
      {action && <div className="inline-actions">{action}</div>}
    </div>
  );
}
