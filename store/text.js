function normalizeContent(value) {
  return String(value || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function countCharacters(value) {
  const normalized = normalizeContent(value);
  return {
    withSpaces: normalized.length,
    withoutSpaces: normalized.replace(/\s/g, '').length,
  };
}

function buildPreview(content, matchIndex) {
  const text = normalizeContent(content);
  const lineStart = Math.max(0, text.lastIndexOf('\n', matchIndex) + 1);
  let lineEnd = text.indexOf('\n', matchIndex);
  if (lineEnd === -1) {
    lineEnd = text.length;
  }
  let line = text.slice(lineStart, lineEnd).trim();
  const relative = matchIndex - lineStart;
  if (line.length > 160) {
    const sliceStart = Math.max(0, relative - 40);
    const sliceEnd = Math.min(line.length, sliceStart + 120);
    let trimmed = line.slice(sliceStart, sliceEnd);
    if (sliceStart > 0) {
      trimmed = `...${trimmed}`;
    }
    if (sliceEnd < line.length) {
      trimmed = `${trimmed}...`;
    }
    line = trimmed;
  }
  return line;
}

function countLine(content, index) {
  return normalizeContent(content).slice(0, index).split('\n').length;
}

module.exports = {
  normalizeContent,
  countCharacters,
  buildPreview,
  countLine,
};
