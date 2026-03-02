const numberFormatter = new Intl.NumberFormat();

export function normalizeText(value) {
  return String(value || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export function getCharCounts(value) {
  const normalized = normalizeText(value);
  return {
    withSpaces: normalized.length,
    withoutSpaces: normalized.replace(/\s/g, '').length,
  };
}

export function formatCount(value) {
  return numberFormatter.format(value);
}

export function formatCountPair(counts) {
  if (!counts) {
    return '??';
  }
  return `${formatCount(counts.withSpaces)} / ${formatCount(counts.withoutSpaces)}`;
}
