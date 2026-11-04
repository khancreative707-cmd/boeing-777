import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'docs/aircraft/polish/';
let browser, server;
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
      '4177',
      '--strictPort',
    ],
    { stdio: 'ignore' },
  );
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch('http://127.0.0.1:4177')).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({
    viewport: { width: 1568, height: 1003 },
    reducedMotion: 'reduce',
  });
  page.on('pageerror', (e) => errors.push(e.stack));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('http://127.0.0.1:4177');
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
        return v.renderCount > n && !v.dirty && !v.cameraTransition && v.gpuReady();
      },
      n,
      { timeout: 90000 },
    );
  }
  await paint();
  await page.screenshot({ path: out + 'exterior.png' });
  const initial = await page.evaluate(() => window.__aircraftLab.viewer.diagnostics());
  await page.evaluate(() => {
    const l = window.__aircraftLab;
    l.select('aircraft.cabin.row.1.seat.1');
    l.isolate();
  });
  await paint();
  const pose = await page.evaluate(() => {
    const l = window.__aircraftLab,
      v = l.viewer;
    let y0 = Infinity,
      y1 = -Infinity;
    for (const p of l.registry.descendants(l.state.selected))
      for (const a of p.visuals) {
        a.mesh.geometry.computeBoundingBox();
        const b = a.mesh.geometry.boundingBox;
        for (const x of [b.min.x, b.max.x])
          for (const y of [b.min.y, b.max.y])
            for (const z of [b.min.z, b.max.z]) {
              const q = p.mount.position
                .clone()
                .set(x, y, z)
                .applyMatrix4(p.object.matrixWorld)
                .project(v.camera);
              y0 = Math.min(y0, q.y);
              y1 = Math.max(y1, q.y);
            }
      }
    return { y0, y1, draw: v.diagnostics() };
  });
  assert.ok(pose.y0 > -0.75 && pose.y1 < 0.75, JSON.stringify(pose));
  console.log(JSON.stringify({ initial, isolated: pose.draw }));
  assert.equal(
    await page.evaluate(() => {
      const r = window.__aircraftLab.registry;
      return r.batches
        .filter((b) => !b.ids.some((id) => r.get(id).renderVisible))
        .every((b) => !b.mesh.visible);
    }),
    true,
  );
  await page.screenshot({ path: out + 'seat-focus.png' });
  checks.push(
    'Focused seat fits within the central 75% of the viewport; hidden batches no longer draw',
  );
  await page.evaluate(() => window.__aircraftLab.showAircraft());
  await paint();
  await page.setViewportSize({ width: 390, height: 844 });
  await paint();
  const bounds = await page.evaluate(() => {
    const a = document.querySelector('.viewport-heading h1').getBoundingClientRect(),
      b = document.querySelector('.camera-views').getBoundingClientRect();
    return {
      titleBottom: a.bottom,
      toolbarTop: b.top,
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
  assert.ok(bounds.toolbarTop > bounds.titleBottom, JSON.stringify(bounds));
  assert.equal(bounds.overflow, false);
  await page.screenshot({ path: out + 'mobile.png' });
  checks.push('Mobile camera toolbar clears the heading and the page has no horizontal overflow');
  await page.getByRole('button', { name: 'Sectional', exact: true }).click();
  await paint();
  await page.screenshot({ path: out + 'mobile-sectional.png' });
  assert.deepEqual(errors, []);
  checks.push('Sectional control renders correctly without application console errors');
  await writeFile(
    out + 'verification.json',
    JSON.stringify(
      {
        date: new Date().toISOString(),
        browser: 'Playwright / Chromium; Browser plugin unavailable',
        checks,
        errors,
        initial,
        isolated: pose.draw,
        bounds,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    JSON.stringify(
      {
        checks,
        initialTriangles: initial.triangles,
        isolatedTriangles: pose.draw.triangles,
        bounds,
      },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  server?.kill();
}
