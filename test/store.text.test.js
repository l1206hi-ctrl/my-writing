const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeContent,
  countCharacters,
  buildPreview,
  countLine,
} = require('../store/text');

test('normalizeContent converts CRLF and CR to LF', () => {
  const value = 'a\r\nb\rc';
  assert.equal(normalizeContent(value), 'a\nb\nc');
});

test('countCharacters returns with/without spaces counts', () => {
  const counts = countCharacters('ab c\n d');
  assert.deepEqual(counts, {
    withSpaces: 7,
    withoutSpaces: 4,
  });
});

test('buildPreview trims very long lines around match index', () => {
  const line = 'x'.repeat(80) + 'MATCH' + 'y'.repeat(80);
  const idx = line.indexOf('MATCH');
  const preview = buildPreview(line, idx);

  assert.ok(preview.includes('MATCH'));
  assert.ok(preview.startsWith('...'));
  assert.ok(preview.endsWith('...'));
  assert.ok(preview.length <= 126);
});

test('countLine returns one-based line numbers', () => {
  const text = 'line1\nline2\nline3';
  const indexInLine3 = text.indexOf('line3');
  assert.equal(countLine(text, indexInLine3), 3);
});
