import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function FeatureShortcut({
  to,
  title,
  description,
  icon,
  variant,
}: {
  to: string;
  title: string;
  description: string;
  icon: ReactNode;
  variant: 'time-machine' | 'gacha' | 'castle' | 'scrapbook';
}) {
  return (
    <Link className={`feature-shortcut feature-shortcut--${variant}`} to={to} aria-label={`${title}: ${description}`}>
      <span className="feature-shortcut__icon" aria-hidden="true">{icon}</span>
      <span><strong>{title}</strong><small>{description}</small></span>
    </Link>
  );
}
