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

test('public navigation, ROI sliders, and FAQ expose complete accessibility relationships', () => {
  assert.equal(
    [...publicPage.matchAll(/aria-current=\{activeTab === tab\.id \? 'page' : undefined\}/g)].length,
    2,
    'desktop and mobile route buttons identify the current page',
  );
  assert.match(publicPage, /aria-controls="public-mobile-navigation"/);
  assert.match(publicPage, /id="public-mobile-navigation"/);

  for (const id of ['roi-salary', 'roi-benefits', 'roi-vendor-fee']) {
    assert.match(publicPage, new RegExp(`<label htmlFor="${id}"`));
    assert.match(publicPage, new RegExp(`<input id="${id}" type="range"`));
  }
  assert.match(publicPage, /aria-valuetext=\{`\$\$\{salary\.toLocaleString\(\)\} annual local salary`\}/);
  assert.match(publicPage, /aria-valuetext=\{`\$\{benefits\}% benefits and overhead`\}/);
  assert.match(publicPage, /aria-valuetext=\{`\$\$\{vendorFee\.toLocaleString\(\)\} monthly outsourced cost`\}/);

  assert.match(publicPage, /const triggerId = `faq-trigger-\$\{index\}`/);
  assert.match(publicPage, /const panelId = `faq-panel-\$\{index\}`/);
  assert.match(publicPage, /aria-controls=\{panelId\}/);
  assert.match(publicPage, /aria-labelledby=\{triggerId\}/);
  assert.match(publicPage, /aria-hidden=\{openIndex !== index\}/);
  assert.match(publicPage, /role="region"/);

  const smallDesktopButtons = publicPage.split(/\r?\n/).filter((line) => line.includes('<Button') && line.includes('size="sm"'));
  assert.equal(smallDesktopButtons.length, 2);
  for (const [button, variant] of smallDesktopButtons.map((line, index) => [line, index === 0 ? 'ghost' : 'primary'])) {
    assert.match(button, new RegExp(`variant="${variant}"`));
    assert.match(button, /type="button"/);
    assert.match(button, /className="min-h-11"/);
  }
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

    assert.equal([...html.matchAll(/aria-current="page"/g)].length, 1);
    assert.match(html, /<button[^>]*aria-current="page"[^>]*>Overview<\/button>/);

    for (const [id, valueText] of [
      ['roi-salary', '$85,000 annual local salary'],
      ['roi-benefits', '22% benefits and overhead'],
      ['roi-vendor-fee', '$3,600 monthly outsourced cost'],
    ]) {
      assert.match(html, new RegExp(`<label[^>]*for="${id}"`));
      const input = html.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`))?.[0] || '';
      assert.match(input, new RegExp(`aria-valuetext="${valueText.replace('$', '\\$')}"`));
    }

    const openFaqTrigger = html.match(/<button[^>]*id="faq-trigger-0"[^>]*>/)?.[0] || '';
    assert.match(openFaqTrigger, /aria-expanded="true"/);
    assert.match(openFaqTrigger, /aria-controls="faq-panel-0"/);

    const openFaqPanel = html.match(/<div[^>]*id="faq-panel-0"[^>]*>/)?.[0] || '';
    assert.match(openFaqPanel, /role="region"/);
    assert.match(openFaqPanel, /aria-labelledby="faq-trigger-0"/);
    assert.match(openFaqPanel, /aria-hidden="false"/);

    const collapsedFaqPanel = html.match(/<div[^>]*id="faq-panel-1"[^>]*>/)?.[0] || '';
    assert.match(collapsedFaqPanel, /aria-hidden="true"/);
  } finally {
    await vite.close();
  }
});
