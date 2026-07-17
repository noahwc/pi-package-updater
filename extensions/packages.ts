// Package discovery and version checking: reads the installed package
// list from settings.json / node_modules and checks npm dist-tags for
// newer releases.

import { fs, AGENT, getJSON, type Outdated } from "./types.ts";

// true if a > b (numeric triplet compare; prerelease tags ignored)
export function newer(a: string, b: string): boolean {
  const pa = a.split(/[.-]/).map(Number);
  const pb = b.split(/[.-]/).map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0;
  }
  return false;
}

export function installedPackages(): Array<{ name: string; version: string }> {
  const s = JSON.parse(fs.readFileSync(`${AGENT}/settings.json`, "utf8"));
  const names: string[] = (s.packages ?? [])
    .map((x: string | { source: string }) =>
      typeof x === "string" ? x : x.source,
    )
    .filter((src: string) => src.startsWith("npm:"))
    .map((src: string) => src.slice(4).replace(/@[^@/]+$/, ""));
  const out: Array<{ name: string; version: string }> = [];
  for (const name of names) {
    const p = `${AGENT}/npm/node_modules/${name}/package.json`;
    if (!fs.existsSync(p)) continue;
    out.push({ name, version: JSON.parse(fs.readFileSync(p, "utf8")).version });
  }
  return out;
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
  const results = await Promise.all(
    installedPackages().map(async ({ name, version }) => {
      const latest = await latestOf(name);
      return latest && newer(latest, version)
        ? { name, current: version, latest }
        : null;
    }),
  );
  return results.filter((r): r is Outdated => r !== null);
}
