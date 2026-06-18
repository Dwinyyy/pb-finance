import { useCallback, useEffect, useRef, useState } from 'react';
import { isBackendConfigured } from '../services/api';
import { isRealtimeConfigured, subscribeToDatabaseChanges } from '../services/realtime';

const REALTIME_REFETCH_DELAY_MS = 120;
const FOCUS_REFETCH_MIN_INTERVAL_MS = 3000;
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
  const realtimeDelay = Number.isFinite(options.realtimeDelay)
    ? Math.max(0, options.realtimeDelay)
    : REALTIME_REFETCH_DELAY_MS;
  const realtimeKey = JSON.stringify(options.realtime || []);
  const onRealtimeChangeRef = useRef(options.onRealtimeChange);
  const latestRefreshAtRef = useRef(0);
  const latestRequestRef = useRef(0);
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

    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;

    try {
      const data = await loadResource();

      if (!isMounted() || requestId !== latestRequestRef.current) return data;

      setState({
        data: data ?? initialData,
        error: null,
        isConfigured: true,
        isLoading: false,
      });
      latestRefreshAtRef.current = Date.now();

      return data;
    } catch (error) {
      if (!isMounted() || requestId !== latestRequestRef.current) return initialData;

      setState((current) => ({
        data: silent ? current.data : initialData,
        error,
        isConfigured: true,
        isLoading: false,
      }));

      return initialData;
    }
  }, [backendConfigured, initialData, loadResource]);

  const mutate = useCallback((updater) => {
    setState((current) => ({
      ...current,
      data: typeof updater === 'function' ? updater(current.data) : updater,
      error: null,
      isConfigured: backendConfigured,
      isLoading: false,
    }));
  }, [backendConfigured]);

  useEffect(() => {
    onRealtimeChangeRef.current = options.onRealtimeChange;
  }, [options.onRealtimeChange]);

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
    const handleFocus = () => {
      if (Date.now() - latestRefreshAtRef.current < FOCUS_REFETCH_MIN_INTERVAL_MS) return;
      load({ isMounted: isStillMounted, silent: true });
    };

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
    const applyRealtimeChange = (payload) => {
      const handler = onRealtimeChangeRef.current;

      if (typeof handler !== 'function') return;

      setState((current) => {
        const nextData = handler(current.data, payload);

        if (nextData === undefined) return current;

        return {
          ...current,
          data: nextData,
          error: null,
          isConfigured: true,
          isLoading: false,
        };
      });
    };
    const scheduleRefresh = () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }

      timeoutId = window.setTimeout(() => {
        load({ isMounted: isStillMounted, silent: true });
      }, realtimeDelay);
    };
    const unsubscribe = subscribeToDatabaseChanges({
      channelName: `resource:${hashRealtimeKey(realtimeKey)}`,
      changes: realtimeChanges,
      onChange: (payload) => {
        applyRealtimeChange(payload);
        scheduleRefresh();
      },
    });

    return () => {
      isMounted = false;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      unsubscribe();
    };
  }, [backendConfigured, load, realtimeDelay, realtimeKey]);

  if (!backendConfigured) {
    return {
      data: initialData,
      error: null,
      isConfigured: false,
      isLoading: false,
      mutate: () => {},
      refetch: () => Promise.resolve(initialData),
    };
  }

  return {
    ...state,
    mutate,
    refetch: (refetchOptions = {}) => load({ silent: true, ...refetchOptions }),
  };
}
