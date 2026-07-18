import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '../shared/layout/AppLayout';
import { CastleCollectionPage } from '../pages/CastleCollectionPage';
import { CollectionPage } from '../pages/CollectionPage';
import { HomePage } from '../pages/HomePage';
import { JapanConquestPage } from '../pages/JapanConquestPage';
import { RpgAchievementsPage } from '../pages/RpgAchievementsPage';
import { RpgExperiencePage } from '../pages/RpgExperiencePage';
import { RpgProfilePage } from '../pages/RpgProfilePage';
import { RpgQuestsPage } from '../pages/RpgQuestsPage';
import { RpgTitlesPage } from '../pages/RpgTitlesPage';
import { SettingsPage } from '../pages/SettingsPage';
import { ScrapbookPage } from '../pages/ScrapbookPage';
import { TripDetailPage } from '../pages/TripDetailPage';
import { TripEditPage } from '../pages/TripEditPage';
import { TripResultPage } from '../pages/TripResultPage';
import { TripsPage } from '../pages/TripsPage';
import { TimeMachinePage } from '../pages/TimeMachinePage';
import { TravelGachaPage } from '../pages/TravelGachaPage';
import { WishlistPage } from '../pages/WishlistPage';

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <AppLayout />,
      children: [
        { index: true, element: <HomePage /> },
        { path: 'trips', element: <TripsPage /> },
        { path: 'trips/new', element: <TripEditPage mode="create" /> },
        { path: 'trips/:tripId/edit', element: <TripEditPage mode="edit" /> },
        { path: 'trips/:tripId/result', element: <TripResultPage /> },
        { path: 'trips/:tripId/scrapbook', element: <ScrapbookPage /> },
        { path: 'trips/:tripId', element: <TripDetailPage /> },
        { path: 'japan-map', element: <JapanConquestPage /> },
        { path: 'castles', element: <CastleCollectionPage /> },
        { path: 'time-machine', element: <TimeMachinePage /> },
        { path: 'travel-gacha', element: <TravelGachaPage /> },
        { path: 'rpg', element: <RpgProfilePage /> },
        { path: 'rpg/achievements', element: <RpgAchievementsPage /> },
        { path: 'rpg/titles', element: <RpgTitlesPage /> },
        { path: 'rpg/quests', element: <RpgQuestsPage /> },
        { path: 'rpg/experience', element: <RpgExperiencePage /> },
        { path: 'collections', element: <CollectionPage /> },
        { path: 'wishlist', element: <WishlistPage /> },
        { path: 'settings', element: <SettingsPage /> },
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL },
);
