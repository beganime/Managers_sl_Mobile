import { useCallback, useEffect, useState } from 'react';

import { extractCount, extractItems, toApiError } from '../api/client';
import { CollectionResponse } from '../types';

type PageRequest = {
  limit: number;
  offset: number;
};

type PagedState<T> = {
  items: T[];
  count: number;
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  error: string | null;
};

export function usePagedResource<T>(
  loader: (request: PageRequest) => Promise<CollectionResponse<T>>,
  limit = 20
) {
  const [state, setState] = useState<PagedState<T>>({
    items: [],
    count: 0,
    loading: true,
    refreshing: false,
    loadingMore: false,
    error: null,
  });

  const load = useCallback(
    async (offset = 0, mode: 'initial' | 'refresh' | 'more' = 'initial') => {
      setState((current) => ({
        ...current,
        loading: mode === 'initial',
        refreshing: mode === 'refresh',
        loadingMore: mode === 'more',
        error: null,
      }));

      try {
        const payload = await loader({ limit, offset });
        const items = extractItems<T>(payload);
        const count = extractCount<T>(payload);

        setState((current) => ({
          items: offset === 0 ? items : [...current.items, ...items],
          count,
          loading: false,
          refreshing: false,
          loadingMore: false,
          error: null,
        }));
      } catch (error) {
        setState((current) => ({
          ...current,
          loading: false,
          refreshing: false,
          loadingMore: false,
          error: toApiError(error).message,
        }));
      }
    },
    [limit, loader]
  );

  useEffect(() => {
    void load(0, 'initial');
  }, [load]);

  const refresh = useCallback(() => load(0, 'refresh'), [load]);

  const loadMore = useCallback(() => {
    if (state.loading || state.refreshing || state.loadingMore) return;
    if (state.items.length >= state.count) return;

    void load(state.items.length, 'more');
  }, [load, state.count, state.items.length, state.loading, state.loadingMore, state.refreshing]);

  return {
    ...state,
    refresh,
    loadMore,
  };
}
