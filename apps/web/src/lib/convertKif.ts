// apps/web/src/lib/convertKif.ts
// 日本語KIF/CSA → USI（beta）変換

const kanjiNum: Record<string, string> = {
  "一": "1", "二": "2", "三": "3", "四": "4", "五": "5",
  "六": "6", "七": "7", "八": "8", "九": "9"
};
const pieceMap: Record<string, string> = {
  "歩": "FU", "香": "KY", "桂": "KE", "銀": "GI",
  "金": "KI", "角": "KA", "飛": "HI", "玉": "OU", "王": "OU"
};

/** KIFまたはCSAテキストをUSI手配列に変換する */
export function kifToUsiMoves(text: string): string[] {
  const moves: string[] = [];
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    // 例: +7776FU（CSA）
    if (/^[\+\-]\d{4}[A-Z]{2}/.test(line)) {
      const move = line.slice(1, 5);
      const from = move.slice(0, 2);
      const to = move.slice(2, 4);
      moves.push(from + to);
      continue;
    }

    // 例: ▲７六歩(77) / △３四歩(33)
    const kifMatch = /[▲△]?[ \t]*([1-9一二三四五六七八九])([1-9一二三四五六七八九])(.+?)\((\d)(\d)\)/.exec(line);
    if (kifMatch) {
      const [, col, row, piece, fromCol, fromRow] = kifMatch;
      const x = Object.keys(kanjiNum).includes(col) ? kanjiNum[col] : col;
      const y = Object.keys(kanjiNum).includes(row) ? kanjiNum[row] : row;
      moves.push(`${fromCol}${fromRow}${x}${y}`);
      continue;
    }

    // 例: ▲７六歩 / △３四歩（ソース座標無し）
    const shortKif = /[▲△]?[ \t]*([1-9一二三四五六七八九])([1-9一二三四五六七八九])(.+)/.exec(line);
    if (shortKif) {
      const [, col, row, piece] = shortKif;
      const x = Object.keys(kanjiNum).includes(col) ? kanjiNum[col] : col;
      const y = Object.keys(kanjiNum).includes(row) ? kanjiNum[row] : row;
      // 仮に from が不明な場合、"00"（打ち）扱いで補完
      moves.push(`00${x}${y}`);
      continue;
    }
  }
  return moves;
}

export default kifToUsiMoves;
