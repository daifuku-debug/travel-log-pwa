import type { ReactNode } from 'react';

export function PageContainer({ children }: { children: ReactNode }) {
  return <main className="app-main">{children}</main>;
}
