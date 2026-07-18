import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '../shared/layout/AppLayout';
import { CollectionPage } from '../pages/CollectionPage';
import { HomePage } from '../pages/HomePage';
import { JapanConquestPage } from '../pages/JapanConquestPage';
import { SettingsPage } from '../pages/SettingsPage';
import { TripDetailPage } from '../pages/TripDetailPage';
import { TripEditPage } from '../pages/TripEditPage';
import { TripsPage } from '../pages/TripsPage';
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
        { path: 'trips/:tripId', element: <TripDetailPage /> },
        { path: 'japan-map', element: <JapanConquestPage /> },
        { path: 'collections', element: <CollectionPage /> },
        { path: 'wishlist', element: <WishlistPage /> },
        { path: 'settings', element: <SettingsPage /> },
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL },
);
