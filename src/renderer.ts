// Handle UI display

import { tuiLib, type Theme, type Outdated } from './types.ts';

export type PagerRenderState = {
  page: Outdated;
  bodyLines: string[];
  scroll: number;
  viewport: number;
  pageIndex: number;
  pageCount: number;
  status: string;
  busy: boolean;
};

export function pageNavHints(
  status: string,
  busy: boolean,
  percentageString: string,
): string {
  if (busy) return status;
  return `${status ? `${status}  ·  ` : ''}↑↓ scroll · space/b page · ←→ pkg · u upgrade · q close${percentageString}`;
}

export function renderPager(
  state: PagerRenderState,
  theme: Theme,
  width: number,
): { lines: string[]; clampedScroll: number } {
  const {
    page,
    bodyLines,
    scroll,
    viewport,
    pageIndex,
    pageCount,
    status,
    busy,
  } = state;
  const max = Math.max(0, bodyLines.length - viewport);
  const clampedScroll = Math.min(scroll, max);
  const truncateString = (textToTruncate: string) =>
    tuiLib.truncateToWidth(textToTruncate, width - 1);

  const positionString =
    pageCount > 1 ? ` (${pageIndex + 1}/${pageCount})` : '';
  const percentageString =
    max === 0
      ? ''
      : ` · ${Math.round(((clampedScroll + viewport) / bodyLines.length) * 100)}%`;
  const hints = pageNavHints(status, busy, percentageString);

  return {
    lines: [
      theme.fg(
        'accent',
        truncateString(
          ` ${page.name} ${page.current}→${page.latest}${positionString}`,
        ),
      ),
      theme.fg('dim', '─'.repeat(width)),
      ...bodyLines.slice(clampedScroll, clampedScroll + viewport),
      theme.fg('dim', '─'.repeat(width)),
      theme.fg('dim', truncateString(` ${hints}`)),
    ],
    clampedScroll,
  };
}

export function formatUpdateNotice(list: Outdated[]): string {
  return (
    `${list.length} package update(s) available: ` +
    `${list.map((outdatedPackage) => `${outdatedPackage.name} ${outdatedPackage.current}→${outdatedPackage.latest}`).join(', ')} — /updates to review`
  );
}
