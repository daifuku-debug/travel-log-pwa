import { Outlet } from 'react-router-dom';
import { BottomNavigation } from '../navigation/BottomNavigation';
import { AppHeader } from './AppHeader';
import { PageContainer } from './PageContainer';

export function AppLayout() {
  return (
    <div className="app-shell">
      <AppHeader />
      <PageContainer>
        <Outlet />
      </PageContainer>
      <BottomNavigation />
    </div>
  );
}
