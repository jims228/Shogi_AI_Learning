// src/lib/usi.ts
export function usiToMoves(usi: string): string[] {
  const trimmed = usi.trim();
  
  // "startpos moves 7g7f 3c3d 2g2f" の形式
  const movesMatch = trimmed.match(/(?:startpos|sfen[^m]*?)\s+moves\s+(.+)/i);
  if (movesMatch) {
    return movesMatch[1].trim().split(/\s+/).filter(Boolean);
  }
  
  // "startpos" のみの場合は手の履歴なし
  if (trimmed === "startpos") {
    return [];
  }
  
  // "sfen ... b - 1" のような形式で moves がない場合
  if (trimmed.startsWith("sfen") && !trimmed.includes("moves")) {
    return [];
  }
  
  // その他の形式は空配列
  return [];
}