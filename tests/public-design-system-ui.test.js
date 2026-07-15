import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';

const publicPage = readFileSync(new URL('../src/pages/PublicPages.jsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const projectRoot = fileURLToPath(new URL('..', import.meta.url));

const sourceBetween = (source, start, end) => source.slice(source.indexOf(start), source.indexOf(end));
const directoryView = sourceBetween(publicPage, 'function PreviewDirectoryView', 'function AgencyMarketingView');
const agencyView = sourceBetween(publicPage, 'function AgencyMarketingView', 'function PublicFooter');
const pricingView = publicPage.slice(publicPage.indexOf('function PricingView'));
const authModal = sourceBetween(app, 'function AuthModal', 'export default function App');

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

test('public route controls declare non-submit button behavior', () => {
  const lines = publicPage.split(/\r?\n/);
  const buttonTags = lines.flatMap((line, index) => (
    /<(?:button|Button)\b/.test(line) ? [lines.slice(index, index + 5).join('\n')] : []
  ));

  assert.ok(buttonTags.length > 0);
  for (const tag of buttonTags) assert.match(tag, /type="button"/);
});

test('secondary public routes use governed signature semantics', () => {
  for (const component of ['PreviewDirectoryView', 'AgencyMarketingView', 'PricingView']) {
    assert.match(publicPage, new RegExp(`function ${component}`));
  }

  assert.match(directoryView, /bg-verified-surface/);
  assert.match(directoryView, /bg-processing-surface/);
  assert.match(directoryView, /bg-pb-midnight/);
  assert.match(directoryView, /bg-action/);
  assert.match(agencyView, /bg-pb-midnight/);
  assert.match(agencyView, /text-premium-detail/);
  assert.match(agencyView, /text-verified/);
  assert.match(agencyView, /text-processing/);
  assert.match(pricingView, /bg-surface/);
  assert.match(pricingView, /bg-pb-midnight/);
  assert.match(pricingView, /bg-action/);
  assert.doesNotMatch(`${agencyView}\n${pricingView}`, /Most Popular/);

  assert.doesNotMatch(
    publicPage,
    /(?:bg|text|border|from|via|to|shadow|ring|accent)-(?:slate|gray|zinc|violet|blue|cyan|emerald|primary)-/,
  );
  assert.doesNotMatch(publicPage, /#[\da-f]{3,8}\b/i);
});

test('secondary public routes preserve filters, locked previews, pricing copy, images, and CTAs', () => {
  assert.match(directoryView, /const \[activeFilter, setActiveFilter\] = useState\('All'\)/);
  assert.match(directoryView, /DIRECTORY_PREVIEW_PROFILES\.filter\(\(profile\) => directoryProfileMatchesFilter\(profile, activeFilter\)\)/);
  assert.match(directoryView, /DIRECTORY_FILTERS\.map\(\(filter\) =>/);
  assert.match(directoryView, /overflow-x-auto/);
  assert.match(directoryView, /Full resume unlocks after client signup/);
  assert.match(directoryView, /openAuth\('register'\)/);
  assert.match(directoryView, /openAuth\('login'\)/);
  assert.match(directoryView, /navigateTo\('pricing'\)/);

  assert.match(
    agencyView,
    /https:\/\/images\.unsplash\.com\/photo-1486406146926-c627a92ad1ab\?ixlib=rb-4\.0\.3&auto=format&fit=crop&w=2000&q=80/,
  );
  assert.match(agencyView, /openAuth\('register'\)/);

  for (const copy of [
    'Transparent access, custom delivery.',
    'Start with the directory for individual hiring, or move into a managed pod when the workflow needs structure, coverage, and QA.',
    'Platform Access',
    'Best for hiring 1-2 remote professionals.',
    'Free',
    'forever',
    'Browse full talent directory',
    'Interview up to 3 candidates',
    'Standard KYC compliance',
    'Shortlist and interview tracking',
    'Create Free Account',
    'Enterprise Pods',
    'Dedicated managed teams and SLAs.',
    'Custom',
    'Dedicated account manager',
    'Role-based pod design',
    'Backup coverage and QA cadence',
    'Priority placement within 72hrs',
    'Draft a Pod Structure',
    'Not sure which path fits?',
    'Start free, describe the workload, and PB Finance can steer you toward individual profiles or a managed team structure.',
  ]) {
    assert.match(pricingView, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.equal([...pricingView.matchAll(/openAuth\('register'\)/g)].length, 2);
});

test('public auth entry uses shared accessible primitives and semantic feedback', () => {
  assert.match(app, /import \{ Button \} from '\.\/components\/ui\/Button'/);
  assert.match(app, /import \{ FormField \} from '\.\/components\/ui\/FormField'/);
  assert.match(app, /import \{ Modal \} from '\.\/components\/ui\/Modal'/);
  assert.match(authModal, /<Modal/);
  assert.match(authModal, /open=\{isOpen\}/);
  assert.doesNotMatch(authModal, /if \(!isOpen\) return null/);
  assert.match(authModal, /<FormField/);
  assert.match(authModal, /<Button/);
  assert.doesNotMatch(authModal, /<button\b/);
  assert.match(authModal, /role="alert"/);
  assert.match(authModal, /role="status"/);
  assert.match(authModal, /aria-live="polite"/);
  assert.match(authModal, /aria-label=\{showPassword \? 'Hide password' : 'Show password'\}/);
  assert.match(authModal, /aria-label=\{showConfirmPassword \? 'Hide password confirmation' : 'Show password confirmation'\}/);
  assert.doesNotMatch(
    authModal,
    /(?:bg|text|border|from|via|to|shadow|ring|accent)-(?:slate|gray|zinc|violet|blue|cyan|emerald|red|amber|primary)-/,
  );
});

test('public auth migration preserves views, fields, validation, handlers, API calls, and password branches', () => {
  for (const step of [
    'google_link_password',
    'google_link_verify',
    'password_setup',
    'password_setup_verify',
    'password_setup_google',
    'google_company',
  ]) {
    assert.match(authModal, new RegExp(`authStep === '${step}'`));
  }

  assert.deepEqual(
    [...new Set([...authModal.matchAll(/name="([^"]+)"/g)].map((match) => match[1]))].sort(),
    ['company', 'email', 'fullName', 'googleCompany', 'otp', 'pbAuthPasscode', 'pbAuthPasscodeConfirm', 'pbWorkEmail'],
  );

  for (const validation of [
    'getPasswordRequirementError',
    'validateAuthValues',
    'validateGoogleStartValues',
    'validateGoogleLinkValues',
    'validatePasswordSetupValues',
    'validateGoogleCompanyValues',
  ]) {
    assert.match(app, new RegExp(`const ${validation} =`));
  }

  for (const handler of [
    'handleAccountLinkOtpSubmit',
    'handleAccountLinkSubmit',
    'handleAuthSubmit',
    'handleGoogleCompanySubmit',
    'handleGoogleAuth',
    'handleOtpSubmit',
    'handlePasswordSetupGoogleConfirm',
    'handlePasswordSetupSubmit',
  ]) {
    assert.match(authModal, new RegExp(handler));
  }

  for (const method of [
    'login',
    'register',
    'verifyRegistration',
    'requestGoogleLink',
    'requestPasswordSetup',
    'verifyPasswordSetup',
    'verifyGoogleLink',
    'google',
    'completePasswordSetup',
    'finalizeOAuth',
    'logout',
  ]) {
    assert.match(app, new RegExp(`backendApi\\.auth\\.${method}\\b`));
  }

  for (const destination of ['login', 'register', 'register_pro']) {
    assert.match(authModal, new RegExp(`switchAuthView\\('${destination}'\\)`));
  }
  assert.equal([...authModal.matchAll(/type=\{showPassword \? "text" : "password"\}/g)].length, 3);
  assert.equal([...authModal.matchAll(/setShowPassword\(!showPassword\)/g)].length, 3);
  assert.equal([...authModal.matchAll(/type=\{showConfirmPassword \? "text" : "password"\}/g)].length, 2);
  assert.equal([...authModal.matchAll(/setShowConfirmPassword\(!showConfirmPassword\)/g)].length, 2);
});

test('public auth modal stays mounted for exit animation and resets transient form state', () => {
  assert.doesNotMatch(app, /<AuthModal\s+key=/);
  assert.match(authModal, /<Modal[\s\S]*open=\{isOpen\}/);
  assert.match(authModal, /<AuthModalContent\s+key=\{`\$\{isOpen\}-\$\{view\}-\$\{authStep\}`\}/);
  assert.doesNotMatch(authModal, /useEffect\([\s\S]*setShowPassword\(false\)/);
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

    for (const [path, expectedCopy] of [
      ['/talents', 'See the roles, rates, and readiness before you sign in.'],
      ['/agency', 'Managed finance pods'],
      ['/pricing', 'Transparent access, custom delivery.'],
      ['/missing-public-route', '404 - Page Not Found'],
    ]) {
      const routeHtml = renderToStaticMarkup(createElement(
        MemoryRouter,
        { initialEntries: [path] },
        createElement(PublicSite, {
          isDarkMode: false,
          openAuth: () => {},
          toggleDarkMode: () => {},
        }),
      ));

      assert.match(routeHtml, /<main[^>]*>/);
      assert.match(routeHtml, /<footer[^>]*bg-pb-midnight/);
      assert.match(routeHtml, new RegExp(expectedCopy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }

    const directoryHtml = renderToStaticMarkup(createElement(
      MemoryRouter,
      { initialEntries: ['/talents'] },
      createElement(PublicSite, {
        isDarkMode: false,
        openAuth: () => {},
        toggleDarkMode: () => {},
      }),
    ));
    assert.match(directoryHtml, /<button[^>]*aria-pressed="true"[^>]*>All<\/button>/);
    assert.match(directoryHtml, /Full resume unlocks after client signup/);
    assert.match(directoryHtml, /Profile details locked/);
  } finally {
    await vite.close();
  }
});
