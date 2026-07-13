import type { AppError } from '../errors';
import type { ReactNode } from 'react';

export function LoadingState() {
  return <div className="status-banner">読み込み中...</div>;
}

export function ErrorState({ error }: { error: AppError }) {
  return <div className="status-banner">エラー: {error.message}</div>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="empty-state">{children}</div>;
}
