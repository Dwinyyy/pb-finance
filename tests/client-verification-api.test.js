import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const apiSource = readFileSync(new URL('../api/index.js', import.meta.url), 'utf8');
const serviceSource = readFileSync(new URL('../src/services/api.js', import.meta.url), 'utf8');

test('backend exposes client verification upload submit status and preview routes', () => {
  for (const route of [
    'GET /client/verification',
    'POST /client/verification/uploads',
    'POST /client/verification/submit',
    'POST /client/verification/document-url',
  ]) {
    assert.match(apiSource, new RegExp(`['"]${route.replaceAll('/', '\\/')}['"]`));
  }

  assert.match(apiSource, /\/rpc\/register_client_verification_document/);
  assert.match(apiSource, /\/rpc\/submit_client_verification/);
});

test('backend exposes PB Finance admin queue decision and reset routes', () => {
  for (const route of [
    'GET /admin/client-verifications',
    'POST /admin/client-verifications/decision',
    'POST /admin/client-verifications/reset',
  ]) {
    assert.match(apiSource, new RegExp(`['"]${route.replaceAll('/', '\\/')}['"]`));
  }

  assert.match(apiSource, /\/rpc\/approve_client_verification/);
  assert.match(apiSource, /\/rpc\/reject_client_verification/);
  assert.match(apiSource, /\/rpc\/reset_client_verification/);
});

test('frontend API service exposes client and admin verification operations', () => {
  for (const method of [
    'getVerification',
    'uploadVerificationDocument',
    'submitVerification',
    'getVerificationDocumentUrl',
    'listClientVerifications',
    'decideClientVerification',
    'resetClientVerification',
  ]) {
    assert.match(serviceSource, new RegExp(`${method}:`));
  }
});

test('admin verification decisions deep-link clients to the verification section in Profile', () => {
  for (const route of [
    'POST /admin/client-verifications/decision',
    'POST /admin/client-verifications/reset',
  ]) {
    const marker = `'${route}': async (req, res) => {`;
    const start = apiSource.indexOf(marker);
    assert.notEqual(start, -1, `missing ${route}`);
    const next = apiSource.indexOf("\n  '", start + marker.length);
    const block = apiSource.slice(start, next === -1 ? apiSource.length : next);
    assert.match(block, /actionUrl:\s*'\/\?tab=profile&section=verification'/);
  }
});
