import React from "react";
import { motion } from "framer-motion";
import type { PieceCode } from "@/lib/sfen";

const TILE_SIZE = 130;
const COLS = 8;
const ROWS = 4;
const SPRITE_URL = "/images/pieces.png";

const spriteMap: Record<string, { row: number; col: number }> = {
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
  "+G": { row: 1, col: 4 },
  "+B": { row: 1, col: 5 },
  "+R": { row: 1, col: 6 },
  "+K": { row: 1, col: 7 },
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
  orientationMode = "sprite",
}) => {
  const pieceSize = size ?? 46;
  const cell = cellSize ?? pieceSize;
  const originX = offsetX ?? 0;
  const originY = offsetY ?? 0;

  const isPromoted = piece.startsWith("+");
  const baseChar = isPromoted ? piece[1] : piece[0];
  const resolvedOwner = owner ?? (baseChar === baseChar.toUpperCase() ? "sente" : "gote");

  const norm = isPromoted ? `+${baseChar.toUpperCase()}` : baseChar.toUpperCase();
  const { row: baseRow, col } = spriteMap[norm] ?? spriteMap["P"];
  const ownerOffset = orientationMode === "sprite" && resolvedOwner === "gote" ? 2 : 0;
  const spriteRow = orientationMode === "sprite" ? baseRow + ownerOffset : baseRow;

  const scale = pieceSize / TILE_SIZE;
  const bgWidth = COLS * TILE_SIZE * scale;
  const bgHeight = ROWS * TILE_SIZE * scale;
  const bgPosX = -col * TILE_SIZE * scale;
  const bgPosY = -spriteRow * TILE_SIZE * scale;

  const left = originX + x * cell + (cell - pieceSize) / 2;
  const top = originY + y * cell + (cell - pieceSize) / 2;

  const transform = orientationMode === "rotate" && resolvedOwner === "gote" ? "rotate(180deg)" : "none";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      style={{
        position: "absolute",
        left,
        top,
        width: pieceSize,
        height: pieceSize,
        backgroundImage: `url(${SPRITE_URL})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${bgWidth}px ${bgHeight}px`,
        backgroundPosition: `${bgPosX}px ${bgPosY}px`,
        transform,
        transformOrigin: "center center",
        pointerEvents: "none",
      }}
    />
  );
};
