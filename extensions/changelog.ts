// Changelog assembly: fetches npm registry metadata and GitHub releases,
// then produces a markdown string covering every version in (current, latest].

import { getJSON, type Outdated } from './types.ts';
import { newer } from './packages.ts';

const getRepoParts = (url: string) => {
  const parts = url.split('github.com');
  if (parts.length < 2) return null;
  const path =
    parts[1].startsWith(':') || parts[1].startsWith('/')
      ? parts[1].slice(1)
      : parts[1];
  const pathParts = path.split('/');
  if (pathParts.length < 2) return null;
  const owner = pathParts[0];
  const name = pathParts[1].endsWith('.git')
    ? pathParts[1].slice(0, -4)
    : pathParts[1];
  return [owner, name];
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

  const validMatches = (Array.isArray(githubReleases) ? githubReleases : [])
    .flatMap((releaseRecord) =>
      intermediateVersions.map((intermediateVersion) => ({
        version: intermediateVersion,
        tagName: String(releaseRecord.tag_name ?? ''),
        releaseBody: String(releaseRecord.body ?? '').trim(),
      })),
    )
    .filter(({ version, tagName }) => tagName.endsWith(version));

  const releaseNotesByVersion = Object.fromEntries(
    validMatches.map(({ version, releaseBody }) => [version, releaseBody]),
  );
  const firstMatchRecord = validMatches[0];
  const derivedTagPrefix = firstMatchRecord
    ? firstMatchRecord.tagName.slice(0, -firstMatchRecord.version.length)
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
