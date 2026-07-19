import type { ReactNode } from 'react';
import { Button } from './Button';

export interface PageHeaderProps {
  title: string;
  description?: string;
  backTo?: string;
  backLabel?: string;
  actions?: ReactNode;
  eyebrow?: string;
}

export function PageHeader({
  title,
  description,
  backTo,
  backLabel = '戻る',
  actions,
  eyebrow,
}: PageHeaderProps) {
  return (
    <section className="page-heading">
      {backTo && (
        <div>
          <Button to={backTo} variant="ghost" size="sm">{backLabel}</Button>
        </div>
      )}
      <div className="page-heading__row">
        <div>
          {eyebrow && <div className="page-heading__eyebrow">{eyebrow}</div>}
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </div>
        {actions && <div className="inline-actions page-heading__actions">{actions}</div>}
      </div>
    </section>
  );
}
