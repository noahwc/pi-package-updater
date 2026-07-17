// Changelog assembly: fetches npm registry metadata and GitHub releases,
// then produces a markdown string covering every version in (current, latest].

import { getJSON, type Outdated } from "./types.ts";
import { newer } from "./packages.ts";

export async function changelogFor(o: Outdated): Promise<string> {
  const doc = await getJSON(
    `https://registry.npmjs.org/${encodeURIComponent(o.name)}`,
    8000,
  );
  const between = Object.keys(doc.versions ?? {})
    .filter((v) => newer(v, o.current) && !newer(v, o.latest)) // (current, latest]
    .sort((a, b) => (newer(a, b) ? -1 : 1));
  const dates: Record<string, string> = doc.time ?? {};

  // Release notes from GitHub releases, matched by tag suffix (handles
  // v1.2.3, 1.2.3, and monorepo pkg@1.2.3 tag styles).
  const notes: Record<string, string> = {};
  let compareUrl = "";
  const repo = String(doc.repository?.url ?? "").match(
    /github\.com[/:]([^/]+)\/([^/.]+)/,
  );
  if (repo) {
    const rel = await getJSON(
      `https://api.github.com/repos/${repo[1]}/${repo[2]}/releases?per_page=100`,
      8000,
      { accept: "application/vnd.github+json", "user-agent": "pi-package-updater" },
    ).catch(() => null);
    let tagPrefix: string | null = null;
    if (Array.isArray(rel))
      for (const r of rel)
        for (const v of between) {
          const tag = String(r.tag_name ?? "");
          if (tag.endsWith(v)) {
            notes[v] = String(r.body ?? "").trim();
            if (tagPrefix === null) tagPrefix = tag.slice(0, -v.length);
          }
        }
    const fmt = (v: string) => `${tagPrefix ?? "v"}${v}`;
    compareUrl = `https://github.com/${repo[1]}/${repo[2]}/compare/${fmt(o.current)}...${fmt(o.latest)}`;
  }

  const lines = [`## ${o.name} ${o.current} → ${o.latest}`];
  if (compareUrl)
    lines.push(`[Compare on GitHub](${compareUrl})`);
  for (const v of between) {
    lines.push(`\n### ${v} (${(dates[v] ?? "").slice(0, 10)})`);
    lines.push(notes[v] || "_no release notes_");
  }
  if (!Object.keys(notes).length)
    lines.push(
      `\nNo GitHub release notes found — see https://www.npmjs.com/package/${o.name}?activeTab=versions`,
    );
  lines.push(
    `\nUpgrading re-pins settings.json to the new version; restart pi to load.`,
  );
  return lines.join("\n");
}
