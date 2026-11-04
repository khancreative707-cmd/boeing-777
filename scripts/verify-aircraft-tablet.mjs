import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
let server, browser;
const checks = [],
  errors = [];
const out = 'docs/aircraft/mobile/';
try {
  server = spawn(
    process.execPath,
    [
      'node_modules/vite/bin/vite.js',
      'preview',
      '--host',
      '127.0.0.1',
      '--port',
      '4182',
      '--strictPort',
    ],
    { stdio: 'ignore' },
  );
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch('http://127.0.0.1:4182')).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({
    viewport: { width: 768, height: 1024 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
  });
  page.on('pageerror', (e) => errors.push(e.stack));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('http://127.0.0.1:4182');
  await page.waitForFunction(() => window.__aircraftLab?.viewer.renderCount > 0, null, {
    timeout: 90000,
  });
  for (const [name, width, height] of [
    ['tablet', 768, 1024],
    ['landscape', 844, 390],
    ['desktop', 1568, 1003],
  ]) {
    await page.setViewportSize({ width, height });
    const n = await page.evaluate(() => {
      const v = window.__aircraftLab.viewer;
      v.wake();
      return v.renderCount;
    });
    await page.waitForFunction(
      (n) => {
        const v = window.__aircraftLab.viewer;
        return v.renderCount > n && !v.dirty && !v.cameraTransition && v.gpuReady();
      },
      n,
      { timeout: 90000 },
    );
    const metrics = await page.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
      visualWidth: visualViewport.width,
    }));
    assert.equal(metrics.width, width);
    assert.equal(metrics.scroll, width);
    assert.ok(Math.abs(metrics.visualWidth - width) < 1);
    if (name === 'landscape')
      assert.equal(
        await page.locator('.workspace').evaluate((el) => el.getBoundingClientRect().height),
        380,
      );
    await page.screenshot({ path: out + name + '.png', fullPage: name === 'landscape' });
    if (width < 1101) {
      await page.getByRole('button', { name: 'Inspector', exact: true }).tap();
      assert.ok(await page.getByRole('dialog', { name: 'Component inspector' }).isVisible());
      await page.getByRole('button', { name: 'Close inspector' }).tap();
    }
    assert.ok(await page.getByRole('slider', { name: 'Flap setting', exact: true }).isVisible());
    checks.push({ name, width, height, ...metrics });
    console.log('PASS', name, metrics);
  }
  assert.deepEqual(errors, []);
  const report = {
    date: new Date().toISOString(),
    checks,
    errors,
    reason:
      'Verify that the hidden tablet inspector cannot expand the layout viewport or trigger browser overview scaling.',
  };
  await writeFile(out + 'tablet-verification.json', JSON.stringify(report, null, 2) + '\n');
  const prior = JSON.parse(await readFile(out + 'verification.json', 'utf8'));
  prior.tabletCorrection = report;
  await writeFile(out + 'verification.json', JSON.stringify(prior, null, 2) + '\n');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  server?.kill();
}
