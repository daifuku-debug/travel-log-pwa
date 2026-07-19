import { NavLink, useLocation } from 'react-router-dom';
import {
  bottomNavigationItems,
  isBottomNavigationItemActive,
  type BottomNavigationItem,
} from './navigationItems';

export function BottomNavigation({
  items = bottomNavigationItems,
  label = '主要ナビゲーション',
}: {
  items?: BottomNavigationItem[];
  label?: string;
}) {
  const location = useLocation();
  return (
    <nav className="bottom-nav" aria-label={label}>
      <div className="bottom-nav__inner">
        {items.map((item) => {
          const active = isBottomNavigationItemActive(location.pathname, item);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={active ? 'bottom-nav__item active' : 'bottom-nav__item'}
              aria-current={active ? 'page' : undefined}
            >
              <span className="bottom-nav__icon" aria-hidden="true">{item.icon}</span>
              <span className="bottom-nav__label">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
