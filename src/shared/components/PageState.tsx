import type { AppError } from '../errors';
import type { ReactNode } from 'react';
import { Skeleton } from '../ui/Skeleton';

export function LoadingState({
  message = '読み込み中...',
  variant = 'banner',
}: {
  message?: string;
  variant?: 'banner' | 'skeleton';
}) {
  if (variant === 'skeleton') {
    return (
      <div className="loading-state" aria-live="polite" aria-busy="true">
        <span className="sr-only">{message}</span>
        <Skeleton variant="card" />
      </div>
    );
  }
  return (
    <div className="status-banner loading-state" aria-live="polite" aria-busy="true">
      <span className="loading-dot" aria-hidden="true" />
      {message}
    </div>
  );
}

export function ErrorState({ error }: { error: AppError }) {
  return <div className="status-banner" role="alert">エラー: {error.message}</div>;
}

export function EmptyState({
  children,
  title,
  description,
  icon,
  action,
  secondaryAction,
}: {
  children?: ReactNode;
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  secondaryAction?: ReactNode;
}) {
  if (!title && !description && !icon && !action && !secondaryAction) {
    return <div className="empty-state">{children}</div>;
  }
  return (
    <div className="empty-state empty-state--rich">
      {icon && <div className="empty-state__icon" aria-hidden="true">{icon}</div>}
      {title && <h2>{title}</h2>}
      {description && <p>{description}</p>}
      {children}
      {(action || secondaryAction) && (
        <div className="inline-actions empty-state__actions">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
