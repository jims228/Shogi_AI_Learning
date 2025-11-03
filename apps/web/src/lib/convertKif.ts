// simple KIF/CSA -> USI converter (beta)
// supports:
// - CSA lines like "+7776FU" or "-3334FU" -> converts to "7g7f" style
// - KIF moves with source in parens: "７六歩(77)" -> converts using (77) as source
// - fullwidth/kanji normalization

const KANJI_TO_DIGIT: Record<string, string> = {
  '一': '1','二':'2','三':'3','四':'4','五':'5','六':'6','七':'7','八':'8','九':'9'
};

function toHalfWidthDigits(s: string) {
  // NFKC often handles this, but be defensive
  return s.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
}

function kanjiRankToDigit(ch: string): string | null {
  return KANJI_TO_DIGIT[ch] ?? null;
}

function rankDigitToLetter(d: string) {
  // map '1'->'a', '2'->'b', ..., '9'->'i'
  const n = Number(d);
  if (!n || n < 1 || n > 9) return 'a';
  return String.fromCharCode('a'.charCodeAt(0) + (n - 1));
}

function fileDigitNormalize(ch: string) {
  // ch could be fullwidth digit or ascii digit
  const hw = toHalfWidthDigits(ch);
  const m = hw.match(/[1-9]/);
  return m ? m[0] : null;
}

export function kifToUsiMoves(raw: string): { moves: string[]; errors: string[] } {
  const out: string[] = [];
  const errors: string[] = [];
  if (!raw) return { moves: [], errors };
  let s = raw.replace(/\r/g, '\n');
  try { s = s.normalize('NFKC'); } catch {}
  // split lines and try to parse CSA first
  const lines = s.split(/\n+/).map(l => l.trim()).filter(Boolean);
  // detect CSA: lines starting with + or - followed by 4 digits
  const csaLines = lines.filter(l => /^[+-]\d{4}/.test(l));
  if (csaLines.length > 0) {
    for (const l of csaLines) {
      const m = l.match(/^[+-](\d)(\d)(\d)(\d)/);
      if (!m) continue;
      const [, fx, fy, tx, ty] = m;
      const from = `${fx}${rankDigitToLetter(fy)}`;
      const to = `${tx}${rankDigitToLetter(ty)}`;
      out.push(`${from}${to}`);
    }
    return { moves: out, errors };
  }

  // otherwise try KIF-like tokens: look for patterns like '７六歩(77)' or '7六歩(77)'
  const tokens: string[] = [];
  for (const line of lines) {
    // remove move numbers like "1:" or "1."
    const clean = line.replace(/^\d+\s*[:\.]/, '').trim();
    // split by spaces
    for (const part of clean.split(/\s+/)) {
      if (part) tokens.push(part);
    }
  }

  for (const tk of tokens) {
    // try to find a paren source like (77)
    const m = tk.match(/([1-9０-９\uFF11-\uFF19\u4E00-\u4E5D]{1,2})[^\u0000-\u007F]*\((\d{2})\)/);
    if (m) {
      const destRaw = m[1];
      const src = m[2];
      // destRaw may be like '７六' or '7六' or kanji
      const d1 = destRaw[0];
      const d2 = destRaw[1];
      // file
      const file = fileDigitNormalize(d1) ?? (KANJI_TO_DIGIT[d1] ?? null);
      // rank
      const rank = kanjiRankToDigit(d2) ?? toHalfWidthDigits(d2);
      if (!file || !rank) {
        errors.push(`変換できない手: ${tk}`);
        continue;
      }
      const fromFile = src[0];
      const fromRank = src[1];
      const from = `${fromFile}${rankDigitToLetter(fromRank)}`;
      const to = `${file}${rankDigitToLetter(rank)}`;
      out.push(`${from}${to}`);
      continue;
    }

    // try simpler form like '▲７六歩' or '△３四歩' -> may lack source; attempt to extract digits
    const m2 = tk.match(/[▲△]?\s*([1-9０-９])([一二三四五六七八九])/);
    if (m2) {
      const fch = toHalfWidthDigits(m2[1]);
      const rch = KANJI_TO_DIGIT[m2[2]];
      if (fch && rch) {
        // without source we cannot form full move; mark error but provide destination-only as fallback
        errors.push(`ソース不明の手を検出（変換には限界があります）: ${tk}`);
        // produce a pseudo-move using same from+to (will likely be rejected server-side)
        const letter = rankDigitToLetter(rch);
        out.push(`${fch}${letter}${fch}${letter}`);
        continue;
      }
    }
  }

  return { moves: out, errors };
}

export default kifToUsiMoves;
