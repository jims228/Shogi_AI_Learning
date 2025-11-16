// apps/web/src/lib/convertKif.ts
// 日本語KIF/CSA → USI（beta）変換

// Minimal types inside this file to avoid touching other modules.
export type Color = "b" | "w";
export type PieceType = "P"|"L"|"N"|"S"|"G"|"B"|"R"|"K"|"pB"|"pR"|"pS"|"pN"|"pL"|"pP";
export type Square = `${1|2|3|4|5|6|7|8|9}${"a"|"b"|"c"|"d"|"e"|"f"|"g"|"h"|"i"}`;

const KANJI_NUM: Record<string, string> = {
  "一": "1", "二": "2", "三": "3", "四": "4", "五": "5",
  "六": "6", "七": "7", "八": "8", "九": "9"
};

const NUM_TO_ALPHA: Record<number, string> = {
  1: "a", 2: "b", 3: "c", 4: "d", 5: "e",
  6: "f", 7: "g", 8: "h", 9: "i"
};

const CSA_PROMOTE_CODES = new Set(["TO","NY","NK","NG","UM","RY"]);

// Maintain minimal cross-call state so single-line calls (as done by kifToUsiMoves)
// can still resolve "同" by referring to the previous destination and track turn.
let _lastToGlobal: string | null = null;
let _nextIsBlackGlobal = true;

/** 入力テキストを NFKC 正規化 + 改行/全角数字整形 + 前後trim */
export function normalizeKifInput(src: string): string {
  if (!src) return "";
  // NFKC 正規化（全角数字やスペースを半角化）
  const n = typeof src.normalize === 'function' ? src.normalize('NFKC') : src;
  // 終端の空白と CR を除去して、各行をトリム
  const lines = n.replace(/\r/g, "").split('\n').map(l => l.trim()).filter(Boolean);
  return lines.join('\n');
}

function csaDigitToAlpha(d: string): string {
  const n = Number(d);
  return NUM_TO_ALPHA[n as keyof typeof NUM_TO_ALPHA];
}

/** CSA行（+7776FU, -3334FU, P*7f など）を USI に変換。複数行対応。 */
export function csaToUsiMoves(csa: string): string[] {
  if (!csa) return [];
  const out: string[] = [];
  const lines = csa.replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    // handle drop already in USI-like form: e.g., P*7f
    if (/^[A-Z]\*[1-9][a-i]$/i.test(line)) {
      out.push(line);
      continue;
    }

    // handle standard CSA move like +7776FU or -3334FU
    const m = /^[+-](\d{4})([A-Z]{2})/.exec(line);
    if (m) {
      const coords = m[1];
      const pieceCode = m[2];
      const fromFile = coords[0];
      const fromRankNum = coords[1];
      const toFile = coords[2];
      const toRankNum = coords[3];
      const from = `${fromFile}${csaDigitToAlpha(fromRankNum)}`;
      const to = `${toFile}${csaDigitToAlpha(toRankNum)}`;
      const promote = CSA_PROMOTE_CODES.has(pieceCode) ? '+' : '';
      out.push(`${from}${to}${promote}`);
      continue;
    }

    // ignore other lines silently
  }

  return out;
}

