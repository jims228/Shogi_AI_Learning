"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PieceSprite, type OrientationMode } from "./PieceSprite";
import type { PieceBase, PieceCode } from "@/lib/sfen";
import {
  boardToPlaced,
  getPieceOwner,
  promotePiece,
  demotePiece,
  type BoardMatrix,
  type HandsState,
} from "@/lib/board";

export type BoardMode = "view" | "edit";

interface ShogiBoardProps {
  board: BoardMatrix;
  mode?: BoardMode;
  bestmove?: { from: { x: number; y: number }; to: { x: number; y: number } } | null;
  lastMove?: { from: { x: number; y: number }; to: { x: number; y: number } } | null;
  onBoardChange?: (next: BoardMatrix) => void;
  onSquareClick?: (x: number, y: number) => void;
  highlightSquares?: { x: number; y: number }[];
  flipped?: boolean;
  orientationMode?: OrientationMode;
  hands?: HandsState;
}

const FILES = ["９", "８", "７", "６", "５", "４", "３", "２", "１"];
const RANKS = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];
const CELL_SIZE = 50;
const PIECE_SIZE = 44;
const BOARD_PADDING = 20;
const HAND_ORDER: PieceBase[] = ["P", "L", "N", "S", "G", "B", "R", "K"];
const HAND_CELL_SIZE = 40;
const HAND_PIECE_SIZE = 34;

