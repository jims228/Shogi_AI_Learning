// src/lib/sfen.ts
export type Side = "black" | "white";
export type PieceBase = "P"|"L"|"N"|"S"|"G"|"B"|"R"|"K";
export type PieceCode = PieceBase | `+${PieceBase}` | Lowercase<PieceBase> | `+${Lowercase<PieceBase>}`;

export type Placed = { piece: PieceCode; x: number; y: number };

const STARTPOS_SFEN = "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL";

// SFENの1段を配列に（左→右＝9筋→1筋の順）
function expandRow(row: string): (PieceCode|null)[] {
  const out: (PieceCode|null)[] = [];
  for (let i=0;i<row.length;i++){
    const ch = row[i];
    if (/\d/.test(ch)) {
      const n = Number(ch);
      for (let k=0;k<n;k++) out.push(null);
    } else if (ch === '+') {
      // プロモーションは +X の2文字
      const next = row[++i];
      out.push( ("+" + next) as PieceCode );
    } else {
      out.push(ch as PieceCode);
    }
  }
  return out;
}

/** 盤面部分のSFEN（例: "lnsg.../..."）→ Placed[] */
export function parseBoardSFEN(board: string): Placed[] {
  const ranks = board.split('/');
  if (ranks.length !== 9) throw new Error("Invalid SFEN board part");
  // SFENは上段(1段目=a)から順。y=0が上
  const pieces: Placed[] = [];
  ranks.forEach((row, y) => {
    const cells = expandRow(row);
    if (cells.length !== 9) throw new Error("Invalid SFEN row width");
    cells.forEach((pc, x) => {
      if (pc) pieces.push({ piece: pc, x, y });
    });
  });
  return pieces;
}

/** "startpos" または "sfen <board> ..." を受け取って盤面Placed[]を返す */
export function sfenToPlaced(input: string): Placed[] {
  if (input.trim() === "startpos") {
    return parseBoardSFEN(STARTPOS_SFEN);
  }
  // 例: "sfen <board> b - 1" or "sfen <board> w - 1 moves ..."
  const m = input.trim().match(/^sfen\s+([^ ]+)\s/i);
  if (!m) throw new Error("Unsupported SFEN input");
  return parseBoardSFEN(m[1]);
}

/** USI座標 "7g7f" → {from:{x,y}, to:{x,y}}（x:0..8 左→右, y:0..8 上→下） */
export function usiMoveToCoords(usi: string): { from: {x:number;y:number}, to:{x:number;y:number} } | null {
  // drop（例 "P*7f"）は今回は未対応→null返却
  if (usi.includes("*") || usi.length < 4) return null;
  const file = (d:string) => 9 - Number(d); // "9..1" → 0..8
  const rank = (c:string) => c.charCodeAt(0) - "a".charCodeAt(0); // 'a'..'i' → 0..8 (上→下)

  const fx = file(usi[0]), fy = rank(usi[1]);
  const tx = file(usi[2]), ty = rank(usi[3]);
  if ([fx,fy,tx,ty].some(v => Number.isNaN(v) || v<0 || v>8)) return null;
  return { from:{x:fx,y:fy}, to:{x:tx,y:ty} };
}
