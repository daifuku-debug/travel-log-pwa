import { useEffect, useState, type DependencyList } from 'react';
import { toAppError, type AppError } from '../errors';

interface AsyncState<T> {
  data?: T;
  error?: AppError;
  loading: boolean;
}

export function useAsyncData<T>(loader: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ loading: true });

  useEffect(() => {
    let active = true;
    setState({ loading: true });

    loader()
      .then((data) => {
        if (active) setState({ data, loading: false });
      })
      .catch((error: unknown) => {
        if (active) {
          setState({ error: toAppError(error, 'データの読み込みに失敗しました'), loading: false });
        }
      });

    return () => {
      active = false;
    };
  }, deps);

  return state;
}
