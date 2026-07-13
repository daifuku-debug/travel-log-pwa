import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '../shared/layout/AppLayout';
import { CollectionPage } from '../pages/CollectionPage';
import { HomePage } from '../pages/HomePage';
import { SettingsPage } from '../pages/SettingsPage';
import { TripDetailPage } from '../pages/TripDetailPage';
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
        { path: 'trips/:tripId', element: <TripDetailPage /> },
        { path: 'collections', element: <CollectionPage /> },
        { path: 'wishlist', element: <WishlistPage /> },
        { path: 'settings', element: <SettingsPage /> },
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL },
);
