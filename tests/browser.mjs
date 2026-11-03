import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
const url = process.env.APP_URL || 'http://127.0.0.1:4173/?view=engine';
let server, browser;
const errors = [],
  warnings = [],
  results = [];
const output = new URL('../docs/screenshots/', import.meta.url).pathname;
await mkdir(output, { recursive: true });
async function check(name, fn) {
  await fn();
  results.push({ name, status: 'passed' });
  console.log('PASS', name);
}
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
        '4173',
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
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 1,
  });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
    if (m.type() === 'warning') warnings.push(m.text());
  });
  await page.goto(url);
  await page.waitForFunction(() => window.__engineLab?.state.ready, { timeout: 60000 });
  await page.waitForTimeout(500);
  await check('page identity, real WebGL canvas, meaningful UI and no error overlay', async () => {
    assert.match(await page.title(), /GE90/);
    assert.ok(await page.getByRole('heading', { name: 'GE90–115B', exact: true }).isVisible());
    assert.equal(await page.locator('canvas').count(), 1);
    assert.equal(await page.locator('vite-error-overlay').count(), 0);
    assert.ok(
      (await page.evaluate(() => window.__engineLab.viewer.diagnostics())).triangles > 100000,
    );
  });
  await page.screenshot({ path: output + 'cutaway.png' });
  await check('guided tour selects actual systems and supports chapter navigation', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', { name: 'Guided tour', exact: true }).click();
    await page.waitForFunction(() => window.__engineLab.state.tourStep === 0);
    assert.equal(await page.evaluate(() => window.__engineLab.registry.isolation), 'fan');
    await page.getByRole('button', { name: 'Next system', exact: true }).click();
    assert.equal(await page.evaluate(() => window.__engineLab.state.selected), 'booster');
    await page.getByRole('button', { name: /Tour chapter 3:/ }).click();
    await page.waitForFunction(() => window.__engineLab.viewer.cameraTransition === null);
    assert.equal(await page.evaluate(() => window.__engineLab.state.selected), 'hpc');
    await page.screenshot({ path: output + 'guided-tour.png' });
    await page.getByRole('button', { name: 'End guided tour', exact: true }).click();
    assert.equal(await page.evaluate(() => window.__engineLab.registry.isolation), null);
  });
  await check(
    'assembly spread scrubs real transforms and keeps operation interlocked until closed',
    async () => {
      const spread = page.getByRole('slider', { name: 'Assembly spread', exact: true });
      await spread.fill('58');
      await page.waitForFunction(() => window.__engineLab.assembly.explodeAmount === 0.58);
      assert.equal(await page.evaluate(() => window.__engineLab.simulation.interlocked), true);
      assert.equal(
        await page.evaluate(() =>
          window.__engineLab.registry
            .get('fan')
            .object.position.equals(window.__engineLab.registry.get('fan').mount.position),
        ),
        false,
      );
      await page.screenshot({ path: output + 'assembly-spread.png' });
      await spread.fill('17');
      await page.waitForFunction(() => window.__engineLab.assembly.explodeAmount === 0.17);
      await spread.fill('0');
      await page.waitForFunction(
        () => !window.__engineLab.state.exploded && !window.__engineLab.simulation.interlocked,
      );
      assert.equal(
        await page.evaluate(() =>
          [...window.__engineLab.registry.entries.values()].every((p) =>
            p.object.position.equals(p.mount.position),
          ),
        ),
        true,
      );
    },
  );
  await check(
    'auto orbit moves the camera, yields to input, and respects reduced motion',
    async () => {
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.waitForFunction(
        () => !window.__engineLab.state.reduced && !window.__engineLab.viewer.cameraTransition,
      );
      const before = await page.evaluate(() => window.__engineLab.viewer.camera.position.toArray());
      await page.getByRole('button', { name: 'Auto orbit', exact: true }).click();
      await page.waitForFunction(
        (before) =>
          window.__engineLab.viewer.camera.position
            .toArray()
            .some((v, i) => Math.abs(v - before[i]) > 0.01),
        before,
      );
      const canvas = await page.locator('canvas').boundingBox();
      await page.mouse.move(canvas.x + canvas.width * 0.45, canvas.y + canvas.height * 0.5);
      await page.mouse.down();
      await page.mouse.up();
      assert.equal(await page.evaluate(() => window.__engineLab.state.autoOrbit), false);
      await page.getByRole('button', { name: 'Auto orbit', exact: true }).click();
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForFunction(() => !window.__engineLab.state.autoOrbit);
      assert.equal(
        await page.getByRole('button', { name: 'Auto orbit', exact: true }).isDisabled(),
        true,
      );
      await page.getByRole('button', { name: 'Reset view', exact: true }).click();
    },
  );
  await check(
    'assembled mode restores every exterior shell and cutaway returns to the same assembly',
    async () => {
      await page.getByRole('button', { name: 'Cutaway', exact: true }).click();
      await page.waitForFunction(
        () =>
          window.__engineLab.registry.get('exterior.nacelle.q3').object.visible ===
          !window.__engineLab.state.cutaway,
      );
      assert.equal(
        await page.evaluate(
          () => window.__engineLab.registry.get('exterior.nacelle.q3').object.visible,
        ),
        true,
      );
      await page.screenshot({ path: output + 'assembled.png' });
      await page.getByRole('button', { name: 'Cutaway', exact: true }).click();
      await page.waitForFunction(
        () =>
          window.__engineLab.registry.get('exterior.nacelle.q3').object.visible ===
          !window.__engineLab.state.cutaway,
      );
      assert.equal(
        await page.evaluate(
          () => window.__engineLab.registry.get('exterior.nacelle.q3').object.visible,
        ),
        false,
      );
    },
  );
  await check('search, assembly selection and prerequisite explanation work', async () => {
    await page.getByRole('textbox', { name: 'Find a component' }).fill('Swept fan blade 07');
    await page.getByRole('treeitem', { name: 'Swept fan blade 07', exact: true }).click();
    assert.equal(await page.evaluate(() => window.__engineLab.state.selected), 'fan.blade.07');
    await page.getByRole('button', { name: 'Detach component', exact: true }).click();
    assert.match(await page.locator('.viewport-notice').innerText(), /Remove first: Spinner/);
    assert.equal(
      await page.evaluate(() => window.__engineLab.registry.get('fan.blade.07').detached),
      false,
    );
  });
  // Reduced-motion mode also verifies snap-to-destination accessibility through real UI.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await check(
    'remove spinner, detach an individual fan blade, rotate it and return it exactly',
    async () => {
      await page.getByRole('button', { name: 'Select Spinner', exact: true }).click();
      await page.getByRole('button', { name: 'Detach component', exact: true }).click();
      await page.waitForFunction(() => window.__engineLab.registry.get('fan.spinner').amount === 1);
      await page.getByRole('treeitem', { name: 'Swept fan blade 07', exact: true }).click();
      await page.getByRole('button', { name: 'Detach component', exact: true }).click();
      await page.waitForFunction(
        () => window.__engineLab.registry.get('fan.blade.07').amount === 1,
      );
      assert.equal(await page.evaluate(() => window.__engineLab.simulation.interlocked), true);
      await page.getByRole('button', { name: 'Rotate y forward', exact: true }).click();
      const rotated = await page.evaluate(() => {
        const l = window.__engineLab;
        l.assembly.step(1 / 60, true);
        const p = l.registry.get('fan.blade.07');
        return p.object.quaternion.angleTo(p.mount.quaternion);
      });
      assert.ok(rotated > 0.3);
      await page.getByRole('button', { name: 'Reattach component', exact: true }).click();
      await page.waitForFunction(() => !window.__engineLab.registry.get('fan.blade.07').detached);
      assert.equal(
        await page.evaluate(() => {
          const p = window.__engineLab.registry.get('fan.blade.07');
          return (
            p.object.position.equals(p.mount.position) &&
            p.object.quaternion.equals(p.mount.quaternion)
          );
        }),
        true,
      );
      await page.getByRole('button', { name: 'Reassemble', exact: true }).click();
      await page.waitForFunction(() => !window.__engineLab.assembly.hasMissing());
    },
  );
  await check(
    'real canvas click identifies geometry; double-click isolates the same part',
    async () => {
      await page.getByRole('button', { name: 'Clear search' }).click();
      // Find a visible hit using the application's real raycast, then send an actual mouse click.
      const point = await page.evaluate(() => {
        const v = window.__engineLab.viewer,
          b = v.renderer.domElement.getBoundingClientRect();
        for (let fy = 0.27; fy < 0.78; fy += 0.06)
          for (let fx = 0.25; fx < 0.78; fx += 0.06) {
            const p = { clientX: b.left + b.width * fx, clientY: b.top + b.height * fy };
            const id = v.pick(p);
            if (id?.startsWith('fan.')) return { ...p, id };
          }
        return null;
      });
      assert.ok(point);
      await page.mouse.click(point.clientX, point.clientY);
      assert.equal(await page.evaluate(() => window.__engineLab.state.selected), point.id);
      await page.mouse.dblclick(point.clientX, point.clientY);
      await page.waitForFunction(() => !!window.__engineLab.state.isolated);
      assert.ok(await page.getByRole('button', { name: 'Show complete engine' }).isVisible());
      await page.getByRole('button', { name: 'Show complete engine' }).click();
      await page.waitForFunction(() => !window.__engineLab.state.isolated);
    },
  );
  await check('front, side, rear cameras and orbit dragging move the real camera', async () => {
    for (const name of ['Front', 'Side', 'Rear', 'Orbit']) {
      await page.getByRole('button', { name, exact: true }).click();
      await page.waitForTimeout(250);
    }
    const before = await page.evaluate(() => window.__engineLab.viewer.camera.position.toArray());
    const b = await page.locator('canvas').boundingBox();
    await page.mouse.move(b.x + b.width * 0.58, b.y + b.height * 0.45);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width * 0.66, b.y + b.height * 0.52, { steps: 8 });
    await page.mouse.up();
    const after = await page.evaluate(() => window.__engineLab.viewer.camera.position.toArray());
    assert.notDeepEqual(before, after);
    await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  });
  await check(
    'explode all shows separated complete assemblies and operation is interlocked',
    async () => {
      await page.getByRole('button', { name: 'Explode', exact: true }).click();
      await page.waitForFunction(() => window.__engineLab.assembly.explodeAmount === 1);
      assert.equal(
        await page.evaluate(
          () => window.__engineLab.registry.get('exterior.nacelle.q3').object.visible,
        ),
        true,
      );
      assert.equal(await page.evaluate(() => window.__engineLab.simulation.interlocked), true);
      await page.screenshot({ path: output + 'exploded.png' });
      await page.getByRole('button', { name: 'Start engine', exact: true }).click();
      assert.match(await page.locator('.viewport-notice').innerText(), /interlocked/);
      assert.equal(await page.evaluate(() => window.__engineLab.simulation.on), false);
      await page.getByRole('button', { name: 'Reassemble', exact: true }).click();
      await page.waitForFunction(() => !window.__engineLab.assembly.hasMissing());
    },
  );
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await check('startup, throttle, airflow and readouts use one coherent engine model', async () => {
    await page.getByRole('slider', { name: 'Educational throttle' }).fill('82');
    await page.getByRole('button', { name: 'Airflow', exact: true }).click();
    await page.getByRole('button', { name: 'Start engine', exact: true }).click();
    await page.evaluate(() => {
      const l = window.__engineLab;
      for (let i = 0; i < 1000; i++) l.simulation.step(1 / 60);
      l.viewer.dirty = true;
      l.viewer.wake();
    });
    await page.waitForTimeout(450);
    const s = await page.evaluate(() => window.__engineLab.simulation.snapshot());
    assert.ok(s.n1 > 80 && s.n2 > 85 && s.temperature > 600 && s.thrust > 300);
    assert.ok(await page.locator('.airflow-legend').isVisible());
    assert.ok(Number(await page.locator('.instrument strong').first().innerText()) > 80);
    await page.screenshot({ path: output + 'operating.png' });
    const before = await page.evaluate(() => window.__engineLab.simulation.lpAngle);
    await page.waitForTimeout(600);
    assert.notEqual(await page.evaluate(() => window.__engineLab.simulation.lpAngle), before);
  });
  await check(
    'detaching while running freezes both spools, disables flow and blocks restart',
    async () => {
      await page.evaluate(() => window.__engineLab.select('fan.spinner'));
      await page
        .getByRole('button', { name: 'Detach component', exact: true })
        .click({ noWaitAfter: true });
      await page.waitForFunction(() => window.__engineLab.simulation.interlocked);
      const before = await page.evaluate(() => [
        window.__engineLab.simulation.lpAngle,
        window.__engineLab.simulation.hpAngle,
      ]);
      await page.waitForTimeout(300);
      assert.deepEqual(
        await page.evaluate(() => [
          window.__engineLab.simulation.lpAngle,
          window.__engineLab.simulation.hpAngle,
        ]),
        before,
      );
      assert.equal(
        await page.evaluate(() => window.__engineLab.viewer.effects.points.visible),
        false,
      );
      // Capture the actual removal pose, then verify a settled detached state.
      await page.screenshot({ path: output + 'detachment-intermediate.png' });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.getByRole('button', { name: 'Reassemble', exact: true }).click();
      await page.waitForFunction(() => !window.__engineLab.assembly.hasMissing());
      assert.equal(await page.evaluate(() => window.__engineLab.simulation.on), false);
    },
  );
  await check(
    'internal stage removal respects casing and shaft dependencies and exposes high-detail geometry',
    async () => {
      const select = async (id) => {
        await page.getByRole('textbox', { name: 'Find a component' }).fill(id);
        const name = await page.evaluate((id) => window.__engineLab.registry.get(id).name, id);
        await page.getByRole('treeitem', { name, exact: true }).click();
      };
      for (const id of ['exterior.nacelle', 'hpc.case', 'lpt', 'hpt', 'shafts.hp', 'hpc.stage.1']) {
        await select(id);
        await page
          .getByRole('button', { name: 'Detach component', exact: true })
          .click({ noWaitAfter: true });
        await page.waitForFunction((id) => window.__engineLab.registry.get(id).amount === 1, id);
      }
      assert.equal(
        await page.evaluate(() => window.__engineLab.registry.get('hpc.case.q3').object.visible),
        true,
      );
      await page.getByRole('button', { name: 'Isolate', exact: true }).click();
      await page.waitForFunction(() => window.__engineLab.viewer.cameraTransition === null);
      await page.screenshot({ path: output + 'stage-inspection.png' });
      await page.getByRole('button', { name: 'Reassemble', exact: true }).click();
      await page.waitForFunction(() => !window.__engineLab.assembly.hasMissing());
      await page.getByRole('button', { name: 'Clear search' }).click();
    },
  );
  await check(
    'close inspection of an individual fan blade retains its true curved volume',
    async () => {
      await page.getByRole('textbox', { name: 'Find a component' }).fill('Swept fan blade 01');
      await page.getByRole('treeitem', { name: 'Swept fan blade 01', exact: true }).click();
      await page.getByRole('button', { name: 'Isolate', exact: true }).click();
      await page.waitForFunction(() => window.__engineLab.viewer.cameraTransition === null);
      assert.equal(
        await page.evaluate(() => {
          const r = window.__engineLab.registry;
          return (
            r.get('fan.disk').object.visible &&
            r.get('fan.disk').visuals.every((v) => !v.mesh.visible) &&
            r.effectiveVisible('fan.blade.01')
          );
        }),
        true,
      );
      await page.screenshot({ path: output + 'blade-inspection.png' });
      await page.getByRole('button', { name: 'Show complete engine', exact: true }).click();
      await page.getByRole('button', { name: 'Clear search' }).click();
    },
  );
  await check('visibility hides the selected real component and restores it', async () => {
    const button = page.getByRole('button', { name: 'Hide Fan module', exact: true });
    await button.click();
    await page.waitForFunction(() => !window.__engineLab.registry.get('fan').object.visible);
    assert.equal(
      await page.evaluate(() => window.__engineLab.registry.get('fan').object.visible),
      false,
    );
    await page.getByRole('button', { name: 'Show Fan module', exact: true }).click();
    await page.waitForFunction(() => window.__engineLab.registry.get('fan').object.visible);
    assert.equal(
      await page.evaluate(() => window.__engineLab.registry.get('fan').object.visible),
      true,
    );
  });
  await check('reference dialog and keyboard controls are usable', async () => {
    await page.getByRole('button', { name: 'Reference notes', exact: true }).click();
    assert.ok(await page.getByRole('dialog').isVisible());
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(), 0);
    await page.locator('.viewport-canvas').focus();
    await page.keyboard.press('Home');
    await page.keyboard.press('Space');
    assert.equal(await page.evaluate(() => window.__engineLab.simulation.on), true);
    await page.keyboard.press('Space');
    assert.equal(await page.evaluate(() => window.__engineLab.simulation.on), false);
  });
  const diagnostics = await page.evaluate(() => window.__engineLab.viewer.diagnostics());
  await check(
    '390px responsive view has no horizontal overflow, and both drawers work',
    async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(450);
      await page.getByRole('button', { name: 'Guided tour', exact: true }).click();
      assert.ok(await page.getByRole('region', { name: 'Guided engine tour' }).isVisible());
      await page.getByRole('button', { name: 'End guided tour', exact: true }).click();
      await page.getByRole('button', { name: 'Close inspector', exact: true }).click();
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      await page.getByRole('button', { name: 'Assembly', exact: true }).click();
      assert.ok(await page.getByRole('textbox', { name: 'Find a component' }).isVisible());
      await page.getByRole('textbox', { name: 'Find a component' }).fill('high-pressure shaft');
      await page.getByRole('treeitem', { name: 'High-pressure shaft', exact: true }).click();
      await page.getByRole('button', { name: 'Close assembly', exact: true }).click();
      await page.getByRole('button', { name: 'Inspector', exact: true }).click();
      assert.ok(await page.locator('.inspector-panel h2').isVisible());
      await page.getByRole('button', { name: 'Close inspector', exact: true }).click();
      await page.screenshot({ path: output + 'mobile.png' });
    },
  );
  assert.deepEqual(errors, []);
  results.push({ name: 'No application console errors', status: 'passed' });
  const report = {
    date: new Date().toISOString(),
    url,
    viewports: ['1600×1000', '390×844'],
    browser: 'Chromium / Playwright; Browser plugin not available',
    results,
    diagnostics,
    errors,
    warnings: [...new Set(warnings)],
    note: 'Cloud Chromium uses software rendering. Hardware 60 FPS is a target and has not been established by this run.',
  };
  await writeFile(
    new URL('../docs/verification.json', import.meta.url),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(
    JSON.stringify(
      { checks: results.length, diagnostics, errors, warnings: [...new Set(warnings)] },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  server?.kill();
}
