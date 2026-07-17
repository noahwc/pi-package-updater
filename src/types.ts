// Shared type definitions and runtime dependencies for pi-package-updater.
// Every other module in src/ imports from here; this file has no
// intra-project imports.

import * as fs from 'node:fs';
import * as tuiLib from '@earendil-works/pi-tui';
import { getMarkdownTheme } from '@earendil-works/pi-coding-agent';

declare const process: { env: Record<string, string | undefined> };

export type Theme = { fg(color: string, text: string): string };
export type Tui = {
  terminal: { rows: number; columns: number };
  requestRender(): void;
};
export type Ctx = {
  hasUI: boolean;
  ui: {
    notify(msg: string, level?: 'info' | 'warning' | 'error'): void;
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
    event: 'session_start',
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

export type Outdated = { name: string; current: string; latest: string };

export { fs, tuiLib, getMarkdownTheme };

export const AGENT = `${process.env.HOME}/.pi/agent`;

export const getJSON = (
  url: string,
  timeoutMs: number,
  headers?: Record<string, string>,
): Promise<any> =>
  fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) }).then(
    (response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    },
  );
