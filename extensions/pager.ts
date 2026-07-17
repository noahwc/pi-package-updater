// Full-screen pager: owns the keyboard while open, so arrow keys scroll the
// changelog instead of fighting a select dialog. One instance pages every
// outdated package (←/→), so nothing flashes between pages.
//
// State + input handling only — rendering is delegated to renderer.ts.

import { tuiLib, getMarkdownTheme, type Tui, type Theme, type Outdated } from "./types.ts";
import { renderPager } from "./renderer.ts";

export class ChangelogPager {
  private idx = 0;
  private scroll = 0;
  private status = "";
  private busy = false;
  private bodies: Array<{ render(width: number): string[] }>;

  onUpgrade?: (o: Outdated) => void;
  onClose?: () => void;

  constructor(
    private pages: Array<{ o: Outdated; md: string }>,
    private tui: Tui,
    private theme: Theme,
  ) {
    const mdTheme = getMarkdownTheme();
    this.bodies = pages.map((p) => new tuiLib.Markdown(p.md, 1, 0, mdTheme));
  }

  setStatus(s: string, busy: boolean): void {
    this.status = s;
    this.busy = busy;
    this.tui.requestRender();
  }

  private viewport(): number {
    return Math.max(5, this.tui.terminal.rows - 6);
  }

  private scrollBy(n: number): void {
    this.scroll = Math.max(0, this.scroll + n);
    this.tui.requestRender();
  }

  private goto(i: number): void {
    if (i < 0 || this.busy) return;
    if (i >= this.pages.length) {
      this.onClose?.();
      return;
    }
    this.idx = i;
    this.scroll = 0;
    this.tui.requestRender();
  }

  handleInput(data: string): void {
    const k = (id: string) => tuiLib.matchesKey(data, id);
    if (this.busy) return; // install running — hold the page
    if (k("escape") || data === "q") this.onClose?.();
    else if (k("up")) this.scrollBy(-1);
    else if (k("down")) this.scrollBy(1);
    else if (k("pageUp") || data === "b") this.scrollBy(-this.viewport());
    else if (k("pageDown") || k("space")) this.scrollBy(this.viewport());
    else if (k("home") || data === "g") this.scrollBy(-Infinity);
    else if (k("end") || data === "G") this.scrollBy(Infinity);
    else if (k("left")) this.goto(this.idx - 1);
    else if (k("right") || k("enter")) this.goto(this.idx + 1);
    else if (data === "u") this.onUpgrade?.(this.pages[this.idx].o);
  }

  render(width: number): string[] {
    const bodyLines = this.bodies[this.idx].render(width);
    const result = renderPager(
      {
        page: this.pages[this.idx].o,
        bodyLines,
        scroll: this.scroll,
        viewport: this.viewport(),
        pageIndex: this.idx,
        pageCount: this.pages.length,
        status: this.status,
        busy: this.busy,
      },
      this.theme,
      width,
    );
    // Sync clamped scroll back so subsequent input uses the clamped value.
    this.scroll = result.clampedScroll;
    return result.lines;
  }
}