/** KIF長形式(例: ▲７六歩(77), △３三角(22), 同歩(同))のみ確実に USI へ。 */
export function kifLongToUsiMoves(kif: string): string[] {
  if (!kif) return [];
  const lines = normalizeKifInput(kif).split('\n');
  const moves: string[] = [];
  // initialize from global state
  let lastTo: string | null = _lastToGlobal;
  let inMoveSection = false;

  // helpers
  const toAlpha = (digitChar: string) => csaDigitToAlpha(digitChar);
  const toNum = (ch: string) => (KANJI_NUM[ch] || ch);

  for (const raw of lines) {
    const line = raw.trim();
    
    // Detect move section start
    if (/手数----指手/.test(line)) {
      inMoveSection = true;
      continue;
    }
    
    // Stop parsing at game end markers
    if (/まで\d+手で/.test(line)) {
      break;
    }
    
    // Auto-detect move section: if we see a line that looks like a move, start parsing
    if (!inMoveSection && /^\s*\d+\s+[▲△]?[1-9一二三四五六七八九]/.test(line)) {
      inMoveSection = true;
    }
    
    // Only process lines in move section
    if (!inMoveSection) continue;
    
    // Skip time info lines (e.g., "(00:37/00:01:17)")
    if (/^\(\d{2}:\d{2}\/\d{2}:\d{2}:\d{2}\)/.test(line)) continue;
    // Skip lines starting with * (comments)
    if (line.startsWith('*')) continue;
    // Skip lines with only numbers (likely move numbers without moves)
    if (/^\d+$/.test(line)) continue;
    // Skip blank lines
    if (!line) continue;

    // Extract move from line format: "1 ７六歩(77)   (00:00/00:00:00)"
    // The regex captures the move part after the move number
    const moveLineMatch = /^\s*\d+\s+(\S+)/.exec(line);
    if (!moveLineMatch) continue;
    const movePart = moveLineMatch[1];

    // 1) 同～形式 (例: 同歩(76) / △同歩(68)) -> uses lastTo as destination
    const sameRe = /^([▲△])?\s*同\s*([^\(\s]+)?[（(](\d)(\d)[)）]/u;
    const sameMatch = sameRe.exec(movePart);
    if (sameMatch) {
      const [, mark, piecePart, fromCol, fromRow] = sameMatch;
      if (!lastTo) {
        // no previous to -> skip
        continue;
      }
      const from = `${fromCol}${toAlpha(fromRow)}`;
      // determine side: explicit ▲/△ if present, otherwise alternate
      const isBlack = mark === '▲' ? true : (mark === '△' ? false : _nextIsBlackGlobal);
      // promote detection: explicit 成 (and not 不成)
        let promote = /成/.test(movePart) && !/不成/.test(movePart) ? '+' : '';
      if (!promote) {
        // implicit promotion for pawn/lance/knight/silver when entering promotion zone
        // do NOT implicitly promote if 不成 was specified on the line
        if (!/不成/.test(movePart)) {
          const pieceChar = (piecePart || '').trim();
          if (/^[歩香桂銀]/.test(pieceChar)) {
            const toRankNum = Number(lastTo[1]);
            if ((isBlack && toRankNum <= 3) || (!isBlack && toRankNum >= 7)) promote = '+';
          }
        }
      }
      moves.push(`${from}${lastTo}${promote}`);
      // flip turn
      _nextIsBlackGlobal = !isBlack;
      // lastTo unchanged
      continue;
    }

    // 2) 長形式 (例: ▲７六歩(77) )
    const longRe = /^([▲△])?\s*([1-9一二三四五六七八九])([1-9一二三四五六七八九])\s*([^\(\n\r]*?)[（(](\d)(\d)[)）]/u;
    const m = longRe.exec(movePart);
    if (m) {
      const [ , mark, colRaw, rowRaw, piecePart, fromCol, fromRow ] = m;
      const col = toNum(colRaw);
      const row = toNum(rowRaw);
      const from = `${fromCol}${toAlpha(fromRow)}`;
      const to = `${col}${toAlpha(row)}`;
      // determine side
      const isBlack = mark === '▲' ? true : (mark === '△' ? false : _nextIsBlackGlobal);
      // explicit promote
        let promote = /成/.test(movePart) && !/不成/.test(movePart) ? '+' : '';
      if (!promote) {
        // implicit promotion for pawn/lance/knight/silver
        // do NOT implicitly promote if 不成 was specified on the line
        if (!/不成/.test(movePart)) {
          const pieceChar = (piecePart || '').trim();
          if (/^[歩香桂銀]/.test(pieceChar)) {
            const toRankNum = Number(row);
            if ((isBlack && toRankNum <= 3) || (!isBlack && toRankNum >= 7)) promote = '+';
          }
        }
      }
      if (promote === '+') {
        // debug: output where we decide to promote
        // console.error('DBG promote = + for line:', movePart, { from, to });
      }
        moves.push(`${from}${to}${promote}`);
      lastTo = to;
      // flip next side
      _nextIsBlackGlobal = !isBlack;
      continue;
    }

    // otherwise skip silently
  }

  // persist lastTo state for subsequent calls
  _lastToGlobal = lastTo;
  return moves;
}

/** KIF短形式(例: ７六歩, 同金 など)は BoardTracker を"簡易利用"して from を推定(暫定) */
export function kifShortToUsiMoves(kif: string): string[] {
  // Minimal stub: short form without from coordinates is incomplete, so return empty
  // This prevents generation of invalid moves like "0037" or "??to"
  if (!kif) return [];
  // Short form moves require full board state tracking to determine source square
  // Since we don't have that here, we don't attempt to parse short form
  return [];
}

/** 入口: KIF/CSA/USI混在テキストを受けて、USI配列を返す(startpos moves に連結する想定) */
export function kifToUsiMoves(raw: string): string[] {
  if (!raw) return [];
  const src = normalizeKifInput(raw);
  const lines = src.split('\n');
  const out: string[] = [];

  for (const line of lines) {
    if (/^[+-]\d{4}[A-Z]{2}/.test(line) || /^[+-]/.test(line)) {
      // treat as CSA block
      out.push(...csaToUsiMoves(line));
      continue;
    }

    if (/\(\d{2}\)/.test(line) || /\(\d \d\)/.test(line)) {
      out.push(...kifLongToUsiMoves(line));
      continue;
    }

    // fallback short form
    out.push(...kifShortToUsiMoves(line));
  }

  // Filter out any tokens that are purely numeric (e.g., "0037", "0022")
  // These are likely time data or move numbers that slipped through
  const filtered = out.filter(move => !/^\d+$/.test(move));
  
  return filtered;
}

export default kifToUsiMoves;
