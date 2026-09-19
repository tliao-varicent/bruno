// Line-oriented, splits on the first colon unconditionally and keeps quotes.
// For the single-pair, quote-stripping variant see `parsePastedKeyValuePair` below.
export function parseBulkKeyValue(value) {
  return value
    .split(/\r?\n/)
    .map((pair) => {
      const isEnabled = !pair.trim().startsWith('//');
      const cleanPair = pair.replace(/^\/\/\s*/, '');
      const sep = cleanPair.indexOf(':');
      if (sep < 0) return null;
      return {
        name: cleanPair.slice(0, sep).trim(),
        value: cleanPair.slice(sep + 1).trim(),
        enabled: isEnabled
      };
    })
    .filter(Boolean);
}

export function serializeBulkKeyValue(items) {
  return items.map((item) => `${item.enabled ? '' : '//'}${item.name}:${item.value}`).join('\n');
}

// The key must be quoted, as it is in JSON. That also rejects a pasted
// `https://example.com`, which would otherwise split into `https` and `//example.com`.
// The value needs no such guard: a quoted key already proves the text is a pair.
const JSON_MEMBER = /^("(?:[^"\\]|\\.)*")\s*:\s*(.+)$/;

// A quoted segment is a JSON string, so JSON.parse resolves its escapes. Anything else is
// taken literally, which is how an unquoted `3` or `tom-db-per-tenant` keeps its own text.
const unquote = (segment) => {
  if (!segment.startsWith('"')) return segment;
  try {
    return JSON.parse(segment);
  } catch {
    return segment.slice(1, -1);
  }
};

/**
 * Parses a single `"name": "value"` pair copied out of a JSON object, so it can be
 * split across a table's key and value columns. Unlike `parseBulkKeyValue` above,
 * this handles one pair and strips the quotes.
 *
 * @returns {{ name: string, value: string } | null} null when the text is not a pair.
 */
export function parsePastedKeyValuePair(text) {
  if (typeof text !== 'string') return null;

  // Trimming before rejecting newlines matters: copying a line out of a file usually
  // brings a trailing newline along, and on Windows that is CRLF.
  const pair = text.trim().replace(/,$/, '').trim();
  if (!pair || /[\r\n]/.test(pair)) return null;

  const match = pair.match(JSON_MEMBER);
  if (!match) return null;

  const name = unquote(match[1]);
  if (!name) return null;

  return { name, value: unquote(match[2]) };
}
