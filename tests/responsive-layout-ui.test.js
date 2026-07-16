import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const clientVerification = read('../src/components/ClientVerificationDashboard.jsx');
const professionalPage = read('../src/pages/ProfessionalPages.jsx');
const clientPage = read('../src/pages/ClientPages.jsx');
const adminPage = read('../src/pages/AdminPages.jsx');
const publicPage = read('../src/pages/PublicPages.jsx');

test('mixed-content client and professional upload grids align items to intrinsic height', () => {
  assert.match(clientVerification, /className="grid items-start gap-5 lg:grid-cols-2"/);
  assert.match(professionalPage, /className="grid min-w-0 items-start gap-4 md:grid-cols-3"/);
});

test('client Matchmaker uses viewport-safe mobile insets and a capped dynamic height', () => {
  assert.match(clientPage, /fixed inset-x-4 bottom-4/);
  assert.match(clientPage, /h-\[min\(600px,calc\(100dvh-2rem\)\)\]/);
  assert.match(clientPage, /sm:left-auto sm:right-8 sm:bottom-8 sm:w-\[400px\]/);
  assert.doesNotMatch(clientPage, /fixed bottom-8 right-8 w-\[400px\] h-\[600px\]/);
});

test('admin identity header can wrap and truncate without pushing controls off-screen', () => {
  assert.match(adminPage, /flex min-h-16[^"]*flex-wrap[^"]*gap-2[^"]*py-2/);
  assert.match(adminPage, /className="flex min-w-0 flex-1 items-center gap-4"/);
  assert.match(adminPage, /className="min-w-0"/);
  assert.match(adminPage, /className="truncate text-xs/);
  assert.match(adminPage, /className="flex shrink-0 items-center gap-4"/);
});

test('public mobile navigation remains reachable on short viewports', () => {
  const menuStart = publicPage.indexOf('id="public-mobile-navigation"');
  const menuTagStart = publicPage.lastIndexOf('<div', menuStart);
  const menuTagEnd = publicPage.indexOf('>', menuStart);
  const menuTag = publicPage.slice(menuTagStart, menuTagEnd + 1);
  assert.match(menuTag, /max-h-\[calc\(100dvh-4rem\)\]/);
  assert.match(menuTag, /overflow-y-auto/);
  assert.match(menuTag, /overscroll-contain/);
});
