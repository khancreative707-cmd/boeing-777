import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
const errors = [];
const url = process.env.APP_URL || 'http://127.0.0.1:4174/?view=engine';
let server, browser;
try {
  if (!process.env.APP_URL) {
    server = spawn(
      process.execPath,
      [
        'node_modules/vite/bin/vite.js',
        'preview',
        '--host',
        '127.0.0.1',
        '--port',
        '4174',
        '--strictPort',
      ],
      { stdio: 'ignore' },
    );
    for (let i = 0; i < 60; i++) {
      try {
        if ((await fetch(url)).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport: { width: 1586, height: 992 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(
    () =>
      window.__engineLab?.state.ready &&
      window.__engineLab.viewer.renderCount > 0 &&
      !window.__engineLab.viewer.dirty,
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const out = new URL('../docs/screenshots/', import.meta.url).pathname;
  await page.screenshot({ path: out + 'native-concept.png' });
  await page.screenshot({ path: out + 'cutaway.png' });
  await page.getByRole('button', { name: 'Cutaway', exact: true }).click();
  await page.waitForFunction(
    () => window.__engineLab.registry.get('exterior.nacelle.q3').object.visible,
  );
  await page.screenshot({ path: out + 'assembled.png' });
  await page.getByRole('button', { name: 'Cutaway', exact: true }).click();
  await page.getByRole('button', { name: 'Explode', exact: true }).click();
  await page.waitForFunction(
    () =>
      window.__engineLab.assembly.explodeAmount === 1 &&
      window.__engineLab.viewer.cameraTransition === null &&
      !window.__engineLab.viewer.dirty,
  );
  await page.screenshot({ path: out + 'exploded.png' });
  await page.getByRole('button', { name: 'Reassemble', exact: true }).click();
  await page.waitForFunction(() => !window.__engineLab.assembly.hasMissing());
  await page.getByRole('slider', { name: 'Educational throttle' }).fill('82');
  await page.getByRole('button', { name: 'Airflow', exact: true }).click();
  await page.getByRole('button', { name: 'Start engine', exact: true }).click();
  await page.evaluate(() => {
    const l = window.__engineLab;
    for (let i = 0; i < 1000; i++) l.simulation.step(1 / 60);
    l.viewer.wake();
  });
  await page.waitForFunction(
    () => Number(document.querySelector('.instrument strong').textContent) > 80,
  );
  await page.screenshot({ path: out + 'operating.png' });
  await page.getByRole('button', { name: 'Stop engine', exact: true }).click();
  await page.evaluate(() => {
    const l = window.__engineLab;
    for (let i = 0; i < 2000; i++) l.simulation.step(1 / 60);
    l.viewer.wake();
  });
  await page.waitForFunction(
    () => document.querySelectorAll('.instrument strong')[1].textContent === '0.0',
  );
  await page.getByRole('button', { name: 'Airflow', exact: true }).click();
  await page.getByRole('slider', { name: 'Educational throttle' }).fill('0');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  await page.waitForFunction(
    () => window.__engineLab.viewer.cameraTransition === null && !window.__engineLab.viewer.dirty,
  );
  const framing = await page.evaluate(() => {
    const l = window.__engineLab,
      v = l.viewer;
    l.root.updateMatrixWorld(true);
    let left = Infinity,
      right = -Infinity;
    for (const p of l.registry.entries.values())
      if (l.registry.effectiveVisible(p.id))
        for (const visual of p.visuals) {
          const g = visual.mesh.geometry;
          g.computeBoundingBox();
          const b = g.boundingBox;
          for (const x of [b.min.x, b.max.x])
            for (const y of [b.min.y, b.max.y])
              for (const z of [b.min.z, b.max.z]) {
                const point = p.object.position
                  .clone()
                  .set(x, y, z)
                  .applyMatrix4(p.object.matrixWorld)
                  .project(v.camera);
                left = Math.min(left, point.x);
                right = Math.max(right, point.x);
              }
        }
    return { left, right, overflow: document.documentElement.scrollWidth > innerWidth };
  });
  assert.ok(framing.left >= -1 && framing.right <= 1, JSON.stringify(framing));
  assert.equal(framing.overflow, false);
  await page.screenshot({ path: out + 'mobile.png' });
  await page.setViewportSize({ width: 1586, height: 992 });
  await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  await page.waitForFunction(
    () => window.__engineLab.viewer.cameraTransition === null && !window.__engineLab.viewer.dirty,
  );
  const latestDiagnostics = await page.evaluate(() => window.__engineLab.viewer.diagnostics());
  const reportFile = new URL('../docs/verification.json', import.meta.url);
  const report = JSON.parse(await readFile(reportFile, 'utf8'));
  report.finalVisualChecks = {
    date: new Date().toISOString(),
    nativeViewport: '1586×992',
    mobileViewport: '390×844',
    mobileFraming: framing,
    coherentStoppedReadouts: true,
    requiredScreenshotsRefreshed: true,
    diagnostics: latestDiagnostics,
  };
  await writeFile(reportFile, JSON.stringify(report, null, 2) + '\n');
  console.log('Final visual checks passed:', framing);

  await page.evaluate(() => {
    const l = window.__engineLab,
      v = l.viewer;
    v.visible = false;
    cancelAnimationFrame(v.frame);
    v.frame = 0;
    l.registry.setHover(null);
  });
  for (const share of [0.25, 0.6]) {
    await page.evaluate((share) => {
      const l = window.__engineLab,
        v = l.viewer;
      l.explode();
      l.assembly.explodeAmount = share;
      l.assembly.explodeTarget = share;
      l.assembly.step(0, false);
      l.registry.sync();
      v.camera.position.set(-9, 7.3, 23);
      v.controls.target.set(0, 2.8, -0.3);
      v.cameraTransition = null;
      v.controls.update();
      for (const b of l.registry.batches) if (b.lowGeometry) b.mesh.geometry = b.lowGeometry;
      v.effects.update(0, l.simulation, l.state);
      v.renderer.shadowMap.needsUpdate = true;
      v.renderer.render(v.scene, v.camera);
    }, share);
    await page.screenshot({ path: out + `exploded-${Math.round(share * 100)}.png` });
  }
  await page.evaluate(() => {
    const l = window.__engineLab;
    l.reassemble();
    for (let i = 0; i < 16; i++) l.assembly.step(1 / 60, true);
    l.refresh({ phase: l.simulation.phase });
  });
  for (const [id, file] of [
    ['fan.blade.01', 'blade-inspection.png'],
    ['combustor.liner', 'combustor-inspection.png'],
    ['aux.gearbox', 'gearbox-inspection.png'],
  ]) {
    await page.evaluate((id) => {
      const l = window.__engineLab,
        v = l.viewer;
      l.registry.isolation = null;
      l.select(id);
      l.isolate(id);
      if (id === 'combustor.liner') {
        l.registry.setVisible('combustor.liner.outer.6', false);
        l.registry.setVisible('combustor.liner.outer.7', false);
      }
      l.registry.sync();
      for (const part of l.registry.entries.values()) {
        if (l.registry.effectiveVisible(part.id) && !l.registry.isWithin(part.id, id))
          throw new Error(`Unrelated geometry remained visible while isolating ${id}: ${part.id}`);
        for (const visual of part.visuals)
          if (
            visual.index === undefined &&
            !l.registry.effectiveVisible(part.id) &&
            visual.mesh.visible
          )
            throw new Error(`Hidden ancestor geometry remained visible: ${part.id}`);
      }
      const t = v.cameraTransition;
      if (t) {
        v.camera.position.copy(t.to);
        v.controls.target.copy(t.endTarget);
        v.cameraTransition = null;
      }
      v.controls.update();
      for (const b of l.registry.batches) if (b.lowGeometry) b.mesh.geometry = b.highGeometry;
      v.renderer.shadowMap.needsUpdate = true;
      v.renderer.render(v.scene, v.camera);
    }, id);
    await page.screenshot({ path: out + file });
  }
  assert.deepEqual(errors, []);
  report.finalVisualChecks.componentIsolation =
    'passed: blade, combustor liner, accessory gearbox; ancestor geometry hidden';
  report.finalVisualChecks.intermediateExplosion = 'captured actual 25% and 60% controller poses';
  report.finalVisualChecks.completed = new Date().toISOString();
  await writeFile(reportFile, JSON.stringify(report, null, 2) + '\n');
  console.log(
    'Captured native-size reference comparison, 25%/60% actual explode path poses, combustor and accessory close-ups.',
  );
} finally {
  await browser?.close();
  server?.kill();
}
