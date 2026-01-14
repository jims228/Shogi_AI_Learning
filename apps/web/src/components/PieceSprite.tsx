import React from "react";
import { motion } from "framer-motion";
import type { PieceCode } from "@/lib/sfen";

const TILE_SIZE = 130;
const COLS = 8;
const ROWS = 4;
const SPRITE_URL = "/images/pieces.png";

// pieces.png layout (130px tiles, 8 cols × 4 rows)
//   row 0: viewer-side unpromoted   [P, L, N, S, G, B, R, K]
//   row 1: viewer-side promoted     [+P, +L, +N, +S, (blank), +B, +R, (blank)]
//   row 2: opponent-side unpromoted [same order]
//   row 3: opponent-side promoted   [same order]
// Rows 2/3 mirror rows 0/1, but are drawn as the far-side player.
const spriteMap: Record<string, { row: 0 | 1; col: number }> = {
  P: { row: 0, col: 0 },
  L: { row: 0, col: 1 },
  N: { row: 0, col: 2 },
  S: { row: 0, col: 3 },
  G: { row: 0, col: 4 },
  B: { row: 0, col: 5 },
  R: { row: 0, col: 6 },
  K: { row: 0, col: 7 },
  "+P": { row: 1, col: 0 },
  "+L": { row: 1, col: 1 },
  "+N": { row: 1, col: 2 },
  "+S": { row: 1, col: 3 },
  "+B": { row: 1, col: 5 },
  "+R": { row: 1, col: 6 },
};

const PLAYER_ROW_OFFSET: Record<"player" | "opponent", 0 | 2> = {
  player: 0,
  opponent: 2,
};

export type OrientationMode = "rotate" | "sprite";

interface PieceSpriteProps {
  piece: PieceCode;
  x: number;
  y: number;
  size?: number;        // actual sprite size
  cellSize?: number;    // board cell size
  offsetX?: number;     // board left offset
  offsetY?: number;     // board top offset
  owner?: "sente" | "gote";
  orientationMode?: OrientationMode;
  viewerSide?: "sente" | "gote";
  className?: string;
  style?: React.CSSProperties;
  /** mobile-only flicker hardening hook (data attribute) */
  dataShogiPiece?: string;
}

export const PieceSprite: React.FC<PieceSpriteProps> = ({
  piece,
  x,
  y,
  size,
  cellSize,
  offsetX = 0,
  offsetY = 0,
  owner,
  orientationMode: orientationModeProp = "sprite",
  viewerSide = "sente",
  className,
  style,
  dataShogiPiece,
}) => {
  const pieceSize = size ?? 46;
  const cell = cellSize ?? pieceSize;
  const originX = offsetX ?? 0;
  const originY = offsetY ?? 0;

  const isPromoted = piece.startsWith("+");
  const baseChar = isPromoted ? piece[1] : piece[0];
  const resolvedOwner = owner ?? (baseChar === baseChar.toUpperCase() ? "sente" : "gote");
  const isViewerPiece = resolvedOwner === viewerSide;
  const orientationMode = orientationModeProp;

  const norm = isPromoted ? `+${baseChar.toUpperCase()}` : baseChar.toUpperCase();
  const fallbackKey = baseChar.toUpperCase();
  const { row: baseRow, col } = spriteMap[norm] ?? spriteMap[fallbackKey] ?? spriteMap["P"];
  const rowOffsetKey = orientationMode === "sprite" ? (isViewerPiece ? "player" : "opponent") : "player";
  const spriteRow = baseRow + PLAYER_ROW_OFFSET[rowOffsetKey];

  const scale = pieceSize / TILE_SIZE;
  const bgWidth = COLS * TILE_SIZE * scale;
  const bgHeight = ROWS * TILE_SIZE * scale;
  const bgPosX = -col * TILE_SIZE * scale;
  const bgPosY = -spriteRow * TILE_SIZE * scale;

  const left = originX + x * cell + (cell - pieceSize) / 2;
  const top = originY + y * cell + (cell - pieceSize) / 2;

  const shouldRotate = orientationMode === "rotate" && !isViewerPiece;
  const baseTransform = shouldRotate ? " rotate(180deg)" : "";

  return (
    <motion.div
      data-shogi-piece={dataShogiPiece}
      // Disable mount animation to prevent brief "all pieces disappear" flicker on Android WebView.
      initial={false}
      className={className}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: pieceSize,
        height: pieceSize,
        backgroundImage: `url(${SPRITE_URL})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${bgWidth}px ${bgHeight}px`,
        backgroundPosition: `${bgPosX}px ${bgPosY}px`,
        pointerEvents: "none",
        transform: `translate3d(${left}px, ${top}px, 0)${baseTransform}`,
        transformOrigin: "50% 50%",
        ...style,
      }}
    />
  );
};
