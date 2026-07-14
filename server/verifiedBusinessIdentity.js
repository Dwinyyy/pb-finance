import { toVerifiedBusinessIdentity } from './clientVerification.js';
import { supabaseRestRequest } from './supabase.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Server-only payment middleware accessor. The trusted legal name is sourced
 * exclusively from the protected client_verifications record.
 */
export const getVerifiedBusinessIdentity = async (
  clientId,
  { request = supabaseRestRequest } = {}
) => {
  if (!UUID_PATTERN.test(String(clientId || ''))) {
    throw new Error('A valid client id is required.');
  }

  const select = encodeURIComponent('status,verified_business_name');
  const rows = await request(
    `/client_verifications?client_id=eq.${clientId}&select=${select}&limit=1`,
    { useServiceRole: true }
  );
  const row = Array.isArray(rows) ? rows[0] : null;

  return toVerifiedBusinessIdentity(row || {});
};
