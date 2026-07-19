import type { ElementType, ReactNode } from 'react';

export interface CardProps {
  children: ReactNode;
  title?: string;
  description?: string;
  actions?: ReactNode;
  variant?: 'default' | 'subtle';
  className?: string;
  as?: ElementType;
}

export function Card({
  children,
  title,
  description,
  actions,
  variant = 'default',
  className,
  as,
}: CardProps) {
  const Component = as ?? 'section';
  const classes = ['card', variant === 'subtle' ? 'card--subtle' : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <Component className={classes}>
      {(title || description || actions) && (
        <div className="section-head">
          <div>
            {title && <h2>{title}</h2>}
            {description && <p className="muted">{description}</p>}
          </div>
          {actions && <div className="inline-actions">{actions}</div>}
        </div>
      )}
      {children}
    </Component>
  );
}
