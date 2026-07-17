# pi-package-updater

Pi extension: startup update notifier + interactive changelog reviewer for outdated pi packages.

## Features

- **Startup notice** — compares every installed pi package against the registry's `latest` dist-tag and shows a one-line notice when updates exist.
- **`/updates [pkg]`** — full-screen pager with release notes per outdated package:
  - `↑↓` scroll line-by-line, `space/b` page, `g/G` jump to top/bottom
  - `←→` switch between packages
  - `u` upgrade the current package in-place
  - `q` / `Escape` close
- **GitHub compare link** — links to the full diff on GitHub when a repo is detected (tag format auto-detected from releases).
- **Pin-aware** — reads the real installed version from `node_modules`, so pinned sources (`npm:pkg@x.y.z`) still surface newer releases.

## Install

```bash
pi install npm:pi-package-updater
```

## Development

```bash
npm install
npm test
```

## License

MIT
