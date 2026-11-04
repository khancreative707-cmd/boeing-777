import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = 'docs/aircraft/cockpit-windows/';
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
      '4179',
      '--strictPort',
    ],
    { stdio: 'ignore' },
  );
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch('http://127.0.0.1:4179')).ok) break;
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
  await page.goto('http://127.0.0.1:4179');
  await page.waitForFunction(() => window.__aircraftLab?.viewer.renderCount > 0, null, {
    timeout: 90000,
  });
  await page.evaluate(() => {
    const v = window.__aircraftLab.viewer;
    cancelAnimationFrame(v.frame);
    v.frame = 0;
    v.visible = false;
  });
  for (const [name, side, x] of [
    ['front', 1, 0],
    ['left-quarter', 1, 8],
    ['right-quarter', -1, -8],
  ]) {
    const result = await page.evaluate(
      ({ side, x }) => {
        const l = window.__aircraftLab,
          v = l.viewer;
        v.camera.position.set(-40, 10, x);
        v.controls.target.set(-33.3, 7.8, 0);
        v.cameraTransition = null;
        v.controls.update();
        l.registry.setSelection(null);
        l.root.updateMatrixWorld(true);
        l.registry.sync();
        v.renderer.shadowMap.needsUpdate = true;
        v.renderer.render(v.scene, v.camera);
        v.renderer.getContext().finish();
        const p = l.registry.get(`aircraft.fuselage.windshield.${side}.0`);
        const q = p.mount.position
            .clone()
            .fromBufferAttribute(p.visuals[0].mesh.geometry.attributes.position, 14 * 21 + 10)
            .applyMatrix4(p.object.matrixWorld)
            .project(v.camera),
          b = v.renderer.domElement.getBoundingClientRect();
        return {
          expected: p.id,
          picked: v.pick({
            clientX: b.left + ((q.x + 1) * b.width) / 2,
            clientY: b.top + ((1 - q.y) * b.height) / 2,
          }),
        };
      },
      { side, x },
    );
    assert.equal(result.picked, result.expected);
    checks.push({ name, ...result });
    await page.screenshot({ path: out + name + '.png', timeout: 60000 });
  }
  assert.deepEqual(errors, []);
  await writeFile(
    out + 'verification.json',
    JSON.stringify(
      {
        date: new Date().toISOString(),
        browser: 'Playwright / Chromium (Browser plugin unavailable)',
        checks,
        errors,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(JSON.stringify(checks));
} finally {
  await browser?.close();
  server?.kill();
}
