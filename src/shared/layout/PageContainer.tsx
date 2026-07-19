import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

export function PageContainer({ children }: { children: ReactNode }) {
  const location = useLocation();
  return <main className={location.pathname === '/' ? 'app-main app-main--home' : 'app-main'}>{children}</main>;
}
