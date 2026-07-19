import type { ReactNode } from 'react';

export interface BottomNavigationItem {
  to: string;
  label: string;
  icon: ReactNode;
  activePaths: string[];
}

export const bottomNavigationItems: BottomNavigationItem[] = [
  { to: '/', label: 'ホーム', icon: <HomeIcon />, activePaths: ['/'] },
  { to: '/trips', label: '旅行', icon: <SuitcaseIcon />, activePaths: ['/trips'] },
  { to: '/japan-map', label: '地図', icon: <MapIcon />, activePaths: ['/japan-map'] },
  { to: '/collections', label: 'コレクション', icon: <CollectionIcon />, activePaths: ['/collections', '/castles'] },
  {
    to: '/more',
    label: 'その他',
    icon: <MoreIcon />,
    activePaths: ['/more', '/time-machine', '/travel-gacha', '/rpg', '/wishlist', '/settings'],
  },
];

export function isBottomNavigationItemActive(pathname: string, item: BottomNavigationItem): boolean {
  return item.activePaths.some((path) => {
    if (path === '/') return pathname === '/';
    return pathname === path || pathname.startsWith(`${path}/`);
  });
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
      <rect className="nav-fill-soft" x="6.5" y="10.5" width="19" height="15" rx="4" />
      <path className="nav-stroke" d="M12 10.5V8.8a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1.7M10.5 16.5h11M10 25.5v-15h12" />
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

function MoreIcon() {
  return (
    <NavSvg>
      <rect className="nav-fill-soft" x="5.5" y="6" width="9" height="9" rx="3" />
      <rect className="nav-fill-accent" x="17.5" y="6" width="9" height="9" rx="3" />
      <rect className="nav-fill-accent" x="5.5" y="18" width="9" height="9" rx="3" />
      <rect className="nav-fill-soft" x="17.5" y="18" width="9" height="9" rx="3" />
      <path className="nav-stroke" d="M10 9.5v2m-1-1h2M22 9.5v2m-1-1h2M10 21.5v2m-1-1h2M22 21.5v2m-1-1h2" />
    </NavSvg>
  );
}
