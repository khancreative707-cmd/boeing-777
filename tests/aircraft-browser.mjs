import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = process.env.AIRCRAFT_URL || 'http://127.0.0.1:4175';
const output = new URL('../docs/aircraft/screenshots/', import.meta.url).pathname;
const results = [],
  errors = [],
  warnings = [];
let browser, server, page;
async function check(name, fn) {
  console.log('RUN', name);
  await fn();
  results.push({ name, status: 'passed' });
  console.log('PASS', name);
}
async function paint() {
  const frame = await page.evaluate(() => {
    const v = window.__aircraftLab.viewer;
    v.wake();
    return v.renderCount;
  });
  await page.waitForFunction(
    (frame) => {
      const v = window.__aircraftLab?.viewer;
      return v && !v.cameraTransition && !v.dirty && v.renderCount > frame;
    },
    frame,
    { timeout: 90000 },
  );
  if (!(await page.evaluate(() => window.__aircraftLab.simulation.on)))
    await page.waitForFunction(() => window.__aircraftLab.viewer.gpuReady(), null, {
      timeout: 90000,
    });
}
async function shot(name) {
  await paint();
  await page.screenshot({ path: output + name + '.png' });
}
async function select(id) {
  await page.getByRole('textbox', { name: 'Find a component' }).fill(id);
  const name = await page.evaluate((id) => window.__aircraftLab.registry.get(id).name, id);
  await page.getByRole('treeitem', { name, exact: true }).click();
  await page.waitForFunction((id) => window.__aircraftLab.state.selected === id, id);
}
async function clearSearch() {
  const clear = page.getByRole('button', { name: 'Clear search' });
  if (await clear.count()) await clear.click();
}
async function menu() {
  await page.locator('.aircraft-more-controls > summary').click();
}
try {
  await mkdir(output, { recursive: true });
  if (!process.env.AIRCRAFT_URL) {
    server = spawn(
      process.execPath,
      [
        'node_modules/vite/bin/vite.js',
        'preview',
        '--host',
        '127.0.0.1',
        '--port',
        '4175',
        '--strictPort',
      ],
      { stdio: 'ignore' },
    );
    for (let i = 0; i < 80; i++) {
      try {
        if ((await fetch(base)).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  page = await browser.newPage({ viewport: { width: 1568, height: 1003 } });
  page.setDefaultTimeout(60000);
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
    if (m.type() === 'warning') warnings.push(m.text());
  });
  await page.goto(base);
  await page.waitForFunction(
    () => window.__aircraftLab?.state.ready && window.__aircraftLab.viewer.renderCount > 0,
    null,
    { timeout: 90000 },
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await check(
    'whole-aircraft page renders real WebGL geometry without an error overlay',
    async () => {
      assert.match(await page.title(), /Boeing 777/);
      assert.ok(
        await page.getByRole('heading', { name: 'Boeing 777–300ER', exact: true }).isVisible(),
      );
      assert.equal(await page.locator('canvas').count(), 1);
      assert.equal(await page.locator('vite-error-overlay').count(), 0);
      const d = await page.evaluate(() => window.__aircraftLab.viewer.diagnostics());
      assert.ok(d.parts > 11000 && d.triangles > 500000);
      await shot('assembled');
    },
  );
  await check(
    'real canvas picking and double-click isolation identify physical aircraft parts',
    async () => {
      const hit = await page.evaluate(() => {
        const v = window.__aircraftLab.viewer,
          b = v.renderer.domElement.getBoundingClientRect();
        for (let y = 0.36; y < 0.72; y += 0.035)
          for (let x = 0.25; x < 0.9; x += 0.035) {
            const p = { clientX: b.left + b.width * x, clientY: b.top + b.height * y },
              id = v.pick(p);
            if (id?.startsWith('aircraft.fuselage.skin')) return { ...p, id };
          }
        return null;
      });
      assert.ok(hit);
      await page.mouse.click(hit.clientX, hit.clientY);
      assert.equal(await page.evaluate(() => window.__aircraftLab.state.selected), hit.id);
      await page.mouse.dblclick(hit.clientX, hit.clientY);
      await page.waitForFunction(() => !!window.__aircraftLab.state.isolated);
      await page.getByRole('button', { name: 'Show complete aircraft', exact: true }).click();
      await paint();
    },
  );
  await check(
    'sectional view exposes cabin and cargo while opening near-side frame segments',
    async () => {
      await page.getByRole('button', { name: 'Sectional', exact: true }).click();
      await paint();
      await page.waitForFunction(() =>
        window.__aircraftLab.registry.effectiveVisible('aircraft.cabin.row.1.seat.1.cushion'),
      );
      assert.equal(
        await page.evaluate(
          () => window.__aircraftLab.registry.get('aircraft.fuselage.skin.2.0').object.visible,
        ),
        false,
      );
      assert.equal(
        await page.evaluate(() =>
          window.__aircraftLab.registry.effectiveVisible('aircraft.fuselage.frame.12.arc.1'),
        ),
        false,
      );
      assert.equal(
        await page.evaluate(() =>
          window.__aircraftLab.registry.effectiveVisible('aircraft.fuselage.frame.12.arc.0'),
        ),
        true,
      );
      await shot('sectional');
    },
  );
  await check(
    'flaps and slats respond to one control and return to their exact neutral mounts',
    async () => {
      await page.getByRole('slider', { name: 'Flap setting', exact: true }).fill('20');
      await page.waitForFunction(() => window.__aircraftLab.mechanisms.value('flaps') === 2 / 3);
      assert.equal(await page.evaluate(() => window.__aircraftLab.mechanisms.value('slats')), 1);
      await select('aircraft.wings.left.outboard-flap');
      await page.getByRole('button', { name: 'Focus selected component', exact: true }).click();
      await shot('flap-inspection');
      await page.getByRole('slider', { name: 'Flap setting', exact: true }).fill('0');
      await page.waitForFunction(() => window.__aircraftLab.mechanisms.value('flaps') === 0);
      assert.equal(
        await page.evaluate(() => {
          const p = window.__aircraftLab.registry.get('aircraft.wings.left.outboard-flap');
          return (
            p.object.position.equals(p.mount.position) &&
            p.object.quaternion.equals(p.mount.quaternion)
          );
        }),
        true,
      );
      await clearSearch();
      await page.getByRole('button', { name: 'Reset view', exact: true }).click();
    },
  );
  await check(
    'gear cycling engages supports and protects their release until the gear is down',
    async () => {
      await page.getByRole('button', { name: 'Retract landing gear', exact: true }).click();
      await page.waitForFunction(() => {
        const m = window.__aircraftLab.mechanisms;
        return m.value('gear') === 1 && m.value('gearDoors') === 0;
      });
      assert.equal(await page.evaluate(() => window.__aircraftLab.mechanisms.value('supports')), 1);
      await page.getByRole('button', { name: 'Underside', exact: true }).click();
      await shot('gear-up');
      await menu();
      await page.getByRole('button', { name: 'Maintenance supports', exact: true }).click();
      assert.equal(
        await page.evaluate(() => window.__aircraftLab.mechanisms.channels.supports.target),
        1,
      );
      assert.match(await page.locator('.viewport-notice').innerText(), /Extend/);
      await menu();
      await page.getByRole('button', { name: 'Extend landing gear', exact: true }).click();
      await page.waitForFunction(() => {
        const m = window.__aircraftLab.mechanisms;
        return m.value('gear') === 0 && m.value('gearDoors') === 0;
      });
      await page.getByRole('button', { name: 'Reset view', exact: true }).click();
    },
  );
  await check(
    'a complete six-wheel gear can detach, rotate and return to its exact mount',
    async () => {
      await select('aircraft.gear.left');
      await page.getByRole('button', { name: 'Detach component', exact: true }).click();
      await page.waitForFunction(
        () => window.__aircraftLab.registry.get('aircraft.gear.left').amount === 1,
      );
      await page.getByRole('button', { name: 'Isolate', exact: true }).click();
      await page.getByRole('button', { name: 'Rotate y forward', exact: true }).click();
      await shot('gear-inspection');
      await page.getByRole('button', { name: 'Reattach component', exact: true }).click();
      await page.waitForFunction(
        () => !window.__aircraftLab.registry.get('aircraft.gear.left').detached,
      );
      assert.equal(
        await page.evaluate(() => {
          const p = window.__aircraftLab.registry.get('aircraft.gear.left');
          return (
            p.object.position.equals(p.mount.position) &&
            p.object.quaternion.equals(p.mount.quaternion)
          );
        }),
        true,
      );
      await page.getByRole('button', { name: 'Show complete aircraft', exact: true }).click();
      await clearSearch();
    },
  );
  await check(
    'mounted-engine inspection preserves independent left and right spool states and airflow',
    async () => {
      await page.getByRole('button', { name: 'Engine lab', exact: true }).click();
      await page.waitForFunction(() => window.__aircraftLab.state.engineFocus === 'left');
      await page.getByRole('button', { name: 'Start left engine', exact: true }).click();
      await page.getByRole('slider', { name: 'left engine throttle', exact: true }).fill('80');
      await page.evaluate(() => {
        for (let i = 0; i < 1000; i++) window.__aircraftLab.simulation.step(1 / 60);
        window.__aircraftLab.viewer.wake();
      });
      await page.getByRole('button', { name: 'R GE90–115B', exact: true }).click();
      await page.getByRole('button', { name: 'Start right engine', exact: true }).click();
      await page.getByRole('slider', { name: 'right engine throttle', exact: true }).fill('25');
      await page.evaluate(() => {
        for (let i = 0; i < 1000; i++) window.__aircraftLab.simulation.step(1 / 60);
        window.__aircraftLab.viewer.wake();
      });
      const s = await page.evaluate(() => window.__aircraftLab.simulation.snapshot());
      assert.ok(s.engines.left.n1 > 80 && s.engines.right.n1 < 45 && s.engines.right.n1 > 35);
      await menu();
      await page.getByRole('button', { name: 'Engine airflow', exact: true }).click();
      await menu();
      await page.waitForFunction(
        () => window.__aircraftLab.viewer.effects.flows.right.points.visible,
      );
      await shot('engine-operating');
    },
  );
  await check(
    'removing a mounted-engine spinner freezes both engines and blocks restart',
    async () => {
      await select('aircraft.engines.left.fan.spinner');
      await page
        .getByRole('button', { name: 'Detach component', exact: true })
        .click({ noWaitAfter: true });
      await page.waitForFunction(() => window.__aircraftLab.simulation.interlocked);
      const before = await page.evaluate(() =>
        Object.values(window.__aircraftLab.simulation.engines).flatMap((e) => [
          e.lpAngle,
          e.hpAngle,
        ]),
      );
      await page.waitForTimeout(300);
      assert.deepEqual(
        await page.evaluate(() =>
          Object.values(window.__aircraftLab.simulation.engines).flatMap((e) => [
            e.lpAngle,
            e.hpAngle,
          ]),
        ),
        before,
      );
      assert.equal(
        await page.evaluate(() => window.__aircraftLab.viewer.effects.flows.left.points.visible),
        false,
      );
      await page.getByRole('button', { name: 'Start right engine', exact: true }).click();
      assert.equal(
        await page.evaluate(() => window.__aircraftLab.simulation.engines.right.on),
        false,
      );
      await page.getByRole('button', { name: 'Reassemble aircraft', exact: true }).click();
      await page.waitForFunction(() => !window.__aircraftLab.assembly.hasMissing());
      assert.equal(await page.evaluate(() => window.__aircraftLab.state.engineFocus), 'left');
      await page
        .getByRole('navigation', { name: 'Exhibit mode' })
        .getByRole('button', { name: 'Aircraft', exact: true })
        .click();
      await clearSearch();
    },
  );
  await check(
    'cockpit close-up exposes actual equipment and live model-driven screens',
    async () => {
      await page
        .getByRole('combobox', { name: 'Interior camera', exact: true })
        .selectOption('Cockpit');
      await page.waitForFunction(() => window.__aircraftLab.state.isolated === 'aircraft.cockpit');
      await shot('cockpit');
      const count = await page.evaluate(() => window.__aircraftLab.viewer.effects.displays.length);
      assert.equal(count, 2);
      await page.getByRole('button', { name: 'Show complete aircraft', exact: true }).click();
    },
  );
  await check(
    'individual seat removal respects the actual skin cover, inspection and return dependencies',
    async () => {
      const id = 'aircraft.cabin.row.1.seat.1';
      await select(id);
      await page.getByRole('button', { name: 'Detach component', exact: true }).click();
      assert.match(await page.locator('.viewport-notice').innerText(), /Remove first/);
      const cover = await page.evaluate(
        (id) => window.__aircraftLab.registry.get(id).blockers[0],
        id,
      );
      await select(cover);
      await page.getByRole('button', { name: 'Detach component', exact: true }).click();
      await page.waitForFunction((id) => window.__aircraftLab.registry.get(id).amount === 1, cover);
      await select(id);
      await page.getByRole('button', { name: 'Detach component', exact: true }).click();
      await page.waitForFunction((id) => window.__aircraftLab.registry.get(id).amount === 1, id);
      await page.getByRole('button', { name: 'Isolate', exact: true }).click();
      await page.getByRole('button', { name: 'Rotate y forward', exact: true }).click();
      await shot('seat-inspection');
      await page.getByRole('button', { name: 'Reassemble aircraft', exact: true }).click();
      await page.waitForFunction(() => !window.__aircraftLab.assembly.hasMissing());
      assert.equal(
        await page.evaluate((id) => {
          const p = window.__aircraftLab.registry.get(id);
          return (
            p.object.position.equals(p.mount.position) &&
            p.object.quaternion.equals(p.mount.quaternion)
          );
        }, id),
        true,
      );
      await page
        .getByRole('navigation', { name: 'Exhibit mode' })
        .getByRole('button', { name: 'Aircraft', exact: true })
        .click();
      await clearSearch();
    },
  );
  await check(
    'whole-aircraft spread separates the complete hierarchy and reassembles exactly',
    async () => {
      await page.evaluate(() => {
        window.__originalAircraftMounts = JSON.stringify(
          [...window.__aircraftLab.registry.entries.values()].map((p) => [
            p.id,
            p.mount.position.toArray(),
            p.mount.quaternion.toArray(),
            p.mount.scale.toArray(),
          ]),
        );
      });
      await page.getByRole('slider', { name: 'Assembly spread', exact: true }).fill('65');
      await page.waitForFunction(() => window.__aircraftLab.assembly.explodeAmount === 0.65);
      assert.equal(await page.evaluate(() => window.__aircraftLab.simulation.interlocked), true);
      await shot('exploded');
      await page.getByRole('slider', { name: 'Assembly spread', exact: true }).fill('25');
      await page.waitForFunction(() => window.__aircraftLab.assembly.explodeAmount === 0.25);
      await shot('exploded-25');
      await page.getByRole('button', { name: 'Reassemble aircraft', exact: true }).click();
      await page.waitForFunction(() => !window.__aircraftLab.assembly.hasMissing());
      const restoration = await page.evaluate(() => {
        const l = window.__aircraftLab,
          parts = [...l.registry.entries.values()];
        const mountsUnchanged =
          window.__originalAircraftMounts ===
          JSON.stringify(
            parts.map((p) => [
              p.id,
              p.mount.position.toArray(),
              p.mount.quaternion.toArray(),
              p.mount.scale.toArray(),
            ]),
          );
        const rotors = new Map(l.registry.rotors.map((p) => [p.id, p.spool]));
        const vanes = new Set(l.registry.variables.flatMap((row) => row.ids));
        const misplaced = parts
          .filter((p) => !p.id.startsWith('aircraft.supports'))
          .filter((p) => {
            const expected = (p.operatingQuaternion || p.mount.quaternion).clone();
            const source = l.simulation.forComponent(p.id);
            // Rendering adds current spool phase and stator incidence to the saved mount.
            if (rotors.has(p.id) || vanes.has(p.id)) {
              const axis = p.move.clone().set(vanes.has(p.id) ? 0 : 1, vanes.has(p.id) ? 1 : 0, 0);
              const angle = vanes.has(p.id)
                ? source.vsv
                : rotors.get(p.id) === 'LP'
                  ? source.lpAngle
                  : source.hpAngle;
              expected
                .copy(p.mount.quaternion)
                .multiply(p.mount.quaternion.clone().setFromAxisAngle(axis, angle));
            }
            return (
              !p.object.position.equals(p.operatingPosition || p.mount.position) ||
              p.object.quaternion.angleTo(expected) > 1e-6 ||
              !p.object.scale.equals(p.operatingScale || p.mount.scale)
            );
          })
          .map((p) => p.id);
        return { mountsUnchanged, misplaced };
      });
      assert.equal(restoration.mountsUnchanged, true);
      assert.deepEqual(restoration.misplaced, []);
    },
  );
  await check(
    'aircraft tour, layer controls, reference dialog and keyboard controls remain usable',
    async () => {
      await page.getByRole('button', { name: 'Guided tour', exact: true }).click();
      await page.getByRole('button', { name: /Tour chapter 3:/ }).click();
      assert.equal(
        await page.evaluate(() => window.__aircraftLab.state.selected),
        'aircraft.cabin',
      );
      await shot('cabin-tour');
      await page.getByRole('button', { name: 'End guided tour', exact: true }).click();
      await page.getByRole('button', { name: 'Systems', exact: true }).click();
      assert.equal(await page.evaluate(() => window.__aircraftLab.state.layers.systems), true);
      await page.getByRole('button', { name: 'Reference notes', exact: true }).click();
      assert.ok(await page.getByRole('dialog').isVisible());
      await page.keyboard.press('Escape');
      assert.equal(await page.getByRole('dialog').count(), 0);
      await page.locator('.viewport-canvas').focus();
      await page.keyboard.press('Home');
    },
  );
  await check(
    'phone view fits the page and both component drawers and the aircraft tour work',
    async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page
        .getByRole('navigation', { name: 'Exhibit mode' })
        .getByRole('button', { name: 'Aircraft', exact: true })
        .click();
      await page.getByRole('button', { name: 'Reset view', exact: true }).click();
      await paint();
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
      );
      await shot('mobile');
      await page.getByRole('button', { name: 'Assembly', exact: true }).click();
      await select('aircraft.gear.nose');
      await page.getByRole('button', { name: 'Close assembly', exact: true }).click();
      await page.getByRole('button', { name: 'Inspector', exact: true }).click();
      assert.ok(
        await page.getByRole('heading', { name: 'Nose landing gear', exact: true }).isVisible(),
      );
      await page.getByRole('button', { name: 'Close inspector', exact: true }).click();
      await page.getByRole('button', { name: 'Guided tour', exact: true }).click();
      assert.ok(
        await page.getByRole('region', { name: 'Guided aircraft tour', exact: true }).isVisible(),
      );
      await shot('mobile-tour');
      await page.getByRole('button', { name: 'End guided tour', exact: true }).click();
    },
  );
  assert.deepEqual(errors, []);
  results.push({ name: 'No application console errors', status: 'passed' });
  const report = {
    date: new Date().toISOString(),
    url: base,
    browser: 'Chromium / Playwright; Browser plugin not available',
    viewports: ['1568×1003', '390×844'],
    results,
    errors,
    warnings: [...new Set(warnings)],
    diagnostics: await page.evaluate(() => window.__aircraftLab.viewer.diagnostics()),
    note: 'Cloud SwiftShader rendering does not establish hardware 60 FPS. Public Boeing reference retrieval was blocked; internal geometry and operation are educational.',
  };
  await writeFile(
    new URL('../docs/aircraft/verification.json', import.meta.url),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({ checks: results.length, errors, diagnostics: report.diagnostics }, null, 2),
  );
} catch (error) {
  console.error(error);
  console.error(JSON.stringify({ results, errors, warnings: [...new Set(warnings)] }, null, 2));
  if (page) {
    try {
      console.error(
        'State',
        await page.evaluate(() => ({
          state: window.__aircraftLab?.state,
          render: window.__aircraftLab?.viewer?.renderCount,
          transition: !!window.__aircraftLab?.viewer?.cameraTransition,
          dirty: window.__aircraftLab?.viewer?.dirty,
        })),
      );
      await page.screenshot({ path: '/tmp/aircraft-browser-failure.png', timeout: 10000 });
    } catch {}
  }
  process.exitCode = 1;
} finally {
  await browser?.close();
  server?.kill();
}
