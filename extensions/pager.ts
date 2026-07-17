// Full-screen pager: owns the keyboard while open, so arrow keys scroll the
// changelog instead of fighting a select dialog. One instance pages every
// outdated package (←/→), so nothing flashes between pages.
//
// State + input handling only — rendering is delegated to renderer.ts.

import {
  tuiLib,
  getMarkdownTheme,
  type Tui,
  type Theme,
  type Outdated,
} from './types.ts';
import { renderPager } from './renderer.ts';

export class ChangelogPager {
  private currentIndex = 0;
  private scroll = 0;
  private status = '';
  private busy = false;
  private bodies: Array<{ render(width: number): string[] }>;

  onUpgrade?: (outdatedPackage: Outdated) => void;
  onClose?: () => void;

  constructor(
    private pages: Array<{ o: Outdated; md: string }>,
    private tui: Tui,
    private theme: Theme,
  ) {
    const mdTheme = getMarkdownTheme();
    this.bodies = pages.map(
      (pageData) => new tuiLib.Markdown(pageData.md, 1, 0, mdTheme),
    );
  }

  setStatus(statusText: string, isBusy: boolean): void {
    this.status = statusText;
    this.busy = isBusy;
    this.tui.requestRender();
  }

  private viewport(): number {
    return Math.max(5, this.tui.terminal.rows - 6);
  }

  private scrollBy(scrollAmount: number): void {
    this.scroll = Math.max(0, this.scroll + scrollAmount);
    this.tui.requestRender();
  }

  private goto(targetIndex: number): void {
    if (targetIndex < 0 || this.busy) return;
    if (targetIndex >= this.pages.length) {
      this.onClose?.();
      return;
    }
    this.currentIndex = targetIndex;
    this.scroll = 0;
    this.tui.requestRender();
  }

  handleInput(inputData: string): void {
    const isKeyMatch = (keyId: string) => tuiLib.matchesKey(inputData, keyId);
    if (this.busy) return; // install running — hold the page
    if (isKeyMatch('escape') || inputData === 'q') this.onClose?.();
    else if (isKeyMatch('up')) this.scrollBy(-1);
    else if (isKeyMatch('down')) this.scrollBy(1);
    else if (isKeyMatch('pageUp') || inputData === 'b')
      this.scrollBy(-this.viewport());
    else if (isKeyMatch('pageDown') || isKeyMatch('space'))
      this.scrollBy(this.viewport());
    else if (isKeyMatch('home') || inputData === 'g') this.scrollBy(-Infinity);
    else if (isKeyMatch('end') || inputData === 'G') this.scrollBy(Infinity);
    else if (isKeyMatch('left')) this.goto(this.currentIndex - 1);
    else if (isKeyMatch('right') || isKeyMatch('enter'))
      this.goto(this.currentIndex + 1);
    else if (inputData === 'u')
      this.onUpgrade?.(this.pages[this.currentIndex].o);
  }

  render(width: number): string[] {
    const bodyLines = this.bodies[this.currentIndex].render(width);
    const result = renderPager(
      {
        page: this.pages[this.currentIndex].o,
        bodyLines,
        scroll: this.scroll,
        viewport: this.viewport(),
        pageIndex: this.currentIndex,
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
