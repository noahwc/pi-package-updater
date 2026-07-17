// Pure display / rendering functions. Every function here is stateless:
// data in, strings out. No state management or input handling.

import { tuiLib, type Theme, type Outdated } from "./types.ts";

// ── pager rendering ─────────────────────────────────────────────────

/** Snapshot of pager state needed to render a frame. */
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

/** Build the hints bar shown at the bottom of the pager. */
export function formatHints(
  status: string,
  busy: boolean,
  pct: string,
): string {
  if (busy) return status;
  return `${status ? `${status}  ·  ` : ""}↑↓ scroll · space/b page · ←→ pkg · u upgrade · q close${pct}`;
}

/**
 * Render a single pager frame: header, separator, viewport-sliced body,
 * separator, hints bar.
 */
export function renderPager(
  state: PagerRenderState,
  theme: Theme,
  width: number,
): { lines: string[]; clampedScroll: number } {
  const { page, bodyLines, viewport, pageIndex, pageCount, status, busy } =
    state;
  let { scroll } = state;
  const max = Math.max(0, bodyLines.length - viewport);
  scroll = Math.min(scroll, max);
  const trunc = (s: string) => tuiLib.truncateToWidth(s, width - 1);

  const pos = pageCount > 1 ? ` (${pageIndex + 1}/${pageCount})` : "";
  const pct =
    max === 0
      ? ""
      : ` · ${Math.round(((scroll + viewport) / bodyLines.length) * 100)}%`;
  const hints = formatHints(status, busy, pct);

  return {
    lines: [
      theme.fg(
        "accent",
        trunc(` ${page.name} ${page.current}→${page.latest}${pos}`),
      ),
      theme.fg("dim", "─".repeat(width)),
      ...bodyLines.slice(scroll, scroll + viewport),
      theme.fg("dim", "─".repeat(width)),
      theme.fg("dim", trunc(` ${hints}`)),
    ],
    clampedScroll: scroll,
  };
}

// ── notification formatting ─────────────────────────────────────────

/** Format the startup notification shown when outdated packages exist. */
export function formatUpdateNotice(list: Outdated[]): string {
  return (
    `${list.length} package update(s) available: ` +
    `${list.map((o) => `${o.name} ${o.current}→${o.latest}`).join(", ")} — /updates to review`
  );
}
