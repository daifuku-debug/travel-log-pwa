import type { ReactNode } from 'react';

export interface BottomNavigationItem {
  to: string;
  label: string;
  icon: ReactNode;
  match?: 'exact' | 'prefix';
}

export const bottomNavigationItems: BottomNavigationItem[] = [
  { to: '/', label: 'ホーム', icon: <HomeIcon />, match: 'exact' },
  { to: '/trips', label: '旅行', icon: <SuitcaseIcon /> },
  { to: '/japan-map', label: '地図', icon: <MapIcon /> },
  { to: '/castles', label: '城', icon: <CastleIcon /> },
  { to: '/time-machine', label: '時間', icon: <ClockIcon /> },
  { to: '/travel-gacha', label: 'ガチャ', icon: <GachaIcon /> },
  { to: '/rpg', label: 'RPG', icon: <HeroIcon /> },
  { to: '/collections', label: '収集', icon: <CollectionIcon /> },
  { to: '/wishlist', label: '欲しいもの', icon: <BagIcon /> },
  { to: '/settings', label: '設定', icon: <SettingsIcon /> },
];

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

function CastleIcon() {
  return (
    <NavSvg>
      <path className="nav-fill-soft" d="M6.5 26.5h19l-1.4-9.2H7.9Z" />
      <path className="nav-fill-accent" d="M10 13.5h12l-2.2-5.2h-7.6Z" />
      <path className="nav-stroke" d="M6.5 26.5h19M8 17.3h16M10 13.5h12l-2.2-5.2h-7.6ZM11.2 17.3l-.9 9.2m10.5-9.2.9 9.2M13 22h6M15 8.3V5.8h3.5" />
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
      <rect className="nav-fill-soft" x="8" y="12.5" width="16" height="13.5" rx="3.5" />
      <circle className="nav-fill-accent" cx="16" cy="10.5" r="6" />
      <circle className="nav-fill-soft" cx="16" cy="19" r="2.7" />
      <path className="nav-stroke" d="M10.5 12.5h11M8 16h16M8 12.5h16V26H8ZM10 26v2m12-2v2M16 4.5a6 6 0 0 1 6 6v2h-12v-2a6 6 0 0 1 6-6ZM13.2 19h5.6" />
    </NavSvg>
  );
}

function HeroIcon() {
  return (
    <NavSvg>
      <path className="nav-fill-soft" d="M9 27v-6.2a7 7 0 0 1 14 0V27Z" />
      <path className="nav-fill-accent" d="M11.2 9.4 16 4.8l4.8 4.6-1.2 5.2h-7.2Z" />
      <path className="nav-stroke" d="M9 27v-6.2a7 7 0 0 1 14 0V27M12.4 14.6h7.2l1.2-5.2L16 4.8l-4.8 4.6ZM13 20.5h6M16 14.6v3.2M8.3 11.2l3.4 1.6m12-1.6-3.4 1.6" />
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
