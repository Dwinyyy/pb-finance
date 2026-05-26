import { useCallback, useEffect, useState } from 'react';
import { isBackendConfigured } from '../services/api';

export function useBackendResource(loadResource, initialData, options = {}) {
  const backendConfigured = isBackendConfigured();
  const refreshInterval = options.refreshInterval || 0;
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
