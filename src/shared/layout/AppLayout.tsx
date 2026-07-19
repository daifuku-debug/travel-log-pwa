import { Outlet } from 'react-router-dom';
import { BottomNavigation } from '../navigation/BottomNavigation';
import { PageContainer } from './PageContainer';
import { ToastProvider } from '../ui/Toast';

export function AppLayout() {
  return (
    <ToastProvider>
      <div className="app-shell">
        <PageContainer>
          <Outlet />
        </PageContainer>
        <BottomNavigation />
      </div>
    </ToastProvider>
  );
}
