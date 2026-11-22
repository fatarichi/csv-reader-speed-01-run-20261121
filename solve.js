// Fast drop-in for csv-reader 1.0.0 (v2: unquoted scan inlined in the record loop).
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = 0;
  let line = 1;
  if (n > 0 && text.charCodeAt(0) === 0xfeff) pos = 1;

  let recordLine = 1;
  let recordRow = null;

  let fValue = '';
  let fEnded = 2; // 0 comma, 1 line break, 2 end
  let fAdded = 0;

  function error(code) {
    errors.push({ code, line: recordLine, row: recordRow });
  }

  // Unquoted scan used ONLY by readQuoted (junk after a closing quote,
  // and the re-read after an unterminated quote). The record loop inlines
  // the same scan for a plain unquoted field (init '').
  function readUnquoted(init) {
    let start = pos;
    let value = init === '' ? null : init;
    let added = 0;
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 44) {
        fValue = value === null ? text.slice(start, pos) : value + text.slice(start, pos);
        fEnded = 0; fAdded = added + (pos - start); pos += 1; return;
      }
      if (c === 10) {
        fValue = value === null ? text.slice(start, pos) : value + text.slice(start, pos);
        fEnded = 1; fAdded = added + (pos - start); pos += 1; line += 1; return;
      }
      if (c === 13) {
        if (pos + 1 < n && text.charCodeAt(pos + 1) === 10) {
          fValue = value === null ? text.slice(start, pos) : value + text.slice(start, pos);
          fEnded = 1; fAdded = added + (pos - start); pos += 2; line += 1; return;
        }
        error('stray_cr');
        const piece = text.slice(start, pos);
        value = value === null ? piece : value + piece;
        added += piece.length;
        pos += 1; start = pos; continue;
      }
      pos += 1;
    }
    fValue = value === null ? text.slice(start, pos) : value + text.slice(start, pos);
    fEnded = 2; fAdded = added + (pos - start);
  }

  function readQuoted() {
    const open = pos;
    const openLine = line;
    pos += 1;
    let closePos = -1;
    let hasDoubled = false;
    let p = pos;
    while (true) {
      const q = text.indexOf('"', p);
      if (q === -1) break;
      if (q + 1 < n && text.charCodeAt(q + 1) === 34) { hasDoubled = true; p = q + 2; continue; }
      closePos = q; break;
    }
    if (closePos === -1) {
      pos = open + 1; line = openLine;
      error('unterminated_quote');
      readUnquoted('"');
      return;
    }
    let value;
    let hasBreak = false;
    if (!hasDoubled) {
      for (let k = pos; k < closePos; k++) {
        const kc = text.charCodeAt(k);
        if (kc === 10 || kc === 13) { hasBreak = true; break; }
      }
    }
    if (!hasDoubled && !hasBreak) {
      value = text.slice(pos, closePos);
    } else {
      let out = '';
      let i = pos;
      while (i < closePos) {
        const c = text.charCodeAt(i);
        if (c === 34) { out += '"'; i += 2; }
        else if (c === 13) { out += '\n'; line += 1; i += i + 1 < closePos && text.charCodeAt(i + 1) === 10 ? 2 : 1; }
        else if (c === 10) { out += '\n'; line += 1; i += 1; }
        else {
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
    if (pos >= n) { fValue = value; fEnded = 2; return; }
    const c = text.charCodeAt(pos);
    if (c === 44) { pos += 1; fValue = value; fEnded = 0; return; }
    if (c === 10) { pos += 1; line += 1; fValue = value; fEnded = 1; return; }
    if (c === 13 && pos + 1 < n && text.charCodeAt(pos + 1) === 10) { pos += 2; line += 1; fValue = value; fEnded = 1; return; }
    readUnquoted(value);
    if (fAdded > 0) error('quote_junk');
  }

  while (true) {
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) { pos += 1; line += 1; }
      else if (c === 13 && pos + 1 < n && text.charCodeAt(pos + 1) === 10) { pos += 2; line += 1; }
      else break;
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let quoted;
    do {
      quoted = text.charCodeAt(pos) === 34;
      if (quoted) {
        readQuoted();
      } else {
        // Inline unquoted scan (init ''): the hot path, no call overhead.
        let start = pos;
        let value = null;
        let added = 0;
        let done = false;
        while (pos < n && !done) {
          const c = text.charCodeAt(pos);
          if (c === 44) {
            fValue = value === null ? text.slice(start, pos) : value + text.slice(start, pos);
            fEnded = 0; fAdded = added + (pos - start); pos += 1; done = true;
          } else if (c === 10) {
            fValue = value === null ? text.slice(start, pos) : value + text.slice(start, pos);
            fEnded = 1; fAdded = added + (pos - start); pos += 1; line += 1; done = true;
          } else if (c === 13) {
            if (pos + 1 < n && text.charCodeAt(pos + 1) === 10) {
              fValue = value === null ? text.slice(start, pos) : value + text.slice(start, pos);
              fEnded = 1; fAdded = added + (pos - start); pos += 2; line += 1; done = true;
            } else {
              error('stray_cr');
              const piece = text.slice(start, pos);
              value = value === null ? piece : value + piece;
              added += piece.length;
              pos += 1; start = pos;
            }
          } else {
            pos += 1;
          }
        }
        if (!done) {
          fValue = value === null ? text.slice(start, pos) : value + text.slice(start, pos);
          fEnded = 2; fAdded = added + (pos - start);
        }
      }
      fields.push(fValue);
    } while (fEnded === 0);

    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) { columns = fields; continue; }
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
