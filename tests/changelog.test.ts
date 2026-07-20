import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  stubFetch,
  registryDoc,
  releases,
  registryRoute,
  releasesRoute,
  outdatedFoo,
  longBody,
} from './setup.ts';

declare const require: (id: string) => any;
const changelog = require('../extensions/changelog.ts');
const { changelogFor } = changelog;

describe('changelogFor', () => {
  test('lists every version in (current, latest], newest first, uncapped', async () => {
    stubFetch(registryRoute(registryDoc), releasesRoute(releases));
    const md = await changelogFor(outdatedFoo);
    const headings = [...md.matchAll(/^### ([\d.]+)/gm)].map((m) => m[1]);
    assert.deepEqual(headings, ['2.0.0', '1.2.0', '1.1.0']);
    assert.ok(!md.includes('older version(s)'));
    assert.ok(md.includes('### 1.1.0 (2026-01-05)'));
    assert.ok(
      md.includes(
        '[Compare on GitHub](https://github.com/me/repo/compare/v1.0.0...v2.0.0)',
      ),
    );
  });
  test('matches GitHub release notes by tag suffix, bodies untruncated', async () => {
    stubFetch(registryRoute(registryDoc), releasesRoute(releases));
    const md = await changelogFor(outdatedFoo);
    assert.ok(md.includes(longBody)); // v-prefix tag, full 3000-char body
    assert.ok(md.includes('Patch notes')); // monorepo-style tag
    assert.ok(md.includes('_no release notes_')); // 1.1.0 has no release
    assert.ok(md.includes(`restart pi to load`));
  });
  test('falls back to an npmjs link when no notes are found', async () => {
    stubFetch(registryRoute({ ...registryDoc, repository: undefined }));
    const md = await changelogFor(outdatedFoo);
    assert.ok(
      md.includes('https://www.npmjs.com/package/foo?activeTab=versions'),
    );
  });
  test('handles malformed registry document', async () => {
    stubFetch(registryRoute({}));
    const md = await changelogFor(outdatedFoo);
    assert.ok(md.includes('No GitHub release notes found'));
  });
  test('handles github fetch rejection', async () => {
    stubFetch(registryRoute(registryDoc), (url: string) => {
      if (url.includes('api.github.com')) throw new Error('github down');
      return undefined;
    });
    const md = await changelogFor(outdatedFoo);
    assert.ok(md.includes('No GitHub release notes found'));
  });
  test('handles malformed github response', async () => {
    stubFetch(registryRoute(registryDoc), releasesRoute({ some: 'object' }));
    const md = await changelogFor(outdatedFoo);
    assert.ok(md.includes('No GitHub release notes found'));
  });
  test('handles release without tag name or body', async () => {
    stubFetch(registryRoute(registryDoc), releasesRoute([{}]));
    const md = await changelogFor(outdatedFoo);
    assert.ok(md.includes('_no release notes_'));
  });
});
