import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { setupEnvironment, stubFetch, distTags } from './setup.ts';

setupEnvironment();
declare const require: (id: string) => any;
const packages = require('../extensions/packages.ts');
const { newer, installedPackages, latestOf, checkOutdated } = packages;

describe('newer', () => {
  test('compares numeric triplets', () => {
    assert.equal(newer('2.0.0', '1.9.9'), true);
    assert.equal(newer('1.10.0', '1.9.0'), true);
    assert.equal(newer('1.0.1', '1.0.0'), true);
    assert.equal(newer('1.0.0', '1.0.1'), false);
    assert.equal(newer('1.0.0', '1.0.0'), false);
  });
  test('ignores prerelease tags (documented behavior)', () => {
    assert.equal(newer('1.0.0', '1.0.0-beta.1'), false);
    assert.equal(newer('1.0.1-rc.1', '1.0.0'), true);
  });
});

describe('installedPackages', () => {
  test('reads npm sources from settings.json, versions from node_modules', () => {
    assert.deepEqual(installedPackages(), [
      { name: 'foo', version: '1.0.0' },
      { name: '@scope/bar', version: '2.0.0' },
    ]);
  });
  test('ignores missing versions or unreadable files', () => {
    // Add a package without package.json to test the error block
    const fs = require('node:fs');
    const path = require('node:path');
    const settingsPath = path.join(
      process.env.HOME,
      '.pi',
      'agent',
      'settings.json',
    );
    const originalSettings = fs.readFileSync(settingsPath, 'utf8');

    fs.writeFileSync(
      settingsPath,
      JSON.stringify({
        packages: ['npm:no-pkg-json@1.0.0', 'npm:bad-version@1.0.0'],
      }),
    );

    fs.mkdirSync(
      path.join(
        process.env.HOME,
        '.pi',
        'agent',
        'npm',
        'node_modules',
        'bad-version',
      ),
      { recursive: true },
    );
    fs.writeFileSync(
      path.join(
        process.env.HOME,
        '.pi',
        'agent',
        'npm',
        'node_modules',
        'bad-version',
        'package.json',
      ),
      JSON.stringify({ name: 'bad-version' }), // no version
    );

    assert.deepEqual(installedPackages(), []);

    // cleanup
    fs.writeFileSync(settingsPath, originalSettings);
  });
});

describe('latestOf', () => {
  test('returns the latest dist-tag', async () => {
    stubFetch(distTags({ foo: '1.2.0' }));
    assert.equal(await latestOf('foo'), '1.2.0');
  });
  test('returns undefined on HTTP error', async () => {
    (globalThis as any).fetch = async () => ({
      ok: false,
      json: async () => ({ error: 'Not found' }),
    });
    assert.equal(await latestOf('foo'), undefined);
  });
  test('returns undefined offline', async () => {
    (globalThis as any).fetch = async () => {
      throw new Error('offline');
    };
    assert.equal(await latestOf('foo'), undefined);
  });
});

describe('checkOutdated', () => {
  test('lists only packages behind their dist-tag', async () => {
    stubFetch(distTags({ foo: '1.2.0', '@scope/bar': '2.0.0' }));
    assert.deepEqual(await checkOutdated(), [
      { name: 'foo', current: '1.0.0', latest: '1.2.0' },
    ]);
  });
});
