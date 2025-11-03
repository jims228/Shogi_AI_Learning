// apps/web/src/lib/convertKif.ts
// 日本語KIF/CSA → USI（beta）変換

import { BoardTracker, usiToSquare, squareToUsi, PieceType } from "./boardTracker";

const kanjiNum: Record<string, string> = {
  "一": "1", "二": "2", "三": "3", "四": "4", "五": "5",
  "六": "6", "七": "7", "八": "8", "九": "9"
};
const pieceMap: Record<string, PieceType> = {
  "歩": "P", "香": "L", "桂": "N", "銀": "S",
  "金": "G", "角": "B", "飛": "R", "玉": "K", "王": "K"
};
const NUM_TO_ALPHA: Record<number, string> = {
  1: "a", 2: "b", 3: "c", 4: "d", 5: "e",
  6: "f", 7: "g", 8: "h", 9: "i"
};

/** KIFまたはCSAテキストをUSI手配列に変換する */
export function kifToUsiMoves(text: string): string[] {
  const moves: string[] = [];
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  // 局面追跡用のヘルパーを初期化
  const tracker = new BoardTracker();
  tracker.setInitialPosition();
  let isBlackTurn = true; // 先手番から開始

  for (const line of lines) {
    // 例: +7776FU（CSA）
    if (/^[\+\-]\d{4}[A-Z]{2}/.test(line)) {
      const move = line.slice(1, 5);
      const from = move.slice(0, 2);
      const to = move.slice(2, 4);
      // CSA形式（数字のみ）からUSI形式（数字+アルファベット）に変換
      const fromFile = from[0];
      const fromRank = NUM_TO_ALPHA[Number(from[1])];
      const toFile = to[0];
      const toRank = NUM_TO_ALPHA[Number(to[1])];
      const usiMove = `${fromFile}${fromRank}${toFile}${toRank}`;
      moves.push(usiMove);

      // 局面を進める
      tracker.makeMove(
        usiToSquare(`${fromFile}${fromRank}`),
        usiToSquare(`${toFile}${toRank}`)
      );
      continue;
    }

    // 例: ▲７六歩(77) / △３四歩(33)
    const kifMatch = /[▲△]?[ \t]*([1-9一二三四五六七八九])([1-9一二三四五六七八九])(.+?)\((\d)(\d)\)/.exec(line);
    if (kifMatch) {
      const [, col, row, piece, fromCol, fromRow] = kifMatch;
      // 漢数字を数字に変換
      const x = Object.keys(kanjiNum).includes(col) ? kanjiNum[col] : col;
      const y = Object.keys(kanjiNum).includes(row) ? kanjiNum[row] : row;
      
      // USI形式の座標に変換
      const fromUsi = `${fromCol}${NUM_TO_ALPHA[Number(fromRow)]}`;
      const toUsi = `${x}${NUM_TO_ALPHA[Number(y)]}`;
      
      // 成りの判定
      const isPromotion = piece.includes("成") && !piece.includes("不成");
      const usiMove = `${fromUsi}${toUsi}${isPromotion ? "+" : ""}`;
      moves.push(usiMove);

      // 局面を進める
      tracker.makeMove(
        usiToSquare(fromCol + String.fromCharCode("a".charCodeAt(0) + Number(fromRow) - 1)),
        usiToSquare(x + String.fromCharCode("a".charCodeAt(0) + Number(y) - 1))
      );
      continue;
    }

    // 例: ▲７六歩 / △３四歩（ソース座標無し）
    const shortKif = /[▲△]?[ \t]*([1-9一二三四五六七八九])([1-9一二三四五六七八九])(.+?)(?:成|不成)?$/.exec(line);
    if (shortKif) {
      const [, col, row, piece] = shortKif;
      const rawPiece = piece.replace(/[打成不]$/, "");
      const pieceName = pieceMap[rawPiece] || "";
      const x = Object.keys(kanjiNum).includes(col) ? kanjiNum[col] : col;
      const y = Object.keys(kanjiNum).includes(row) ? kanjiNum[row] : row;
      const toUsi = `${x}${NUM_TO_ALPHA[Number(y)]}`;
      
      // 打つ手の場合は特別な処理
      if (piece.endsWith("打")) {
        moves.push(`00${toUsi}`);
        continue;
      }

      // 移動先の座標
      const toSquare = usiToSquare(x + String.fromCharCode("a".charCodeAt(0) + Number(y) - 1));

      // 打つ手かどうかを判定
      if (piece.endsWith("打")) {
        moves.push(`00${x}${y}`);
        continue;
      }

      // 成り・不成の判定
      const isPromotion = piece.endsWith("成");
      const isNoPromotion = piece.endsWith("不成");

      // 発生元の座標を探索（複数候補は優先順位付きでソート済み）
      const sources = tracker.findPotentialSources(
        pieceName,
        toSquare,
        isBlackTurn ? "b" : "w"
      );

      if (sources.length > 0) {
        const fromSquare = sources[0]; // 優先順位の高い候補を使用
        const fromUsi = squareToUsi(fromSquare);
        const isPromotionZone = tracker.canPromote(
          pieceName,
          fromSquare,
          toSquare,
          isBlackTurn ? "b" : "w"
        );

        // 成り・不成の指定がなく、成りゾーンでの移動の場合は暗黙的な不成とみなす
        const shouldPromote = isPromotion || 
          (!isNoPromotion && isPromotionZone && ["P", "L", "N", "S"].includes(pieceName));

        // 移動先の座標を生成
        const toUsi = `${x}${String.fromCharCode("a".charCodeAt(0) + Number(y) - 1)}`;
        const usiMove = `${fromUsi}${toUsi}${shouldPromote ? "+" : ""}`;
        moves.push(usiMove);

        // 局面を進める
        tracker.makeMove(fromSquare, toSquare, shouldPromote);
      } else {
        // 候補が見つからない場合は打つ手とみなす（エラー処理の改善が必要）
        moves.push(`00${x}${y}`);
      }

      isBlackTurn = !isBlackTurn;
      continue;
    }
  }
  return moves;
}

export default kifToUsiMoves;
