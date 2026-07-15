import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';

const publicPage = readFileSync(new URL('../src/pages/PublicPages.jsx', import.meta.url), 'utf8');
const projectRoot = fileURLToPath(new URL('..', import.meta.url));

test('public shell and Home use the signature system', () => {
  assert.match(publicPage, /<BrandMark/);
  assert.match(publicPage, /bg-canvas/);
  assert.match(publicPage, /bg-pb-midnight/);
  assert.match(publicPage, /text-text-primary/);
  assert.match(publicPage, /text-premium-detail/);
  assert.match(publicPage, /text-verified/);
  assert.match(publicPage, /text-processing/);
  assert.doesNotMatch(publicPage, /violet-/);
});

test('public route and CTA behavior remains intact', () => {
  for (const route of ['home', 'talents', 'agency', 'pricing']) assert.match(publicPage, new RegExp(`id: '${route}'`));
  assert.match(publicPage, /openAuth\('register'\)/);
  assert.match(publicPage, /openAuth\('register_pro'\)/);
  assert.match(publicPage, /navigateTo\('talents'\)/);
  assert.match(publicPage, /window\.addEventListener\('scroll', handleScroll, \{ passive: true \}\)/);
  assert.match(publicPage, /document\.body\.style\.overflow = 'hidden'/);
  assert.match(publicPage, /const \[salary, setSalary\] = useState\(85000\)/);
  assert.match(publicPage, /const \[openIndex, setOpenIndex\] = useState\(0\)/);
});

test('public shell and Home server-render accessible signature landmarks', async () => {
  const vite = await createServer({
    root: projectRoot,
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  });

  try {
    const { PublicSite } = await vite.ssrLoadModule('/src/pages/PublicPages.jsx');
    const html = renderToStaticMarkup(createElement(
      MemoryRouter,
      { initialEntries: ['/'] },
      createElement(PublicSite, {
        isDarkMode: false,
        openAuth: () => {},
        toggleDarkMode: () => {},
      }),
    ));

    assert.match(html, /aria-label="Primary navigation"/);
    assert.match(html, /aria-label="PB Finance"/);
    assert.match(html, /Start Building Your Team/);
    assert.match(html, /Estimate the cost difference/);
    assert.match(html, /Secure Matching Workflow/);
    assert.match(html, /<footer[^>]*bg-pb-midnight/);
  } finally {
    await vite.close();
  }
});
