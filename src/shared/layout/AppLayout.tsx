import type { ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'ホーム', icon: <HomeIcon />, end: true },
  { to: '/trips', label: '旅行', icon: <SuitcaseIcon /> },
  { to: '/japan-map', label: '地図', icon: <MapIcon /> },
  { to: '/castles', label: '城', icon: <CastleIcon /> },
  { to: '/time-machine', label: '時間', icon: <ClockIcon /> },
  { to: '/travel-gacha', label: 'ガチャ', icon: <GachaIcon /> },
  { to: '/rpg', label: 'RPG', icon: <StarIcon /> },
  { to: '/collections', label: '収集', icon: <CollectionIcon /> },
  { to: '/wishlist', label: '欲しいもの', icon: <BagIcon /> },
  { to: '/settings', label: '設定', icon: <SettingsIcon /> },
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

function NavSvg({ children }: { children: ReactNode }) {
  return (
    <svg className="nav-illustration" viewBox="0 0 32 32" focusable="false" aria-hidden="true">
      {children}
    </svg>
  );
}

function HomeIcon() {
  return (
    <NavSvg>
      <path className="nav-fill-soft" d="M6 15.2 16 6.6l10 8.6v10.2a2 2 0 0 1-2 2h-5.2v-7.2h-5.6v7.2H8a2 2 0 0 1-2-2Z" />
      <path className="nav-stroke" d="M4.8 15.8 16 6.2l11.2 9.6M10 13.6v-5h4.4" />
    </NavSvg>
  );
}

function SuitcaseIcon() {
  return (
    <NavSvg>
      <rect className="nav-fill-soft" x="5.5" y="10.5" width="21" height="16" rx="4" />
      <path className="nav-stroke" d="M12 10.5V8.8a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1.7M10 16.5h12M9.5 26.5v-16h13" />
    </NavSvg>
  );
}

function MapIcon() {
  return (
    <NavSvg>
      <path className="nav-fill-soft" d="M5.5 8.5 12 6l8 3 6.5-2.5v17l-6.5 2.5-8-3-6.5 2.5Z" />
      <path className="nav-stroke" d="M12 6v17m8-14v17M5.5 8.5 12 6l8 3 6.5-2.5v17l-6.5 2.5-8-3-6.5 2.5Z" />
    </NavSvg>
  );
}

function CastleIcon() {
  return (
    <NavSvg>
      <path className="nav-fill-soft" d="M7 12h4V8h4v4h2V8h4v4h4v15H7Z" />
      <path className="nav-stroke" d="M7 27V12h4V8h4v4h2V8h4v4h4v15M11 27v-6a5 5 0 0 1 10 0v6M7 16h18" />
    </NavSvg>
  );
}

function ClockIcon() {
  return (
    <NavSvg>
      <circle className="nav-fill-soft" cx="16" cy="16" r="10.5" />
      <path className="nav-stroke" d="M16 9.5V16l5 3M7.5 7.5l-2 3M24.5 7.5l2 3" />
    </NavSvg>
  );
}

function GachaIcon() {
  return (
    <NavSvg>
      <circle className="nav-fill-soft" cx="16" cy="11.5" r="6.5" />
      <path className="nav-fill-accent" d="M9 17h14l-1.6 9.5H10.6Z" />
      <path className="nav-stroke" d="M9 17h14l-1.6 9.5H10.6ZM11 11.5h10M16 5v13.5M12.5 23h7" />
    </NavSvg>
  );
}

function StarIcon() {
  return (
    <NavSvg>
      <path className="nav-fill-soft" d="m16 5.5 3.2 6.5 7.1 1-5.1 5 1.2 7.1-6.4-3.4-6.4 3.4 1.2-7.1-5.1-5 7.1-1Z" />
      <path className="nav-stroke" d="m16 5.5 3.2 6.5 7.1 1-5.1 5 1.2 7.1-6.4-3.4-6.4 3.4 1.2-7.1-5.1-5 7.1-1Z" />
    </NavSvg>
  );
}

function CollectionIcon() {
  return (
    <NavSvg>
      <rect className="nav-fill-soft" x="6.5" y="7.5" width="8" height="8" rx="2" />
      <rect className="nav-fill-accent" x="17.5" y="7.5" width="8" height="8" rx="2" />
      <rect className="nav-fill-soft" x="6.5" y="18.5" width="8" height="8" rx="2" />
      <rect className="nav-fill-soft" x="17.5" y="18.5" width="8" height="8" rx="2" />
      <path className="nav-stroke" d="M14.5 11.5h3m-3 11h3" />
    </NavSvg>
  );
}

function BagIcon() {
  return (
    <NavSvg>
      <path className="nav-fill-soft" d="M8 12h16l-1.2 14.5H9.2Z" />
      <path className="nav-stroke" d="M8 12h16l-1.2 14.5H9.2ZM12 12a4 4 0 0 1 8 0M13 19h6" />
      <path className="nav-fill-accent" d="M19 18.5h3.2v3.2H19Z" />
    </NavSvg>
  );
}

function SettingsIcon() {
  return (
    <NavSvg>
      <path className="nav-fill-soft" d="M17.8 5.5 19 8.2l2.9.6 1.6 2.7-1.9 2.2.2 2.3 2.1 2.1-1.5 2.8-3-.1-1.8 1.3-.8 2.9h-3.2l-.8-2.9-1.8-1.3-3 .1-1.5-2.8L8.6 16l.2-2.3-1.9-2.2 1.6-2.7 2.9-.6 1.2-2.7Z" />
      <circle className="nav-fill-accent" cx="16" cy="15.5" r="3.6" />
      <path className="nav-stroke" d="M17.8 5.5 19 8.2l2.9.6 1.6 2.7-1.9 2.2.2 2.3 2.1 2.1-1.5 2.8-3-.1-1.8 1.3-.8 2.9h-3.2l-.8-2.9-1.8-1.3-3 .1-1.5-2.8L8.6 16l.2-2.3-1.9-2.2 1.6-2.7 2.9-.6 1.2-2.7Z" />
    </NavSvg>
  );
}
