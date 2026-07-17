// pi-package-updater: startup update notifier + interactive changelog pager.
// On startup: compares every installed npm package against the registry's
// latest dist-tag and shows a one-line notice when updates exist. Pin-aware:
// reads the real installed version from node_modules, so pinned sources
// (npm:pkg@x.y.z) still surface newer releases.
// /updates [pkg]: full-screen pager, one outdated package per page — arrow
// keys scroll the release notes, ←/→ switch packages, u upgrades, q closes.
// (/changelog is taken by a pi builtin.)
//
// Typed structurally on purpose (see omlx.ts): pi injects the real API via
// jiti at runtime; no package.json/npm install needed for editor types.

import type { ExtensionAPI, Outdated } from "./types.ts";
import { newer, installedPackages, latestOf, checkOutdated } from "./packages.ts";
import { changelogFor } from "./changelog.ts";
import { formatUpdateNotice } from "./renderer.ts";
import { ChangelogPager } from "./pager.ts";

export default function (pi: ExtensionAPI) {
  let cached: Outdated[] | null = null;

  pi.on("session_start", (event, ctx) => {
    if (event.reason !== "startup") return;
    // Fire-and-forget so 22 registry fetches never delay boot.
    void checkOutdated()
      .then((list) => {
        cached = list;
        if (list.length && ctx.hasUI)
          ctx.ui.notify(formatUpdateNotice(list), "info");
      })
      .catch(() => {});
  });

  // pi install re-pins settings.json to the exact version. npm's
  // min-release-age guard rejects young exact pins with ETARGET; the pin
  // is the verified control, so bypass it once on failure.
  // Returns an error string, or undefined on success.
  const upgrade = async (o: Outdated): Promise<string | undefined> => {
    const spec = `npm:${o.name}@${o.latest}`;
    let r = await pi.exec("pi", ["install", spec], { timeout: 180000 });
    if (r.code !== 0)
      r = await pi.exec(
        "env",
        ["npm_config_min_release_age=0", "pi", "install", spec],
        { timeout: 180000 },
      );
    if (r.code !== 0)
      return `install failed — ${(r.stderr || r.stdout).trim().split("\n").pop()}`;
    cached = (cached ?? []).filter((c) => c.name !== o.name);
    return undefined;
  };

  pi.registerCommand("updates", {
    description:
      "Page release notes for outdated stack packages, upgrade or leave each (/updates [pkg])",
    handler: async (args, ctx) => {
      const arg = args?.trim();
      let list: Outdated[];
      if (arg) {
        const pkg = installedPackages().find(
          (p) => p.name === arg || p.name.endsWith(`/${arg}`),
        );
        if (!pkg) {
          ctx.ui.notify(`${arg}: not an installed stack package`, "warning");
          return;
        }
        const latest = await latestOf(pkg.name);
        if (!latest) {
          ctx.ui.notify(`${pkg.name}: registry unreachable`, "warning");
          return;
        }
        if (!newer(latest, pkg.version)) {
          ctx.ui.notify(`${pkg.name} ${pkg.version} is up to date`, "info");
          return;
        }
        list = [{ name: pkg.name, current: pkg.version, latest }];
      } else {
        cached ??= await checkOutdated();
        if (!cached.length) {
          ctx.ui.notify("All stack packages are up to date", "info");
          return;
        }
        list = [...cached];
      }

      // Prefetch every page up front so paging has no network gaps (the
      // editor would flash between dialogs while awaiting fetches).
      if (ctx.hasUI)
        ctx.ui.notify(`Fetching ${list.length} changelog(s)…`, "info");
      const pages = await Promise.all(
        list.map(async (o) => ({
          o,
          md: await changelogFor(o).catch(
            () =>
              `## ${o.name} ${o.current} → ${o.latest}\n\n_changelog fetch failed_`,
          ),
        })),
      );

      // Headless: dump pages into the session and stop. (No deliverAs: an
      // idle sendMessage appends immediately — "nextTurn" would queue it
      // invisibly until the next user prompt.)
      if (!ctx.hasUI) {
        for (const p of pages)
          pi.sendMessage({
            customType: "pi-package-updater-changelog",
            content: p.md,
            display: true,
          });
        return;
      }

      await ctx.ui.custom<void>((tui, theme, _kb, done) => {
        const pager = new ChangelogPager(pages, tui, theme);
        pager.onClose = () => done();
        pager.onUpgrade = (o) => {
          pager.setStatus(`Installing ${o.name}@${o.latest}…`, true);
          void upgrade(o).then((err) =>
            pager.setStatus(
              err
                ? `${o.name}: ${err}`
                : `${o.name}@${o.latest} installed — restart pi to load`,
              false,
            ),
          );
        };
        return pager;
      });
    },
  });
}
