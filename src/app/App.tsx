import { RouterProvider } from 'react-router-dom';
import { ErrorBoundary } from '../shared/components/ErrorBoundary';
import { router } from './router';

export function App() {
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}
