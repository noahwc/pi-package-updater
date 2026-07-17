// Shared type definitions and runtime dependencies for pi-package-updater.
// Every other module in extensions/ imports from here; this file has no
// intra-project imports.

declare const process: { env: Record<string, string | undefined> };
declare const require: (id: string) => unknown;

// ── pi runtime API types ────────────────────────────────────────────

export type Theme = { fg(color: string, text: string): string };
export type Tui = {
  terminal: { rows: number; columns: number };
  requestRender(): void;
};
export type Ctx = {
  hasUI: boolean;
  ui: {
    notify(msg: string, level?: "info" | "warning" | "error"): void;
    custom<T>(
      factory: (
        tui: Tui,
        theme: Theme,
        keybindings: unknown,
        done: (result?: T) => void,
      ) => unknown,
    ): Promise<T | undefined>;
  };
};
export type ExtensionAPI = {
  on(
    event: "session_start",
    handler: (event: { reason: string }, ctx: Ctx) => void | Promise<void>,
  ): void;
  registerCommand(
    name: string,
    cmd: {
      description: string;
      handler: (args: string | undefined, ctx: Ctx) => Promise<void>;
    },
  ): void;
  sendMessage(msg: {
    customType: string;
    content: string;
    display: boolean;
  }): void;
  exec(
    command: string,
    args: string[],
    options?: { timeout?: number },
  ): Promise<{ stdout: string; stderr: string; code: number }>;
};

// ── domain type ─────────────────────────────────────────────────────

export type Outdated = { name: string; current: string; latest: string };

// ── runtime deps (resolved through pi's module graph via jiti) ──────

export const fs = require("node:fs") as {
  readFileSync(p: string, enc: "utf8"): string;
  existsSync(p: string): boolean;
};

export const tuiLib = require("@earendil-works/pi-tui") as {
  Markdown: new (
    text: string,
    paddingX: number,
    paddingY: number,
    theme: unknown,
  ) => { render(width: number): string[] };
  matchesKey(data: string, keyId: string): boolean;
  truncateToWidth(s: string, width: number, ellipsis?: string): string;
};

export const { getMarkdownTheme } = require(
  "@earendil-works/pi-coding-agent",
) as {
  getMarkdownTheme(): unknown;
};

export const AGENT = `${process.env.HOME}/.pi/agent`;

// ── generic helpers ─────────────────────────────────────────────────

export const getJSON = (
  url: string,
  timeoutMs: number,
  headers?: Record<string, string>,
): Promise<any> =>
  fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) }).then((r) =>
    r.json(),
  );
