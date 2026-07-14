import assert from 'node:assert/strict';
import test from 'node:test';

import { getVerifiedBusinessIdentity } from '../server/verifiedBusinessIdentity.js';

const CLIENT_ID = '63d44788-c234-4bee-a680-339496d25138';

test('payment middleware accessor reads only the protected verification fields with service role', async () => {
  const calls = [];
  const identity = await getVerifiedBusinessIdentity(CLIENT_ID, {
    request: async (...args) => {
      calls.push(args);
      return [{
        status: 'approved',
        verified_business_name: 'Société Générale S.A.',
      }];
    },
  });

  assert.deepEqual(identity, {
    verificationStatus: 'approved',
    verifiedBusinessName: 'Société Générale S.A.',
  });
  assert.equal(calls.length, 1);
  assert.match(calls[0][0], /^\/client_verifications\?/);
  assert.match(calls[0][0], /select=status%2Cverified_business_name/);
  assert.deepEqual(calls[0][1], { useServiceRole: true });
});

test('payment middleware accessor never exposes an unapproved name', async () => {
  const identity = await getVerifiedBusinessIdentity(CLIENT_ID, {
    request: async () => [{
      status: 'pending_review',
      verified_business_name: 'Must Not Escape',
    }],
  });

  assert.deepEqual(identity, {
    verificationStatus: 'pending_review',
    verifiedBusinessName: null,
  });
});

test('payment middleware accessor rejects invalid client ids', async () => {
  await assert.rejects(
    () => getVerifiedBusinessIdentity('not-a-uuid', { request: async () => [] }),
    /valid client id/i
  );
});
