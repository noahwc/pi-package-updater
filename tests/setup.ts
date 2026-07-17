import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function setupEnvironment() {
  const HOME = mkdtempSync(join(tmpdir(), 'pi-pkg-updater-'));
  process.env.HOME = HOME;
  const AGENT = join(HOME, '.pi', 'agent');
  const pkgDir = (name: string) => join(AGENT, 'npm', 'node_modules', name);
  mkdirSync(pkgDir('foo'), { recursive: true });
  mkdirSync(pkgDir('@scope/bar'), { recursive: true });
  writeFileSync(
    join(AGENT, 'settings.json'),
    JSON.stringify({
      packages: [
        'npm:foo@1.0.0',
        { source: 'npm:@scope/bar@2.0.0' },
        { source: 'git:something/else' },
        'npm:not-installed@1.0.0',
      ],
    }),
  );
  writeFileSync(
    join(pkgDir('foo'), 'package.json'),
    JSON.stringify({ name: 'foo', version: '1.0.0' }),
  );
  writeFileSync(
    join(pkgDir('@scope/bar'), 'package.json'),
    JSON.stringify({ name: '@scope/bar', version: '2.0.0' }),
  );
  return HOME;
}

export type Route = (url: string) => unknown | undefined;
export function stubFetch(...routes: Route[]) {
  (globalThis as any).fetch = async (url: string) => {
    for (const route of routes) {
      const body = route(url);
      if (body !== undefined) return { ok: true, json: async () => body };
    }
    throw new Error(`unstubbed fetch: ${url}`);
  };
}

export const distTags = (tags: Record<string, string>) => (url: string) => {
  const m = url.match(/-\/package\/(.+)\/dist-tags$/);
  return m ? { latest: tags[decodeURIComponent(m[1])] } : undefined;
};

export const registryDoc = {
  versions: {
    '0.9.0': {},
    '1.0.0': {},
    '1.1.0': {},
    '1.2.0': {},
    '2.0.0': {},
    '2.1.0': {}, // beyond latest — excluded
  },
  time: { '1.1.0': '2026-01-05T10:00:00Z', '2.0.0': '2026-03-01T09:00:00Z' },
  repository: { url: 'git+https://github.com/me/repo.git' },
};
export const longBody = 'x'.repeat(3000);
export const releases = [
  { tag_name: 'v2.0.0', body: longBody },
  { tag_name: 'repo@1.2.0', body: 'Patch notes' },
];
export const registryRoute = (doc: unknown) => (url: string) =>
  /registry\.npmjs\.org\/foo$/.test(url) ? doc : undefined;
export const releasesRoute = (rel: unknown) => (url: string) =>
  url.includes('api.github.com/repos/me/repo/releases') ? rel : undefined;
export const outdatedFoo = { name: 'foo', current: '1.0.0', latest: '2.0.0' };
