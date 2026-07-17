// Test stub for @earendil-works/pi-tui (resolved via NODE_PATH=tests/stubs).
// Markdown renders one line per source line; matchesKey is identity so tests
// can pass key ids ("up", "escape") straight into handleInput.
class Markdown {
  constructor(text) {
    this.text = text;
  }
  render() {
    return this.text.split('\n');
  }
}
module.exports = {
  Markdown,
  matchesKey: (data, keyId) => data === keyId,
  truncateToWidth: (s, width) => s.slice(0, width),
};
