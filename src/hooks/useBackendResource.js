import { useEffect, useState } from 'react';
import { isBackendConfigured } from '../services/api';

export function useBackendResource(loadResource, initialData) {
  const backendConfigured = isBackendConfigured();
  const [state, setState] = useState({
    data: initialData,
    error: null,
    isConfigured: backendConfigured,
    isLoading: backendConfigured,
  });

  useEffect(() => {
    if (!backendConfigured) {
      return undefined;
    }

    let isMounted = true;

    loadResource()
      .then((data) => {
        if (!isMounted) return;
        setState({
          data: data ?? initialData,
          error: null,
          isConfigured: true,
          isLoading: false,
        });
      })
      .catch((error) => {
        if (!isMounted) return;
        setState({
          data: initialData,
          error,
          isConfigured: true,
          isLoading: false,
        });
      });

    return () => {
      isMounted = false;
    };
  }, [backendConfigured, initialData, loadResource]);

  if (!backendConfigured) {
    return {
      data: initialData,
      error: null,
      isConfigured: false,
      isLoading: false,
    };
  }

  return state;
}
