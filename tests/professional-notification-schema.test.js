import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

const schema = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
const migrationDirectory = new URL('../supabase/migrations/', import.meta.url);
const migrations = readdirSync(migrationDirectory)
  .filter((fileName) => fileName.endsWith('.sql'))
  .map((fileName) => readFileSync(new URL(fileName, migrationDirectory), 'utf8'))
  .join('\n');

const assertPushSubscriptionSecurity = (sql) => {
  assert.match(sql, /create table if not exists public\.push_subscriptions/i);
  assert.match(sql, /endpoint text not null unique/i);
  assert.match(sql, /alter table public\.push_subscriptions enable row level security/i);
  assert.match(sql, /revoke all on table public\.push_subscriptions from public, anon, authenticated/i);
  assert.match(sql, /grant select, insert, update, delete on table public\.push_subscriptions to service_role/i);
  assert.doesNotMatch(sql, /grant .* on (table )?public\.push_subscriptions to authenticated/i);
};

test('schema protects browser push subscriptions behind the service role', () => {
  assertPushSubscriptionSecurity(schema);
});

test('migration applies the same push subscription security contract', () => {
  assertPushSubscriptionSecurity(migrations);
});
