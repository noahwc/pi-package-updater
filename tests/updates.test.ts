import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  setupEnvironment,
  stubFetch,
  distTags,
  registryDoc,
  releases,
  registryRoute,
  releasesRoute,
} from './setup.ts';

setupEnvironment();
declare const require: (id: string) => any;
const entrypoint = require('../extensions/updates.ts');
const register = entrypoint.default;

type Sent = { customType: string; content: string; display: boolean };
function makePi() {
  const calls = { exec: [] as string[][], sent: [] as Sent[] };
  let command: any;
  let sessionStart: any;
  const pi = {
    on: (_e: string, h: any) => (sessionStart = h),
    registerCommand: (_n: string, cmd: any) => (command = cmd),
    sendMessage: (msg: Sent) => calls.sent.push(msg),
    exec: async (cmd: string, args: string[]) => {
      calls.exec.push([cmd, ...args]);
      return { stdout: '', stderr: '', code: 0 };
    },
  };
  register(pi);
  return {
    calls,
    handler: () => command.handler,
    sessionStart: () => sessionStart,
    pi,
  };
}
const notifyRecorder = () => {
  const notices: string[] = [];
  return { notices, notify: (m: string) => notices.push(m) };
};

describe('extension', () => {
  test('startup notice lists outdated packages', async () => {
    stubFetch(distTags({ foo: '1.2.0', '@scope/bar': '2.0.0' }));
    const { sessionStart } = makePi();
    const { notices, notify } = notifyRecorder();
    sessionStart()({ reason: 'startup' }, { hasUI: true, ui: { notify } });
    await new Promise((response) => setTimeout(response, 0));
    assert.equal(notices.length, 1);
    assert.ok(notices[0].includes('foo 1.0.0→1.2.0'));
    assert.ok(notices[0].includes('/updates to review'));
  });

  test('headless /updates <pkg> dumps the changelog into the session', async () => {
    stubFetch(
      distTags({ foo: '2.0.0' }),
      registryRoute(registryDoc),
      releasesRoute(releases),
    );
    const { calls, handler } = makePi();
    const { notify } = notifyRecorder();
    await handler()('foo', { hasUI: false, ui: { notify } });
    assert.equal(calls.sent.length, 1);
    assert.ok(calls.sent[0].content.startsWith('## foo 1.0.0 → 2.0.0'));
  });

  test('/updates warns on unknown or up-to-date packages', async () => {
    stubFetch(distTags({ '@scope/bar': '2.0.0' }));
    const { handler } = makePi();
    const { notices, notify } = notifyRecorder();
    await handler()('nope', { hasUI: false, ui: { notify } });
    await handler()('bar', { hasUI: false, ui: { notify } }); // suffix match
    assert.ok(notices[0].includes('not an installed stack package'));
    assert.ok(notices[1].includes('is up to date'));
  });

  test('pager upgrade runs pi install, retries with min-release-age bypass', async () => {
    stubFetch(
      distTags({ foo: '2.0.0' }),
      registryRoute(registryDoc),
      releasesRoute(releases),
    );
    const { calls, handler } = makePi();
    const { notify } = notifyRecorder();
    let pager: any;
    const ctx = {
      hasUI: true,
      ui: {
        notify,
        custom: (factory: any) =>
          new Promise((resolve) => {
            pager = factory(
              { terminal: { rows: 16, columns: 80 }, requestRender() {} },
              { fg: (_c: string, t: string) => t },
              {},
              resolve,
            );
          }),
      },
    };
    const run = handler()('foo', ctx);
    await new Promise((r) => setTimeout(r, 0)); // let prefetch settle
    pager.handleInput('u');
    await new Promise((r) => setTimeout(r, 0)); // let exec settle
    assert.deepEqual(calls.exec, [['pi', 'install', 'npm:foo@2.0.0']]);
    assert.ok(pager.render(80).at(-1)!.includes('installed'));
    pager.handleInput('q');
    await run;
  });

  test('pager upgrade fallback handles failure', async () => {
    stubFetch(
      distTags({ foo: '2.0.0' }),
      registryRoute(registryDoc),
      releasesRoute(releases),
    );
    const { pi, handler } = makePi();
    pi.exec = async () => ({ stdout: '', stderr: 'fallback error', code: 1 });
    let pager: any;
    const run = handler()('foo', {
      hasUI: true,
      ui: {
        notify: () => {},
        custom: (f: any) =>
          new Promise(
            (r) =>
              (pager = f(
                { terminal: { rows: 16, columns: 80 }, requestRender() {} },
                { fg: (_c: string, t: string) => t },
                {},
                r,
              )),
          ),
      },
    });
    await new Promise((r) => setTimeout(r, 0));
    pager.handleInput('u');
    await new Promise((r) => setTimeout(r, 0));
    assert.ok(pager.render(80).at(-1)!.includes('fallback error'));
    pager.handleInput('q');
    await run;
  });

  test('pager upgrade catches exceptions', async () => {
    stubFetch(
      distTags({ foo: '2.0.0' }),
      registryRoute(registryDoc),
      releasesRoute(releases),
    );
    const { pi, handler } = makePi();
    pi.exec = async () => {
      throw new Error('exec boom');
    };
    let pager: any;
    const run = handler()('foo', {
      hasUI: true,
      ui: {
        notify: () => {},
        custom: (f: any) =>
          new Promise(
            (r) =>
              (pager = f(
                { terminal: { rows: 16, columns: 80 }, requestRender() {} },
                { fg: (_c: string, t: string) => t },
                {},
                r,
              )),
          ),
      },
    });
    await new Promise((r) => setTimeout(r, 0));
    pager.handleInput('u');
    await new Promise((r) => setTimeout(r, 0));
    assert.ok(pager.render(80).at(-1)!.includes('exec boom'));
    pager.handleInput('q');
    await run;
  });

  test('registry unreachable for specific package', async () => {
    (globalThis as any).fetch = async () => {
      throw new Error('offline');
    };
    const { handler } = makePi();
    const { notices, notify } = notifyRecorder();
    await handler()('foo', { hasUI: false, ui: { notify } });
    assert.ok(notices[0].includes('registry unreachable'));
  });

  test('all packages up to date', async () => {
    stubFetch(distTags({ foo: '1.0.0', '@scope/bar': '2.0.0' }));
    const { handler } = makePi();
    const { notices, notify } = notifyRecorder();
    await handler()(undefined, { hasUI: false, ui: { notify } });
    assert.ok(notices[0].includes('All stack packages are up to date'));
  });

  test('changelog fetch failure handled gracefully', async () => {
    stubFetch(distTags({ foo: '2.0.0' })); // registryRoute omitted, so changelog fetch fails
    const { calls, handler } = makePi();
    await handler()('foo', { hasUI: false, ui: { notify: () => {} } });
    assert.ok(calls.sent[0].content.includes('_changelog fetch failed_'));
  });
});
