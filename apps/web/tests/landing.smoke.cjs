/* Run against a built frontend: NODE_PATH=<playwright installation>/node_modules node tests/landing.smoke.cjs.
 * Auth fixtures are test-only. Set LANDING_QA_EMAIL / LANDING_QA_PASSWORD for an additional real-session check.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const baseURL = process.env.LANDING_QA_URL || 'http://localhost:3001';
const output = process.env.LANDING_QA_OUTPUT;
const root = path.resolve(__dirname, '../../..');
const widths = [1440, 1024, 768, 390];

async function screenshot(page, name, fullPage = true) {
  if (!output) return;
  fs.mkdirSync(output, { recursive: true });
  await page.screenshot({ path: path.join(output, `${name}.png`), fullPage });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && /hydration|did not match|cannot be a descendant/i.test(message.text())) errors.push(message.text());
  });

  try {
    // The 401 path must leave the public page visible but still protect console routes.
    await context.route('**/api/v1/auth/me', route => route.fulfill({ status: 401, json: { detail: 'Not authenticated' } }));
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      assert.equal(new URL(page.url()).pathname, '/');
      assert.match(await page.title(), /VigilAI.*Real-Time Computer Vision Analytics/);
      assert.equal(await page.locator('h1').count(), 1);
      assert.equal(await page.locator('meta[property="og:title"]').count(), 1);
      assert.equal(await page.getByRole('link', { name: /launch vigilai/i }).first().getAttribute('href'), '/login');
      const overflow = await page.evaluate(() => ({ width: window.innerWidth, scroll: document.documentElement.scrollWidth }));
      assert.ok(overflow.scroll <= overflow.width, `Horizontal overflow at ${width}: ${JSON.stringify(overflow)}`);
      for (const id of ['system', 'capabilities', 'ppe', 'performance', 'architecture', 'console']) {
        assert.ok(await page.locator(`#${id}`).isVisible(), `${id} missing at ${width}`);
      }
      await screenshot(page, `landing-${width}`);
      if (width === 1440) await screenshot(page, 'landing-hero-desktop', false);
      console.log(`PASS public landing / metadata / no overflow at ${width}px`);
    }

    await page.getByRole('button', { name: 'Open navigation' }).click();
    const mobileNav = page.getByRole('navigation', { name: 'Mobile navigation' });
    assert.ok(await mobileNav.isVisible());
    await mobileNav.getByRole('link', { name: /architecture/i }).click();
    assert.equal(new URL(page.url()).hash, '#architecture');
    assert.equal(await mobileNav.isVisible(), false);
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await mobileNav.getByRole('link', { name: /system/i }).focus();
    await page.keyboard.press('Escape');
    assert.equal(await mobileNav.isVisible(), false);
    assert.equal(await page.getByRole('button', { name: 'Open navigation' }).evaluate(el => el === document.activeElement), true);
    await page.goto('/');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Skip to content');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'main-content');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.locator('main a').first().evaluate(el => getComputedStyle(el).transitionDuration), '0s');
    console.log('PASS mobile navigation / Escape focus return / skip link / reduced motion');

    for (const file of ['ppe_dataset_report.json', 'ppe_test_results.json', 'ppe_inference_benchmarks.json']) {
      const response = await context.request.get(`/engineering/${file}`);
      assert.equal(response.status(), 200);
      assert.deepEqual(await response.json(), JSON.parse(fs.readFileSync(path.join(root, 'benchmarks', file), 'utf8')));
    }
    for (const text of ['92.7%', '89.8%', '84.2%', '52.0%', '26.1%', '1.56', '16.40', '25.59']) {
      assert.ok((await page.locator('main').innerText()).includes(text), `Missing verified metric ${text}`);
    }
    console.log('PASS published artifacts match repository measurements');

    for (const route of ['/dashboard', '/cameras', '/events', '/rules', '/analytics', '/system']) {
      await page.goto(route);
      await page.waitForURL('**/login');
    }
    for (const route of ['/login', '/register']) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      assert.equal(new URL(page.url()).pathname, route);
      assert.ok(await page.locator('form').isVisible());
      for (const width of widths) {
        await page.setViewportSize({ width, height: 1000 });
        await screenshot(page, `${route.slice(1)}-${width}`);
      }
    }
    console.log('PASS private routes remain protected / login and register render');

    await context.unroute('**/api/v1/auth/me');
    await context.route('**/api/v1/auth/me', route => route.fulfill({ json: {
      id: 'landing-test-only', email: 'landing-test@example.invalid', username: 'Landing QA', is_active: true,
    } }));
    await page.goto('/');
    await page.getByRole('link', { name: /open console/i }).first().waitFor();
    assert.equal(new URL(page.url()).pathname, '/');
    assert.equal(await page.getByRole('link', { name: /open console/i }).first().getAttribute('href'), '/dashboard');
    console.log('PASS authenticated CTA (isolated auth fixture)');
    await context.unroute('**/api/v1/auth/me');

    // Real backend smoke: no fixture data or API interception.
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    assert.equal(new URL(page.url()).pathname, '/');
    console.log('PASS public page against real backend');
    if (process.env.LANDING_QA_EMAIL && process.env.LANDING_QA_PASSWORD) {
      await page.goto('/login');
      await page.locator('input[type=email]').fill(process.env.LANDING_QA_EMAIL);
      await page.locator('input[type=password]').fill(process.env.LANDING_QA_PASSWORD);
      await page.getByRole('button', { name: /authenticate.*enter/i }).click();
      await page.waitForURL('**/dashboard');
      await page.getByText('Surveillance Overview', { exact: true }).waitFor();
      for (const width of widths) {
        await page.setViewportSize({ width, height: 1000 });
        await screenshot(page, `dashboard-${width}`);
      }
      for (const route of ['/cameras', '/events', '/rules', '/analytics', '/system']) {
        await page.goto(route);
        await page.waitForLoadState('networkidle');
        assert.equal(new URL(page.url()).pathname, route);
      }
      await page.goto('/');
      await page.getByRole('link', { name: /open console/i }).first().waitFor();
      await page.getByRole('link', { name: /open console/i }).first().click();
      await page.waitForURL('**/dashboard');
      console.log('PASS real sign-in / dashboard at four widths / console routes / session-aware home CTA');
    }
    const noScriptContext = await browser.newContext({ baseURL, javaScriptEnabled: false });
    try {
      const noScriptPage = await noScriptContext.newPage();
      await noScriptPage.goto('/');
      assert.ok(await noScriptPage.getByRole('heading', { name: 'VIGILAI', exact: true }).isVisible());
      assert.ok(await noScriptPage.locator('#performance').isVisible());
      assert.equal(await noScriptPage.getByRole('link', { name: /launch vigilai/i }).first().getAttribute('href'), '/login');
      console.log('PASS public content and launch link render without JavaScript');
    } finally {
      await noScriptContext.close();
    }
    assert.deepEqual(errors, [], `Browser errors: ${errors.join('; ')}`);
    console.log('PASS no page errors or hydration errors');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
