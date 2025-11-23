import React from "react";
import { motion } from "framer-motion";
import type { PieceCode } from "@/lib/sfen";

const TILE_SIZE = 130;
const COLS = 8;
const ROWS = 4;
const SPRITE_URL = "/images/pieces.png";

const spriteColumns: Record<string, number> = {
  P: 0,
  L: 1,
  N: 2,
  S: 3,
  G: 4,
  B: 5,
  R: 6,
  K: 7,
  "+P": 0,
  "+L": 1,
  "+N": 2,
  "+S": 3,
  "+B": 5,
  "+R": 6,
  "+G": 4,
  "+K": 7,
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
  const col = spriteColumns[norm] ?? spriteColumns["P"];
  const baseRow = isPromoted ? 1 : 0;
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
