// Changelog assembly: fetches npm registry metadata and GitHub releases,
// then produces a markdown string covering every version in (current, latest].

import { getJSON, type Outdated } from './types.ts';
import { newer } from './packages.ts';

const getRepoParts = (url: string) => {
  const m = url.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?(?:#.*)?$/);
  return m ? [m[1], m[2]] : null;
};

export async function changelogFor(outdatedPackage: Outdated): Promise<string> {
  const registryDocument = await getJSON(
    `https://registry.npmjs.org/${encodeURIComponent(outdatedPackage.name)}`,
    8000,
  );
  const intermediateVersions = Object.keys(registryDocument.versions ?? {})
    .filter(
      (versionKey) =>
        newer(versionKey, outdatedPackage.current) &&
        !newer(versionKey, outdatedPackage.latest),
    ) // (current, latest]
    .sort((versionA, versionB) => (newer(versionA, versionB) ? -1 : 1));
  const versionDates: Record<string, string> = registryDocument.time ?? {};

  const repositoryUrl = String(registryDocument.repository?.url ?? '');
  const repositoryParts = getRepoParts(repositoryUrl);

  const githubReleases = repositoryParts
    ? await getJSON(
        `https://api.github.com/repos/${repositoryParts[0]}/${repositoryParts[1]}/releases?per_page=100`,
        8000,
        {
          accept: 'application/vnd.github+json',
          'user-agent': 'pi-package-updater',
        },
      ).catch(() => null)
    : null;

  const validMatches = (
    Array.isArray(githubReleases) ? githubReleases : []
  ).flatMap((r) => {
    const t = String(r.tag_name || '');
    return intermediateVersions
      .filter((v) => t.endsWith(v))
      .map((v) => [v, String(r.body || '').trim(), t] as const);
  });
  const releaseNotesByVersion = Object.fromEntries(
    validMatches.map(([v, b]) => [v, b]),
  );
  const derivedTagPrefix = validMatches[0]
    ? validMatches[0][2].slice(0, -validMatches[0][0].length)
    : null;
  const formatVersionTag = (versionString: string) =>
    `${derivedTagPrefix ?? 'v'}${versionString}`;
  const githubCompareUrl = repositoryParts
    ? `https://github.com/${repositoryParts[0]}/${repositoryParts[1]}/compare/${formatVersionTag(outdatedPackage.current)}...${formatVersionTag(outdatedPackage.latest)}`
    : '';

  const formattedVersionLines = intermediateVersions.flatMap(
    (intermediateVersion) => [
      `\n### ${intermediateVersion} (${(versionDates[intermediateVersion] ?? '').slice(0, 10)})`,
      releaseNotesByVersion[intermediateVersion] || '_no release notes_',
    ],
  );

  const outputLines = [
    `## ${outdatedPackage.name} ${outdatedPackage.current} → ${outdatedPackage.latest}`,
    ...(githubCompareUrl ? [`[Compare on GitHub](${githubCompareUrl})`] : []),
    ...formattedVersionLines,
    ...(Object.keys(releaseNotesByVersion).length === 0
      ? [
          `\nNo GitHub release notes found — see https://www.npmjs.com/package/${outdatedPackage.name}?activeTab=versions`,
        ]
      : []),
    `\nUpgrading re-pins settings.json to the new version; restart pi to load.`,
  ];

  return outputLines.join('\n');
}
