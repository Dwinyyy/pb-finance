import { useCallback, useEffect, useState } from 'react';
import { isBackendConfigured } from '../services/api';
import { isRealtimeConfigured, subscribeToDatabaseChanges } from '../services/realtime';

const REALTIME_REFETCH_DELAY_MS = 1000;
const hashRealtimeKey = (value) => {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash).toString(36);
};

export function useBackendResource(loadResource, initialData, options = {}) {
  const backendConfigured = isBackendConfigured();
  const refreshInterval = options.refreshInterval || 0;
  const realtimeKey = JSON.stringify(options.realtime || []);
  const [state, setState] = useState({
    data: initialData,
    error: null,
    isConfigured: backendConfigured,
    isLoading: backendConfigured,
  });

  const load = useCallback(async ({ isMounted = () => true, silent = false } = {}) => {
    if (!backendConfigured) {
      return initialData;
    }

    if (!silent) {
      setState((current) => ({
        ...current,
        isLoading: true,
      }));
    }

    try {
      const data = await loadResource();

      if (!isMounted()) return data;

      setState({
        data: data ?? initialData,
        error: null,
        isConfigured: true,
        isLoading: false,
      });

      return data;
    } catch (error) {
      if (!isMounted()) return initialData;

      setState((current) => ({
        data: silent ? current.data : initialData,
        error,
        isConfigured: true,
        isLoading: false,
      }));

      return initialData;
    }
  }, [backendConfigured, initialData, loadResource]);

  useEffect(() => {
    if (!backendConfigured) {
      return undefined;
    }

    let isMounted = true;
    const isStillMounted = () => isMounted;

    load({ isMounted: isStillMounted });

    const interval = refreshInterval
      ? window.setInterval(() => load({ isMounted: isStillMounted, silent: true }), refreshInterval)
      : null;
    const handleFocus = () => load({ isMounted: isStillMounted, silent: true });

    window.addEventListener('focus', handleFocus);

    return () => {
      isMounted = false;
      if (interval) {
        window.clearInterval(interval);
      }
      window.removeEventListener('focus', handleFocus);
    };
  }, [backendConfigured, load, refreshInterval]);

  useEffect(() => {
    if (!backendConfigured || !isRealtimeConfigured() || realtimeKey === '[]') {
      return undefined;
    }

    let isMounted = true;
    let timeoutId = null;
    const realtimeChanges = JSON.parse(realtimeKey);
    const isStillMounted = () => isMounted;
    const scheduleRefresh = () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }

      timeoutId = window.setTimeout(() => {
        load({ isMounted: isStillMounted, silent: true });
      }, REALTIME_REFETCH_DELAY_MS);
    };
    const unsubscribe = subscribeToDatabaseChanges({
      channelName: `resource:${hashRealtimeKey(realtimeKey)}`,
      changes: realtimeChanges,
      onChange: scheduleRefresh,
    });

    return () => {
      isMounted = false;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      unsubscribe();
    };
  }, [backendConfigured, load, realtimeKey]);

  if (!backendConfigured) {
    return {
      data: initialData,
      error: null,
      isConfigured: false,
      isLoading: false,
      refetch: () => Promise.resolve(initialData),
    };
  }

  return {
    ...state,
    refetch: (refetchOptions = {}) => load({ silent: true, ...refetchOptions }),
  };
}
