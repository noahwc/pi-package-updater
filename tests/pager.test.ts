import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { outdatedFoo } from './setup.ts';

declare const require: (id: string) => any;
const pagerMod = require('../src/pager.ts');
const ChangelogPager = pagerMod.ChangelogPager;

const mdOf = (n: number) =>
  Array.from({ length: n }, (_, i) => `line${i}`).join('\n');
// tui stub: rows 16 → viewport = max(5, 16 - 6) = 10
const makePager = (pages: Array<{ o: any; md: string }>) =>
  new ChangelogPager(
    pages,
    { terminal: { rows: 16, columns: 80 }, requestRender() {} },
    { fg: (_c: string, t: string) => t },
  );
const twoPages = () => [
  { o: outdatedFoo, md: mdOf(30) },
  { o: { name: '@scope/bar', current: '2.0.0', latest: '3.0.0' }, md: mdOf(3) },
];
const bodyOf = (lines: string[]) => lines.slice(2, -2);

describe('ChangelogPager', () => {
  test('renders header, separators, viewport-sized body, and hints', () => {
    const lines = makePager(twoPages()).render(80);
    assert.equal(lines[0], ' foo 1.0.0→2.0.0 (1/2)');
    assert.deepEqual(
      bodyOf(lines),
      Array.from({ length: 10 }, (_, i) => `line${i}`),
    );
    assert.ok(lines.at(-1)!.includes('↑↓ scroll'));
    assert.ok(lines.at(-1)!.includes('space/b page'));
    assert.ok(lines.at(-1)!.includes('33%')); // 10 of 30 lines visible
  });

  test('arrow keys scroll and clamp at both ends', () => {
    const pager = makePager(twoPages());
    pager.handleInput('up'); // clamped at top
    assert.equal(bodyOf(pager.render(80))[0], 'line0');
    pager.handleInput('down');
    pager.handleInput('down');
    assert.equal(bodyOf(pager.render(80))[0], 'line2');
    for (let i = 0; i < 99; i++) pager.handleInput('down');
    assert.equal(bodyOf(pager.render(80))[0], 'line20'); // 30 - viewport
    pager.handleInput('home');
    assert.equal(bodyOf(pager.render(80))[0], 'line0');
  });

  test('end, G, and g jump to extremes', () => {
    const pager = makePager(twoPages());
    pager.handleInput('end');
    assert.equal(bodyOf(pager.render(80))[0], 'line20');
    pager.handleInput('home');
    assert.equal(bodyOf(pager.render(80))[0], 'line0');
    pager.handleInput('G');
    assert.equal(bodyOf(pager.render(80))[0], 'line20');
    pager.handleInput('g');
    assert.equal(bodyOf(pager.render(80))[0], 'line0');
  });

  test('space/b page by a viewport', () => {
    const pager = makePager(twoPages());
    pager.handleInput('space');
    assert.equal(bodyOf(pager.render(80))[0], 'line10');
    pager.handleInput('b');
    assert.equal(bodyOf(pager.render(80))[0], 'line0');
  });

  test('left/right switch packages and reset scroll; right past last closes', () => {
    const pager = makePager(twoPages());
    let closed = false;
    pager.onClose = () => (closed = true);
    pager.handleInput('down');
    pager.handleInput('right');
    assert.equal(pager.render(80)[0], ' @scope/bar 2.0.0→3.0.0 (2/2)');
    pager.handleInput('left');
    assert.equal(bodyOf(pager.render(80))[0], 'line0'); // scroll was reset
    pager.handleInput('left'); // clamped at first page
    assert.equal(pager.render(80)[0], ' foo 1.0.0→2.0.0 (1/2)');
    pager.handleInput('right');
    pager.handleInput('right');
    assert.equal(closed, true);
  });

  test('u fires onUpgrade for the current page', () => {
    const pager = makePager(twoPages());
    let upgraded: any;
    pager.onUpgrade = (o: any) => (upgraded = o);
    pager.handleInput('right');
    pager.handleInput('u');
    assert.equal(upgraded.name, '@scope/bar');
  });

  test('q and escape close; busy locks all input and shows only status', () => {
    const pager = makePager(twoPages());
    let closed = 0;
    pager.onClose = () => closed++;
    pager.handleInput('q');
    pager.handleInput('escape');
    assert.equal(closed, 2);
    pager.setStatus('Installing…', true);
    pager.handleInput('q');
    pager.handleInput('down');
    assert.equal(closed, 2); // still 2 — input held
    const lines = pager.render(80);
    assert.equal(lines.at(-1), ' Installing…');
    assert.equal(bodyOf(lines)[0], 'line0'); // no scroll happened
  });
});
