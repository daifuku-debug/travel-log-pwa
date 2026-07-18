import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'ホーム', end: true },
  { to: '/trips', label: '旅行' },
  { to: '/japan-map', label: '地図' },
  { to: '/rpg', label: 'RPG' },
  { to: '/collections', label: '収集' },
  { to: '/wishlist', label: '欲しいもの' },
  { to: '/settings', label: '設定' },
];

export function AppLayout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__inner">
          <div className="app-brand">
            <span className="app-brand__name">旅ログ</span>
            <span className="app-brand__tagline">旅行・お出かけ・コレクション記録</span>
          </div>
          <span className="sync-pill">端末内保存</span>
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>

      <nav className="bottom-nav" aria-label="主要ナビゲーション">
        <div className="bottom-nav__inner">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                isActive ? 'bottom-nav__item active' : 'bottom-nav__item'
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