type DragState = {
  piece: PieceCode;
  from: { x: number; y: number };
  pointer: { x: number; y: number };
};
export const ShogiBoard: React.FC<ShogiBoardProps> = ({
  board,
  mode = "view",
  bestmove,
  lastMove,
  onBoardChange,
  onSquareClick,
  highlightSquares,
  flipped = false,
  orientationMode = "sprite",
  hands,
}) => {
  const boardSize = CELL_SIZE * 9;
  const placedPieces = useMemo(() => boardToPlaced(board), [board]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  const getDisplayPos = useCallback((x: number, y: number) => {
    if (flipped) {
      return { x: 8 - x, y: 8 - y };
    }
    return { x, y };
  }, [flipped]);

  const toBoardCoords = useCallback((displayX: number, displayY: number) => {
    if (flipped) {
      return { x: 8 - displayX, y: 8 - displayY };
    }
    return { x: displayX, y: displayY };
  }, [flipped]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>, x: number, y: number) => {
    if (mode === "edit") {
      const piece = board[y]?.[x];
      if (!piece || !onBoardChange) return;
      event.preventDefault();
      event.stopPropagation();
      setDrag({ piece, from: { x, y }, pointer: { x: event.clientX, y: event.clientY } });
      return;
    }
    onSquareClick?.(x, y);
  }, [board, mode, onBoardChange, onSquareClick]);

  const handleDoubleClick = useCallback((x: number, y: number) => {
    if (mode !== "edit" || !onBoardChange) return;
    const piece = board[y]?.[x];
    if (!piece) return;
    const nextBoard = board.map((row) => row.slice());
    nextBoard[y][x] = piece.startsWith("+") ? demotePiece(piece) : promotePiece(piece);
    onBoardChange(nextBoard);
  }, [board, mode, onBoardChange]);

  const finishDrag = useCallback((point?: { x: number; y: number }) => {
    if (!onBoardChange) {
      setDrag(null);
      return;
    }
    setDrag((current) => {
      if (!current) return null;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return null;
      const pointer = point ?? current.pointer;
      const relX = pointer.x - rect.left;
      const relY = pointer.y - rect.top;
      if (relX < 0 || relY < 0 || relX >= rect.width || relY >= rect.height) return null;
      const displayX = Math.min(8, Math.max(0, Math.floor(relX / CELL_SIZE)));
      const displayY = Math.min(8, Math.max(0, Math.floor(relY / CELL_SIZE)));
      const target = toBoardCoords(displayX, displayY);
      if (target.x === current.from.x && target.y === current.from.y) return null;
      const nextBoard = board.map((row) => row.slice());
      nextBoard[current.from.y][current.from.x] = null;
      nextBoard[target.y][target.x] = current.piece;
      onBoardChange(nextBoard);
      return null;
    });
  }, [board, onBoardChange, toBoardCoords]);

  useEffect(() => {
    if (!drag) return;
    const handleMove = (event: PointerEvent) => {
      setDrag((current) => (current ? { ...current, pointer: { x: event.clientX, y: event.clientY } } : current));
    };
    const handleUp = (event: PointerEvent) => {
      finishDrag({ x: event.clientX, y: event.clientY });
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [drag, finishDrag]);

  const dragOverlay = (() => {
    if (!drag || !containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const left = drag.pointer.x - rect.left - CELL_SIZE / 2;
    const top = drag.pointer.y - rect.top - CELL_SIZE / 2;
    return (
      <div className="absolute pointer-events-none z-40" style={{ left, top, width: CELL_SIZE, height: CELL_SIZE }}>
        <PieceSprite
          piece={drag.piece}
          x={0}
          y={0}
          size={PIECE_SIZE}
          cellSize={CELL_SIZE}
          owner={getPieceOwner(drag.piece)}
          orientationMode={orientationMode}
        />
      </div>
    );
  })();

  const isHighlighted = useCallback((x: number, y: number) => {
    if (!highlightSquares) return false;
    return highlightSquares.some((sq) => sq.x === x && sq.y === y);
  }, [highlightSquares]);

  const effectiveLastMove = mode === "edit" ? null : lastMove;

  const boardElement = (
    <div className="relative select-none" style={{ width: boardSize + BOARD_PADDING * 2, height: boardSize + BOARD_PADDING * 2 }}>
      <div
        className="absolute inset-0 rounded-lg shadow-2xl border-4 border-[#5d4037]"
        style={{
          background: "linear-gradient(135deg, #eecfa1 0%, #d4a373 100%)",
          boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.5)",
        }}
      />

      <div
        ref={containerRef}
        className="absolute"
        style={{ left: BOARD_PADDING, top: BOARD_PADDING, width: boardSize, height: boardSize }}
      >
        <svg width={boardSize} height={boardSize} className="absolute inset-0 pointer-events-none z-0">
          {[...Array(10)].map((_, i) => (
            <line
              key={`v-${i}`}
              x1={i * CELL_SIZE}
              y1={0}
              x2={i * CELL_SIZE}
              y2={boardSize}
              stroke="#5d4037"
              strokeWidth={i === 0 || i === 9 ? 2 : 1}
            />
          ))}
          {[...Array(10)].map((_, i) => (
            <line
              key={`h-${i}`}
              x1={0}
              y1={i * CELL_SIZE}
              x2={boardSize}
              y2={i * CELL_SIZE}
              stroke="#5d4037"
              strokeWidth={i === 0 || i === 9 ? 2 : 1}
            />
          ))}
          {[2, 6].map((y) =>
            [2, 6].map((x) => (
              <circle
                key={`star-${x}-${y}`}
                cx={x * CELL_SIZE + CELL_SIZE / 2}
                cy={y * CELL_SIZE + CELL_SIZE / 2}
                r={3}
                fill="#5d4037"
              />
            )),
          )}
        </svg>

        <div className="absolute inset-0 grid grid-cols-9 grid-rows-9 z-10">
          {[...Array(81)].map((_, index) => {
            const x = index % 9;
            const y = Math.floor(index / 9);
            const display = getDisplayPos(x, y);
            const isLastMoveFrom = effectiveLastMove && effectiveLastMove.from.x === x && effectiveLastMove.from.y === y;
            const isLastMoveTo = effectiveLastMove && effectiveLastMove.to.x === x && effectiveLastMove.to.y === y;
            const isBestMoveFrom = bestmove && bestmove.from.x === x && bestmove.from.y === y;
            const isBestMoveTo = bestmove && bestmove.to.x === x && bestmove.to.y === y;

            return (
              <div
                key={`${x}-${y}`}
                className="relative border border-transparent"
                style={{
                  gridColumnStart: display.x + 1,
                  gridRowStart: display.y + 1,
                  backgroundColor: (() => {
                    if (isLastMoveTo) return "rgba(255, 165, 0, 0.35)";
                    if (isLastMoveFrom) return "rgba(255, 165, 0, 0.15)";
                    if (isBestMoveFrom || isBestMoveTo) return "rgba(16, 185, 129, 0.12)";
                    if (isHighlighted(x, y)) return "rgba(59, 130, 246, 0.18)";
                    return "transparent";
                  })(),
                  cursor: mode === "edit" && board[y]?.[x] ? "grab" : "default",
                }}
                onPointerDown={(event) => handlePointerDown(event, x, y)}
                onDoubleClick={() => handleDoubleClick(x, y)}
              />
            );
          })}
        </div>

        <div className="absolute inset-0 z-20 pointer-events-none">
          {placedPieces.map((piece, idx) => {
            const isDraggingPiece = drag && drag.from.x === piece.x && drag.from.y === piece.y;
            if (isDraggingPiece) return null;
            const display = getDisplayPos(piece.x, piece.y);
            const owner = getPieceOwner(piece.piece);
            return (
              <PieceSprite
                key={`${idx}-${piece.x}-${piece.y}`}
                piece={piece.piece}
                x={display.x}
                y={display.y}
                size={PIECE_SIZE}
                cellSize={CELL_SIZE}
                owner={owner}
                orientationMode={orientationMode}
              />
            );
          })}
        </div>

        {dragOverlay}

        {bestmove && (
          <svg width={boardSize} height={boardSize} className="absolute inset-0 pointer-events-none z-30">
            <Arrow
              x1={getDisplayPos(bestmove.from.x, bestmove.from.y).x * CELL_SIZE + CELL_SIZE / 2}
              y1={getDisplayPos(bestmove.from.x, bestmove.from.y).y * CELL_SIZE + CELL_SIZE / 2}
              x2={getDisplayPos(bestmove.to.x, bestmove.to.y).x * CELL_SIZE + CELL_SIZE / 2}
              y2={getDisplayPos(bestmove.to.x, bestmove.to.y).y * CELL_SIZE + CELL_SIZE / 2}
            />
          </svg>
        )}
      </div>

      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        {FILES.map((fileLabel, index) => {
          const idx = flipped ? 8 - index : index;
          return (
            <div
              key={`file-${index}`}
              className="absolute text-xs font-bold text-[#5d4037]"
              style={{ left: BOARD_PADDING + idx * CELL_SIZE, top: 2, width: CELL_SIZE, textAlign: "center" }}
            >
              {fileLabel}
            </div>
          );
        })}
        {RANKS.map((rankLabel, index) => {
          const idx = flipped ? 8 - index : index;
          return (
            <div
              key={`rank-${index}`}
              className="absolute text-xs font-bold text-[#5d4037]"
              style={{ right: 2, top: BOARD_PADDING + idx * CELL_SIZE, height: CELL_SIZE, lineHeight: `${CELL_SIZE}px` }}
            >
              {rankLabel}
            </div>
          );
        })}
      </div>
    </div>
  );

  if (!hands) {
    return boardElement;
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <HandArea side="w" hands={hands.w} orientationMode={orientationMode} />
      {boardElement}
      <HandArea side="b" hands={hands.b} orientationMode={orientationMode} />
    </div>
  );
};

type HandAreaProps = {
  side: "b" | "w";
  hands?: Partial<Record<PieceBase, number>>;
  orientationMode: OrientationMode;
};

const HandArea: React.FC<HandAreaProps> = ({ side, hands, orientationMode }) => {
  const owner = side === "b" ? "sente" : "gote";
  const items = HAND_ORDER.map((base) => {
    const count = hands?.[base];
    if (!count) return null;
    const piece = (side === "b" ? base : base.toLowerCase()) as PieceCode;
    return (
      <div key={`${side}-${base}`} className="relative" style={{ width: HAND_CELL_SIZE, height: HAND_CELL_SIZE }}>
        <PieceSprite
          piece={piece}
          x={0}
          y={0}
          size={HAND_PIECE_SIZE}
          cellSize={HAND_CELL_SIZE}
          orientationMode={orientationMode}
          owner={owner}
        />
        {count > 1 && (
          <span className="absolute -top-1 -right-1 rounded-full bg-black/80 px-1 text-xs font-semibold text-white">
            {count}
          </span>
        )}
      </div>
    );
  }).filter(Boolean) as React.ReactNode[];

  return (
    <div className="flex items-center justify-center gap-2 min-h-[44px]">
      {items.length ? items : <span className="text-xs text-slate-500">--</span>}
    </div>
  );
};

const Arrow: React.FC<{ x1: number; y1: number; x2: number; y2: number }> = ({ x1, y1, x2, y2 }) => {
  if (x1 === x2 && y1 === y2) return null;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const length = Math.hypot(x2 - x1, y2 - y1);
  const startX = x1 + Math.cos(angle) * 10;
  const startY = y1 + Math.sin(angle) * 10;
  const endX = x1 + Math.cos(angle) * (length - 10);
  const endY = y1 + Math.sin(angle) * (length - 10);

  return (
    <g>
      <line x1={startX} y1={startY} x2={endX} y2={endY} stroke="#22c55e" strokeWidth={4} strokeOpacity={0.6} strokeLinecap="round" />
      <polygon
        points={`${endX},${endY} ${endX - 10 * Math.cos(angle - Math.PI / 6)},${endY - 10 * Math.sin(angle - Math.PI / 6)} ${endX - 10 * Math.cos(angle + Math.PI / 6)},${endY - 10 * Math.sin(angle + Math.PI / 6)}`}
        fill="#22c55e"
        fillOpacity={0.8}
      />
    </g>
  );
};
