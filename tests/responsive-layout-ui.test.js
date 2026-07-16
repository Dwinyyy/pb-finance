import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const clientVerification = read('../src/components/ClientVerificationDashboard.jsx');
const professionalPage = read('../src/pages/ProfessionalPages.jsx');

test('mixed-content client and professional upload grids align items to intrinsic height', () => {
  assert.match(clientVerification, /className="grid items-start gap-5 lg:grid-cols-2"/);
  assert.match(professionalPage, /className="grid min-w-0 items-start gap-4 md:grid-cols-3"/);
});
