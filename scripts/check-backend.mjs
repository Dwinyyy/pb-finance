import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { supabaseRestRequest } from '../server/supabase.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(dirname, '..');
const envPath = path.join(rootDir, '.env.local');

const loadLocalEnv = () => {
  if (!fs.existsSync(envPath)) {
    return false;
  }

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);

    if (!match || process.env[match[1]]) {
      continue;
    }

    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }

  return true;
};

const countBy = (rows, field) => rows.reduce((counts, row) => {
  const key = row[field] || '(blank)';
  counts[key] = (counts[key] || 0) + 1;
  return counts;
}, {});

const requiredTables = [
  'profiles',
  'professional_profiles',
  'client_companies',
  'agencies',
  'shortlists',
  'opportunities',
  'interviews',
  'contracts',
  'invoices',
  'payment_methods',
  'timesheets',
  'match_requests',
  'notifications',
];

const run = async () => {
  const loadedLocalEnv = loadLocalEnv();
  const env = {
    loadedLocalEnv,
    supabaseUrlConfigured: Boolean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
    anonKeyConfigured: Boolean(
      process.env.SUPABASE_ANON_KEY
      || process.env.SUPABASE_PUBLISHABLE_KEY
      || process.env.VITE_SUPABASE_ANON_KEY
      || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
    ),
    serviceRoleConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    emailConfigured: Boolean(process.env.BREVO_API_KEY && process.env.NOTIFICATION_FROM_EMAIL),
    adminNotificationEmailConfigured: Boolean(process.env.ADMIN_NOTIFICATION_EMAIL),
  };

  const tableChecks = {};

  for (const table of requiredTables) {
    try {
      const rows = await supabaseRestRequest(`/${table}?select=*&limit=1`, { useServiceRole: true });
      tableChecks[table] = { ok: true, sampleRowsVisible: Array.isArray(rows) ? rows.length : 0 };
    } catch (error) {
      tableChecks[table] = { ok: false, error: error.message };
    }
  }

  try {
    await supabaseRestRequest(
      '/professional_profiles?select=user_id,titles,pending_profile,review_status,review_submitted_at&limit=1',
      { useServiceRole: true }
    );
    tableChecks.professional_profile_review_columns = { ok: true };
  } catch (error) {
    tableChecks.professional_profile_review_columns = { ok: false, error: error.message };
  }

  try {
    await supabaseRestRequest(
      '/interviews?select=id,cancellation_reason,cancelled_by,cancelled_at,client_hidden_at,professional_hidden_at&limit=1',
      { useServiceRole: true }
    );
    tableChecks.interview_cancellation_columns = { ok: true };
  } catch (error) {
    tableChecks.interview_cancellation_columns = { ok: false, error: error.message };
  }

  const summary = { env, tableChecks };

  try {
    const [profiles, professionals, agencies, shortlists, opportunities, interviews] = await Promise.all([
      supabaseRestRequest('/profiles?select=role', { useServiceRole: true }),
      supabaseRestRequest('/professional_profiles?select=status', { useServiceRole: true }),
      supabaseRestRequest('/agencies?select=status', { useServiceRole: true }),
      supabaseRestRequest('/shortlists?select=id', { useServiceRole: true }),
      supabaseRestRequest('/opportunities?select=status', { useServiceRole: true }),
      supabaseRestRequest('/interviews?select=status', { useServiceRole: true }),
    ]);

    summary.workflowCounts = {
      agencyStatuses: countBy(agencies, 'status'),
      interviewStatuses: countBy(interviews, 'status'),
      opportunityStatuses: countBy(opportunities, 'status'),
      professionalStatuses: countBy(professionals, 'status'),
      profileRoles: countBy(profiles, 'role'),
      shortlists: shortlists.length,
    };
  } catch (error) {
    summary.workflowCountsError = error.message;
  }

  console.log(JSON.stringify(summary, null, 2));

  if (!env.supabaseUrlConfigured || !env.anonKeyConfigured || !env.serviceRoleConfigured) {
    process.exitCode = 1;
  }

  if (Object.values(tableChecks).some((check) => !check.ok)) {
    process.exitCode = 1;
  }
};

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
