import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'docs/aircraft/mobile/';
let browser, server, page;
const errors = [],
  checks = [];
try {
  await mkdir(out, { recursive: true });
  server = spawn(
    process.execPath,
    [
      'node_modules/vite/bin/vite.js',
      'preview',
      '--host',
      '127.0.0.1',
      '--port',
      '4181',
      '--strictPort',
    ],
    { stdio: 'ignore' },
  );
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch('http://127.0.0.1:4181')).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
  });
  page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
  });
  page.setDefaultTimeout(60000);
  page.on('pageerror', (e) => errors.push(e.stack));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('http://127.0.0.1:4181');
  await page.waitForFunction(() => window.__aircraftLab?.viewer.renderCount > 0, null, {
    timeout: 90000,
  });
  async function paint() {
    const n = await page.evaluate(() => {
      const v = window.__aircraftLab.viewer;
      v.wake();
      return v.renderCount;
    });
    await page.waitForFunction(
      (n) => {
        const v = window.__aircraftLab.viewer;
        return v.renderCount > n && !v.cameraTransition && !v.dirty && v.gpuReady();
      },
      n,
      { timeout: 90000 },
    );
  }
  async function shot(name) {
    console.log('CAPTURE', name);
    await paint();
    await page.screenshot({ path: out + name + '.png' });
  }
  for (const [w, h] of [
    [320, 640],
    [390, 844],
    [430, 932],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    await paint();
    const metrics = await page.evaluate(() => {
      const r = (s) => document.querySelector(s).getBoundingClientRect(),
        header = r('.viewport-heading h1'),
        nav = r('.camera-views'),
        dock = r('.aircraft-controls'),
        scene = r('.viewport-panel');
      const buttons = [
        ...document.querySelectorAll(
          '.engine-command button,.aircraft-quick-controls button,.mobile-toolbar button',
        ),
      ];
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        titleClear: nav.top > header.bottom,
        dock: dock.height,
        viewport: scene.height,
        toolbarHeight: nav.height,
        touch: buttons.every((b) => b.getBoundingClientRect().height >= 44),
      };
    });
    assert.equal(metrics.overflow, false);
    assert.ok(metrics.titleClear);
    assert.ok(metrics.dock < 130);
    assert.ok(metrics.viewport > 250);
    assert.ok(metrics.touch);
    assert.ok(metrics.toolbarHeight < 55, 'Camera controls must stay in one scrollable row');
    checks.push({ name: 'Compact phone layout', width: w, height: h, ...metrics });
    await shot('phone-' + w);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Underside', exact: true }).tap();
  assert.equal(await page.evaluate(() => window.__aircraftLab.state.cameraView), 'Underside');
  await page.getByRole('button', { name: 'Exterior', exact: true }).tap();
  await page.getByRole('button', { name: 'More controls', exact: true }).tap();
  await page.getByRole('slider', { name: 'Flap setting', exact: true }).fill('15');
  assert.equal(
    await page.evaluate(() => window.__aircraftLab.mechanisms.channels.flaps.target),
    0.5,
  );
  await page.getByRole('slider', { name: 'Flap setting', exact: true }).fill('0');
  await shot('controls-expanded');
  await page.locator('.aircraft-more-controls > summary').tap();
  await page.getByRole('combobox', { name: 'Demonstration speed' }).selectOption('0.5');
  assert.equal(await page.evaluate(() => window.__aircraftLab.state.speed), 0.5);
  await shot('mechanisms-sheet');
  await page.getByRole('button', { name: 'Close mechanisms' }).tap();
  await page.getByRole('button', { name: 'Fewer controls', exact: true }).tap();
  checks.push({
    name: 'Expanded controls, flap slider, scrollable mechanisms sheet and close action work',
  });
  await page.getByRole('button', { name: 'Sectional', exact: true }).tap();
  assert.equal(await page.evaluate(() => window.__aircraftLab.state.cutaway), true);
  await page.getByRole('button', { name: 'Assembly', exact: true }).tap();
  let dialog = page.getByRole('dialog', { name: 'Component assembly hierarchy' });
  assert.ok(await dialog.isVisible());
  await page.getByRole('textbox', { name: 'Find a component' }).fill('aircraft.gear.nose');
  await page.getByRole('treeitem', { name: 'Nose landing gear', exact: true }).tap();
  await shot('assembly-drawer');
  await page.keyboard.press('Shift+Tab');
  assert.ok(await dialog.evaluate((el) => el.contains(document.activeElement)));
  await page.keyboard.press('Escape');
  assert.equal(await dialog.count(), 0);
  assert.equal(
    await page
      .getByRole('button', { name: 'Assembly', exact: true })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.getByRole('button', { name: 'Inspector', exact: true }).tap();
  dialog = page.getByRole('dialog', { name: 'Component inspector' });
  assert.ok(await dialog.isVisible());
  assert.ok(
    await page.getByRole('heading', { name: 'Nose landing gear', exact: true }).isVisible(),
  );
  await shot('inspector-drawer');
  await page.getByRole('button', { name: 'Close inspector' }).tap();
  await page.evaluate(() => {
    const l = window.__aircraftLab;
    l.isolate('aircraft.gear.nose');
  });
  await shot('focused-gear');
  const framed = await page.evaluate(() => {
    const l = window.__aircraftLab,
      v = l.viewer,
      b = v.renderer.domElement.getBoundingClientRect();
    const h = document.querySelector('.viewport-heading').getBoundingClientRect(),
      bottom = document.querySelector('.viewport-bottom').getBoundingClientRect();
    let top = Infinity,
      low = -Infinity;
    for (const p of l.registry.descendants('aircraft.gear.nose'))
      for (const visual of p.visuals) {
        visual.mesh.geometry.computeBoundingBox();
        const box = visual.mesh.geometry.boundingBox;
        for (const x of [box.min.x, box.max.x])
          for (const y of [box.min.y, box.max.y])
            for (const z of [box.min.z, box.max.z]) {
              const q = p.mount.position
                .clone()
                .set(x, y, z)
                .applyMatrix4(p.object.matrixWorld)
                .project(v.camera);
              const pixel = b.top + ((1 - q.y) * b.height) / 2;
              top = Math.min(top, pixel);
              low = Math.max(low, pixel);
            }
      }
    return { top, low, heading: h.bottom, instruments: bottom.top };
  });
  assert.ok(framed.top > framed.heading && framed.low < framed.instruments, JSON.stringify(framed));
  checks.push({ name: 'Focused gear stays between mobile toolbar and instruments', ...framed });
  await page.getByRole('button', { name: 'Show complete aircraft', exact: true }).tap();
  await paint();
  checks.push({
    name: 'Touch drawer search/selection, modal focus containment, Escape and focus restoration work',
  });
  const canvas = page.locator('canvas'),
    box = await canvas.boundingBox();
  const before = await page.evaluate(() => window.__aircraftLab.viewer.camera.position.toArray());
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: box.x + box.width * 0.45, y: box.y + box.height * 0.5 }],
  });
  for (let i = 1; i <= 8; i++)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: box.x + box.width * 0.45 + i * 8, y: box.y + box.height * 0.5 }],
    });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.notDeepEqual(
    await page.evaluate(() => window.__aircraftLab.viewer.camera.position.toArray()),
    before,
  );
  checks.push({ name: 'Real touch drag orbits the WebGL camera' });
  await page.setViewportSize({ width: 768, height: 1024 });
  await shot('tablet');
  assert.equal(
    await page.evaluate(() => innerWidth),
    768,
    'Hidden inspector must not enlarge the tablet layout viewport',
  );
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.getByRole('button', { name: 'Inspector', exact: true }).tap();
  assert.ok(await page.getByRole('dialog', { name: 'Component inspector' }).isVisible());
  await page.getByRole('button', { name: 'Close inspector' }).tap();
  checks.push({ name: 'Tablet layout and modal inspector work without overflow' });
  await page.setViewportSize({ width: 844, height: 390 });
  await shot('landscape');
  assert.equal(await page.evaluate(() => innerWidth), 844);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.getByRole('button', { name: 'Reset view', exact: true }).scrollIntoViewIfNeeded();
  checks.push({
    name: 'Landscape page can scroll to operating controls without horizontal overflow',
  });
  await page.setViewportSize({ width: 1568, height: 1003 });
  await paint();
  assert.ok(await page.getByRole('slider', { name: 'Flap setting', exact: true }).isVisible());
  await shot('desktop');
  checks.push({ name: 'Desktop retains the complete control bar' });
  assert.deepEqual(errors, []);
  await writeFile(
    out + 'verification.json',
    JSON.stringify(
      {
        date: new Date().toISOString(),
        browser: 'Playwright/Chromium; Browser plugin unavailable',
        checks,
        errors,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(JSON.stringify(checks, null, 2));
} catch (error) {
  console.error(error);
  if (page)
    try {
      console.error(
        await page.evaluate(() => ({
          state: window.__aircraftLab?.state,
          render: window.__aircraftLab?.viewer?.renderCount,
          dirty: window.__aircraftLab?.viewer?.dirty,
        })),
      );
      await page.screenshot({ path: '/tmp/mobile-failure.png', timeout: 10000 });
    } catch {}
  process.exitCode = 1;
} finally {
  await browser?.close();
  server?.kill();
}
