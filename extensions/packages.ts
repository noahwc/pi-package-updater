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
  return (settingsData.packages ?? [])
    .map((packageConfig: string | { source: string }) =>
      typeof packageConfig === 'string' ? packageConfig : packageConfig.source,
    )
    .filter((packageSource: string) => packageSource.startsWith('npm:'))
    .map((packageSource: string) => packageSource.slice(4))
    .map((packageSource: string) => {
      const lastAtIndex = packageSource.lastIndexOf('@');
      return lastAtIndex > 0
        ? packageSource.slice(0, lastAtIndex)
        : packageSource;
    })
    .map((packageName: string) => ({
      name: packageName,
      packageJsonPath: `${AGENT}/npm/node_modules/${packageName}/package.json`,
    }))
    .filter(({ packageJsonPath }: { packageJsonPath: string }) =>
      fs.existsSync(packageJsonPath),
    )
    .map(
      ({
        name,
        packageJsonPath,
      }: {
        name: string;
        packageJsonPath: string;
      }) => ({
        name,
        version: JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')).version,
      }),
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
