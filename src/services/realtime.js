const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

let realtimeClient = null;
let clientPromise = null;
let activeToken = '';

const getAccessToken = () => localStorage.getItem('pb_auth_token') || '';

export const isRealtimeConfigured = () => Boolean(SUPABASE_URL && SUPABASE_KEY);

const getRealtimeClient = async () => {
  if (!isRealtimeConfigured()) return null;

  if (!realtimeClient) {
    if (!clientPromise) {
      clientPromise = import('@supabase/supabase-js');
    }

    const { createClient } = await clientPromise;

    realtimeClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
  }

  return realtimeClient;
};

export const syncRealtimeAuth = async () => {
  const client = await getRealtimeClient();
  const token = getAccessToken();

  if (!client || !token || token === activeToken) return;

  activeToken = token;
  client.realtime.setAuth(token);
};

export const subscribeToDatabaseChanges = ({ channelName, changes, onChange }) => {
  const subscriptions = Array.isArray(changes) ? changes.filter(Boolean) : [];

  if (subscriptions.length === 0 || typeof onChange !== 'function') {
    return () => {};
  }

  let isActive = true;
  let cleanup = () => {};

  const startSubscription = async () => {
    const client = await getRealtimeClient();

    if (!client || !isActive) return;

    await syncRealtimeAuth();

    const channel = client.channel(`pb:${channelName}:${Date.now()}:${Math.random().toString(36).slice(2)}`);
    subscriptions.forEach(({ event = '*', filter, schema = 'public', table }) => {
      if (!table) return;

      channel.on(
        'postgres_changes',
        {
          event,
          filter,
          schema,
          table,
        },
        onChange
      );
    });

    if (!isActive) {
      client.removeChannel(channel);
      return;
    }

    channel.subscribe();

    const handleAuthChanged = () => {
      syncRealtimeAuth();
    };
    window.addEventListener('pb-auth-updated', handleAuthChanged);

    cleanup = () => {
      window.removeEventListener('pb-auth-updated', handleAuthChanged);
      client.removeChannel(channel);
    };
  };

  startSubscription();

  return () => {
    isActive = false;
    cleanup();
  };
};
