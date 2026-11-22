// Fast drop-in for csv-reader 1.0.0 (make.fun's own CSV reader).
// Returns exactly csv-reader 1.0.0's answer for every input, faster.
//
// The reference reads one character at a time and builds every field a
// character at a time. This version instead takes each field with slice()
// (one string per field, not one per character), finds a quoted field's
// closing quote with indexOf(), and only falls back to a character scan
// for the rare broken bits (a stray CR, a quote that never closes, the
// characters after a closing quote, line breaks inside quotes).
//
// Pure: no clock, no randomness, no locale, nothing kept from one call
// to the next. Each case is answered alone.

/** How a field ended: at a comma (0), at a line break (1), at the end (2). */
const COMMA = 0;
const LINE_BREAK = 1;
const END = 2;

/** csv-reader 1.0.0's answer for one case's input. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = 0; // the next character to read
  let line = 1; // the line that character is on
  if (n > 0 && text.charCodeAt(0) === 0xfeff) pos = 1;

  // The record being read: the line it starts on and the index in rows it takes (null: the header).
  let recordLine = 1;
  let recordRow = null;

  // The field just read: its value, how it ended, and how many characters
  // the unquoted scan kept (for quote_junk: the characters after a closing quote).
  let fValue = '';
  let fEnded = END;
  let fAdded = 0;

  function error(code) {
    errors.push({ code, line: recordLine, row: recordRow });
  }

  // Reads unquoted characters onto `init` from pos up to the next comma or
  // line break: a CR not followed by LF is dropped (stray_cr). Sets fValue,
  // fEnded and fAdded (the characters kept after `init`).
  function readUnquoted(init) {
    let start = pos;
    // value is null while no stray CR has been seen: the field is one slice.
    // Once a CR is dropped the field is built from its kept pieces.
    let value = init === '' ? null : init;
    let added = 0;
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 44) {
        // comma
        fValue = value === null ? text.slice(start, pos) : value + text.slice(start, pos);
        fEnded = COMMA;
        fAdded = added + (pos - start);
        pos += 1;
        return;
      }
      if (c === 10) {
        // LF
        fValue = value === null ? text.slice(start, pos) : value + text.slice(start, pos);
        fEnded = LINE_BREAK;
        fAdded = added + (pos - start);
        pos += 1;
        line += 1;
        return;
      }
      if (c === 13) {
        // CR: CRLF is a line break, a lone CR is dropped (stray_cr).
        if (pos + 1 < n && text.charCodeAt(pos + 1) === 10) {
          fValue = value === null ? text.slice(start, pos) : value + text.slice(start, pos);
          fEnded = LINE_BREAK;
          fAdded = added + (pos - start);
          pos += 2;
          line += 1;
          return;
        }
        error('stray_cr');
        const piece = text.slice(start, pos);
        value = value === null ? piece : value + piece;
        added += piece.length;
        pos += 1; // drop the CR
        start = pos;
        continue;
      }
      pos += 1;
    }
    fValue = value === null ? text.slice(start, pos) : value + text.slice(start, pos);
    fEnded = END;
    fAdded = added + (pos - start);
  }

  // Reads the quoted field whose opening quote is at pos. Sets fValue and
  // fEnded. A quote that never closes is a literal character and the text
  // after it is read again as unquoted (unterminated_quote).
  function readQuoted() {
    const open = pos;
    const openLine = line;
    pos += 1;
    // Find the closing quote: the next quote that is not doubled.
    let closePos = -1;
    let hasDoubled = false;
    let p = pos;
    while (true) {
      const q = text.indexOf('"', p);
      if (q === -1) break;
      if (q + 1 < n && text.charCodeAt(q + 1) === 34) {
        hasDoubled = true;
        p = q + 2;
        continue;
      }
      closePos = q;
      break;
    }
    if (closePos === -1) {
      // The quote never closes: it is a literal character, and the text
      // after it is read again as unquoted.
      pos = open + 1;
      line = openLine;
      error('unterminated_quote');
      readUnquoted('"');
      return;
    }
    // The raw content is text[pos .. closePos). If it holds no doubled
    // quote and no line break, it is the value as it stands.
    let value;
    const nl = text.indexOf('\n', pos);
    const cr = text.indexOf('\r', pos);
    if (!hasDoubled && (nl === -1 || nl >= closePos) && (cr === -1 || cr >= closePos)) {
      value = text.slice(pos, closePos);
    } else {
      // Rare broken content: doubled quotes become one quote, each CRLF or
      // lone CR becomes one LF (and counts one line).
      let out = '';
      let i = pos;
      while (i < closePos) {
        const c = text.charCodeAt(i);
        if (c === 34) {
          out += '"';
          i += 2;
        } else if (c === 13) {
          out += '\n';
          line += 1;
          i += i + 1 < closePos && text.charCodeAt(i + 1) === 10 ? 2 : 1;
        } else if (c === 10) {
          out += '\n';
          line += 1;
          i += 1;
        } else {
          // Copy a run of plain characters at once.
          let j = i + 1;
          while (j < closePos) {
            const d = text.charCodeAt(j);
            if (d === 34 || d === 13 || d === 10) break;
            j += 1;
          }
          out += text.slice(i, j);
          i = j;
        }
      }
      value = out;
    }
    pos = closePos + 1;
    if (pos >= n) {
      fValue = value;
      fEnded = END;
      return;
    }
    const c = text.charCodeAt(pos);
    if (c === 44) {
      pos += 1;
      fValue = value;
      fEnded = COMMA;
      return;
    }
    if (c === 10) {
      pos += 1;
      line += 1;
      fValue = value;
      fEnded = LINE_BREAK;
      return;
    }
    if (c === 13 && pos + 1 < n && text.charCodeAt(pos + 1) === 10) {
      pos += 2;
      line += 1;
      fValue = value;
      fEnded = LINE_BREAK;
      return;
    }
    // What follows the closing quote is appended as it stands, up to the
    // next comma or line break.
    readUnquoted(value);
    if (fAdded > 0) error('quote_junk');
  }

  while (true) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && pos + 1 < n && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let quoted;
    do {
      quoted = text.charCodeAt(pos) === 34;
      if (quoted) readQuoted();
      else readUnquoted('');
      fields.push(fValue);
    } while (fEnded === COMMA);

    // A line that held only stray CRs is left with no characters: no record (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
