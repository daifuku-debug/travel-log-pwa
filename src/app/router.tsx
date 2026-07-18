import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '../shared/layout/AppLayout';
import { LoadingState } from '../shared/components/PageState';

const HomePage = lazyPage(() => import('../pages/HomePage'), 'HomePage');
const TripsPage = lazyPage(() => import('../pages/TripsPage'), 'TripsPage');
const TripEditPage = lazyPage<{ mode: 'create' | 'edit' }>(() => import('../pages/TripEditPage'), 'TripEditPage');
const TripDetailPage = lazyPage(() => import('../pages/TripDetailPage'), 'TripDetailPage');
const TripResultPage = lazyPage(() => import('../pages/TripResultPage'), 'TripResultPage');
const ScrapbookPage = lazyPage(() => import('../pages/ScrapbookPage'), 'ScrapbookPage');
const JapanConquestPage = lazyPage(() => import('../pages/JapanConquestPage'), 'JapanConquestPage');
const CastleCollectionPage = lazyPage(() => import('../pages/CastleCollectionPage'), 'CastleCollectionPage');
const TimeMachinePage = lazyPage(() => import('../pages/TimeMachinePage'), 'TimeMachinePage');
const TravelGachaPage = lazyPage(() => import('../pages/TravelGachaPage'), 'TravelGachaPage');
const RpgProfilePage = lazyPage(() => import('../pages/RpgProfilePage'), 'RpgProfilePage');
const RpgAchievementsPage = lazyPage(() => import('../pages/RpgAchievementsPage'), 'RpgAchievementsPage');
const RpgTitlesPage = lazyPage(() => import('../pages/RpgTitlesPage'), 'RpgTitlesPage');
const RpgQuestsPage = lazyPage(() => import('../pages/RpgQuestsPage'), 'RpgQuestsPage');
const RpgExperiencePage = lazyPage(() => import('../pages/RpgExperiencePage'), 'RpgExperiencePage');
const CollectionPage = lazyPage(() => import('../pages/CollectionPage'), 'CollectionPage');
const WishlistPage = lazyPage(() => import('../pages/WishlistPage'), 'WishlistPage');
const SettingsPage = lazyPage(() => import('../pages/SettingsPage'), 'SettingsPage');

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <AppLayout />,
      children: [
        { index: true, element: page(<HomePage />) },
        { path: 'trips', element: page(<TripsPage />) },
        { path: 'trips/new', element: page(<TripEditPage mode="create" />) },
        { path: 'trips/:tripId/edit', element: page(<TripEditPage mode="edit" />) },
        { path: 'trips/:tripId/result', element: page(<TripResultPage />) },
        { path: 'trips/:tripId/scrapbook', element: page(<ScrapbookPage />) },
        { path: 'trips/:tripId', element: page(<TripDetailPage />) },
        { path: 'japan-map', element: page(<JapanConquestPage />) },
        { path: 'castles', element: page(<CastleCollectionPage />) },
        { path: 'time-machine', element: page(<TimeMachinePage />) },
        { path: 'travel-gacha', element: page(<TravelGachaPage />) },
        { path: 'rpg', element: page(<RpgProfilePage />) },
        { path: 'rpg/achievements', element: page(<RpgAchievementsPage />) },
        { path: 'rpg/titles', element: page(<RpgTitlesPage />) },
        { path: 'rpg/quests', element: page(<RpgQuestsPage />) },
        { path: 'rpg/experience', element: page(<RpgExperiencePage />) },
        { path: 'collections', element: page(<CollectionPage />) },
        { path: 'wishlist', element: page(<WishlistPage />) },
        { path: 'settings', element: page(<SettingsPage />) },
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL },
);

function page(children: ReactNode): ReactNode {
  return <Suspense fallback={<LoadingState />}>{children}</Suspense>;
}

function lazyPage<P = Record<string, never>>(
  loader: () => Promise<Record<string, unknown>>,
  exportName: string,
) {
  return lazy(async () => ({ default: (await loader())[exportName] as ComponentType<P> }));
}
