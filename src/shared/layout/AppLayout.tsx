import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'ホーム', icon: '⌂', end: true },
  { to: '/trips', label: '旅行', icon: '✈' },
  { to: '/japan-map', label: '地図', icon: '◇' },
  { to: '/castles', label: '城', icon: '♜' },
  { to: '/time-machine', label: '時間', icon: '◷' },
  { to: '/rpg', label: 'RPG', icon: '★' },
  { to: '/collections', label: '収集', icon: '▣' },
  { to: '/wishlist', label: '欲しいもの', icon: '＋' },
  { to: '/settings', label: '設定', icon: '⚙' },
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
              className={({ isActive }) => (isActive ? 'bottom-nav__item active' : 'bottom-nav__item')}
            >
              <span className="bottom-nav__icon" aria-hidden="true">{item.icon}</span>
              <span className="bottom-nav__label">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
