declare module '@earendil-works/pi-tui' {
  export class Markdown {
    constructor(
      text: string,
      paddingX: number,
      paddingY: number,
      theme: unknown,
    );
    render(width: number): string[];
  }
  export function matchesKey(data: string, keyId: string): boolean;
  export function truncateToWidth(
    s: string,
    width: number,
    ellipsis?: string,
  ): string;
}

declare module '@earendil-works/pi-coding-agent' {
  export function getMarkdownTheme(): unknown;
}
