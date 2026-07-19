import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

export function PageContainer({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isTripJournal = /^\/trips\/[^/]+$/.test(location.pathname);
  const isScrapbook = /^\/trips\/[^/]+\/scrapbook$/.test(location.pathname);
  const className = location.pathname === '/'
    ? 'app-main app-main--home'
    : isTripJournal ? 'app-main app-main--journal'
      : isScrapbook ? 'app-main app-main--scrapbook'
        : 'app-main';
  return <main className={className}>{children}</main>;
}
