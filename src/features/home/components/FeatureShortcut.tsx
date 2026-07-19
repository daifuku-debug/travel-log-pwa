import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function FeatureShortcut({
  to,
  title,
  description,
  icon,
  accent = false,
}: {
  to: string;
  title: string;
  description: string;
  icon: ReactNode;
  accent?: boolean;
}) {
  return (
    <Link className={`feature-shortcut ${accent ? 'feature-shortcut--accent' : ''}`} to={to} aria-label={`${title}: ${description}`}>
      <span className="feature-shortcut__icon" aria-hidden="true">{icon}</span>
      <span><strong>{title}</strong><small>{description}</small></span>
    </Link>
  );
}
