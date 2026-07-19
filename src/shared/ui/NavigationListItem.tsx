import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export interface NavigationListItemProps {
  to: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  badge?: ReactNode;
}

export function NavigationListItem({ to, title, description, icon, badge }: NavigationListItemProps) {
  return (
    <Link className="navigation-list-item" to={to} aria-label={description ? `${title}: ${description}` : title}>
      {icon && <span className="navigation-list-item__icon" aria-hidden="true">{icon}</span>}
      <span className="navigation-list-item__content">
        <strong>{title}</strong>
        {description && <span>{description}</span>}
      </span>
      {badge}
      <span className="navigation-list-item__arrow" aria-hidden="true">›</span>
    </Link>
  );
}
