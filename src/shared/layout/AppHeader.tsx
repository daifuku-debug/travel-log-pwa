import { useLocation } from 'react-router-dom';

export function AppHeader() {
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <div className="app-brand">
          <span className="app-brand__name">旅ログ</span>
          <span className="app-brand__tagline">写真と地図で、旅を積み重ねる</span>
        </div>
        {!isHome && (
          <span className="app-storage-status" aria-label="端末内に保存されています">
            <i aria-hidden="true" />端末内保存
          </span>
        )}
      </div>
    </header>
  );
}
