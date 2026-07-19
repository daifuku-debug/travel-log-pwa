export interface SkeletonProps {
  variant?: 'line' | 'block' | 'card';
  lines?: number;
  className?: string;
}

export function Skeleton({ variant = 'line', lines = 1, className }: SkeletonProps) {
  if (variant === 'card') {
    return <div className={['skeleton', 'skeleton-card', className ?? ''].filter(Boolean).join(' ')} aria-hidden="true" />;
  }
  if (variant === 'block') {
    return <div className={['skeleton', 'skeleton-block', className ?? ''].filter(Boolean).join(' ')} aria-hidden="true" />;
  }
  return (
    <div className={['skeleton-lines', className ?? ''].filter(Boolean).join(' ')} aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => <span className="skeleton skeleton-line" key={index} />)}
    </div>
  );
}
