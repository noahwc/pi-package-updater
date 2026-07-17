// Package discovery and version checking: reads the installed package
// list from settings.json / node_modules and checks npm dist-tags for
// newer releases.

import { fs, AGENT, getJSON, type Outdated } from './types.ts';

// true if latestVersion > currentVersion (numeric triplet compare; prerelease tags ignored)
export function newer(latestVersion: string, currentVersion: string): boolean {
  const parseVersion = (versionStr: string) =>
    versionStr
      .split('.')
      .flatMap((segment) => segment.split('-'))
      .map(Number);
  const latestParts = parseVersion(latestVersion);
  const currentParts = parseVersion(currentVersion);
  const versionDiff =
    [0, 1, 2]
      .map((index) => (latestParts[index] || 0) - (currentParts[index] || 0))
      .find((diff) => diff !== 0) || 0;
  return versionDiff > 0;
}

export function installedPackages(): Array<{ name: string; version: string }> {
  const settingsData = JSON.parse(
    fs.readFileSync(`${AGENT}/settings.json`, 'utf8'),
  );
  return (settingsData.packages ?? []).flatMap(
    (p: string | { source: string }) => {
      const src = typeof p === 'string' ? p : p.source;
      if (!src.startsWith('npm:')) return [];
      const at = src.lastIndexOf('@');
      const name = at > 3 ? src.slice(4, at) : src.slice(4);
      const pkgPath = `${AGENT}/npm/node_modules/${name}/package.json`;
      if (!fs.existsSync(pkgPath)) return [];
      return [
        { name, version: JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version },
      ];
    },
  );
}

export async function latestOf(name: string): Promise<string | undefined> {
  try {
    const tags = await getJSON(
      `https://registry.npmjs.org/-/package/${encodeURIComponent(name)}/dist-tags`,
      4000,
    );
    return tags.latest;
  } catch {
    return undefined; // offline — stay silent
  }
}

export async function checkOutdated(): Promise<Outdated[]> {
  const checkResults = await Promise.all(
    installedPackages().map(async ({ name, version }) => {
      const latest = await latestOf(name);
      return latest && newer(latest, version)
        ? { name, current: version, latest }
        : null;
    }),
  );
  return checkResults.filter((result): result is Outdated => result !== null);
}
