import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Deterministic normal-motion frames: advance the actual model at 60 Hz while
// the demand loop is suspended, then draw its actual WebGL scene. UI workflows
// and the demand loop are independently covered by tests/aircraft-browser.mjs.
const url = 'http://127.0.0.1:4176';
const output = new URL('../docs/aircraft/screenshots/', import.meta.url).pathname;
let server, browser;
const errors = [],
  frames = [];
try {
  server = spawn(
    process.execPath,
    [
      'node_modules/vite/bin/vite.js',
      'preview',
      '--host',
      '127.0.0.1',
      '--port',
      '4176',
      '--strictPort',
    ],
    { stdio: 'ignore' },
  );
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(url)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({
    viewport: { width: 1568, height: 1003 },
    reducedMotion: 'reduce',
  });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(url);
  await page.waitForFunction(
    () => window.__aircraftLab?.state.ready && window.__aircraftLab.viewer.renderCount > 0,
    null,
    { timeout: 90000 },
  );
  await mkdir(output, { recursive: true });
  await page.evaluate(() => {
    const l = window.__aircraftLab,
      v = l.viewer;
    cancelAnimationFrame(v.frame);
    v.frame = 0;
    v.visible = false;
    l.state.reduced = false;
  });
  await page.locator('.aircraft-more-controls > summary').click();
  await page.getByRole('combobox', { name: 'Demonstration speed' }).selectOption('0.5');
  assert.equal(await page.evaluate(() => window.__aircraftLab.state.speed), 0.5);
  await page.locator('.aircraft-more-controls > summary').click();
  async function staticView(name) {
    await page.evaluate((name) => {
      const l = window.__aircraftLab,
        v = l.viewer;
      if (name === 'sectional') l.toggleCutaway();
      if (name === 'cockpit') {
        l.park();
        l.state.reduced = true;
        for (let i = 0; i < 12; i++) l.step(1 / 60);
        l.state.reduced = false;
        l.openInterior('Cockpit');
        v.camera.position.fromArray(l.views.Cockpit.position);
        v.controls.target.fromArray(l.views.Cockpit.target);
      }
      v.cameraTransition = null;
      v.controls.update();
      l.root.updateMatrixWorld(true);
      l.registry.sync();
      v.effects.update(0.2, l.simulation, l.state);
      l.telemetryListeners.forEach((fn) => fn(l.simulation.snapshot()));
      v.renderer.shadowMap.needsUpdate = true;
      v.renderer.render(v.scene, v.camera);
      v.renderer.getContext().finish();
    }, name);
    await page.screenshot({ path: output + name + '.png', timeout: 60000 });
    console.log('PASS final', name, 'view');
  }
  await staticView('assembled');
  await staticView('sectional');
  async function capture(name, setup, channel, threshold) {
    const result = await page.evaluate(
      ({ setup, channel, threshold }) => {
        const l = window.__aircraftLab,
          v = l.viewer;
        if (setup === 'gear') {
          l.showAircraft();
          l.select('aircraft.gear.left');
          l.isolate();
          l.select('aircraft.gear.left.leg.piston');
          const c = l.registry
            .get('aircraft.gear.left')
            .object.getWorldPosition(v.controls.target.clone());
          v.controls.target.copy(c).add({ x: 0, y: -1.5, z: 0 });
          v.camera.position.copy(c).add({ x: -12, y: 7, z: 13 });
          l.setMechanism('gear', 1);
        } else if (setup === 'door') {
          l.park();
          l.state.reduced = true;
          for (let i = 0; i < 12; i++) l.step(1 / 60);
          l.state.reduced = false;
          l.showAircraft();
          if (l.state.cutaway) l.toggleCutaway();
          l.select('aircraft.doors.left.2');
          const c = l.registry
            .get('aircraft.doors.left.2')
            .object.getWorldPosition(v.controls.target.clone());
          v.controls.target.copy(c).add({ x: -0.5, y: 0, z: 0 });
          v.camera.position.copy(c).add({ x: -4, y: 1.7, z: 5 });
          l.setMechanism('doors', 1);
        }
        v.cameraTransition = null;
        v.controls.update();
        let steps = 0;
        while (l.mechanisms.value(channel) < threshold && steps++ < 4000) l.step(1 / 60);
        l.lastUi = 1;
        l.step(0);
        l.root.updateMatrixWorld(true);
        l.registry.sync();
        v.updateVariableVanes();
        v.renderer.shadowMap.needsUpdate = true;
        l.telemetryListeners.forEach((fn) => fn(l.simulation.snapshot()));
        v.renderer.render(v.scene, v.camera);
        v.renderer.getContext().finish();
        const sill = l.registry.get('aircraft.doors.left.2.sill');
        return {
          steps,
          channel,
          value: l.mechanisms.value(channel),
          gearDoors: l.mechanisms.value('gearDoors'),
          supports: l.mechanisms.value('supports'),
          sillFixed:
            sill.object.position.equals(sill.mount.position) &&
            sill.object.quaternion.equals(sill.mount.quaternion),
        };
      },
      { setup, channel, threshold },
    );
    assert.ok(result.steps < 4000);
    assert.ok(result.value >= threshold && result.value < threshold + 0.015);
    assert.ok(result.sillFixed, 'Passenger threshold must stay on the fixed airframe');
    if (channel === 'gear') {
      assert.ok(result.gearDoors > 0.999);
      assert.equal(result.supports, 1);
    }
    await page.screenshot({ path: output + name + '.png', timeout: 60000 });
    frames.push({ name, ...result });
    console.log('PASS', name, result.value.toFixed(3));
  }
  await capture('gear-motion-25', 'gear', 'gear', 0.25);
  await capture('gear-motion-65', null, 'gear', 0.65);
  await capture('door-motion-35', 'door', 'doors', 0.35);
  await capture('door-motion-80', null, 'doors', 0.8);
  await staticView('cockpit');
  assert.deepEqual(errors, []);
  await writeFile(
    new URL('../docs/aircraft/motion-verification.json', import.meta.url),
    JSON.stringify(
      {
        date: new Date().toISOString(),
        method:
          'Actual production WebGL scene with deterministic 60 Hz normal-model stepping. The demand loop is suspended only for repeatable frame capture; UI workflows use the separate browser suite.',
        frames,
        errors,
      },
      null,
      2,
    ) + '\n',
  );
} finally {
  await browser?.close();
  server?.kill();
}
