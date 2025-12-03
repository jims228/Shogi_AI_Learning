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

export interface ShogiBoardProps {
  board: BoardMatrix;
  mode?: BoardMode;
  bestmove?: { from: { x: number; y: number }; to: { x: number; y: number } } | null;
  lastMove?: { from: { x: number; y: number }; to: { x: number; y: number } } | null;
  onBoardChange?: (next: BoardMatrix) => void;
  onHandsChange?: (next: HandsState) => void;
  onMove?: (move: { from?: { x: number; y: number }; to: { x: number; y: number }; piece: PieceCode; drop?: boolean }) => void;
  onSquareClick?: (x: number, y: number) => void;
  highlightSquares?: { x: number; y: number }[];
  flipped?: boolean; 
  orientation?: "sente" | "gote";
  orientationMode?: OrientationMode;
  hands?: HandsState;
  autoPromote?: boolean;
  showPromotionZone?: boolean;
}

const CELL_SIZE = 50;
const PIECE_SIZE = 44;
const HAND_ORDER: PieceBase[] = ["P", "L", "N", "S", "G", "B", "R", "K"];
const HAND_CELL_SIZE = 40;
const HAND_PIECE_SIZE = 34;
const HOSHI_POINTS = [
  { file: 2, rank: 2 }, { file: 5, rank: 2 }, { file: 8, rank: 2 },
  { file: 2, rank: 5 }, { file: 5, rank: 5 }, { file: 8, rank: 5 },
  { file: 2, rank: 8 }, { file: 5, rank: 8 }, { file: 8, rank: 8 },
];

type Square = { x: number; y: number };
type SelectedHand = { base: PieceBase; side: "b" | "w" } | null;
type PendingMove = {
    sourceSquare: Square;
    targetSquare: Square;
    piece: PieceCode;
};

const FILE_LABELS_SENTE = ["9", "8", "7", "6", "5", "4", "3", "2", "1"];
const FILE_LABELS_GOTE = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
const RANK_LABELS_SENTE = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];
const RANK_LABELS_GOTE = ["九", "八", "七", "六", "五", "四", "三", "二", "一"];
const LABEL_GAP = 26;
const TOUCH_DOUBLE_TAP_MS = 320;

export const ShogiBoard: React.FC<ShogiBoardProps> = ({
  board,
  mode = "view",
  bestmove,
  lastMove,
  onBoardChange,
  onHandsChange,
  onMove,
  onSquareClick,
  highlightSquares,
  flipped = false,
  orientation = undefined,
  orientationMode = "sprite",
  hands,
  autoPromote = false, 
  showPromotionZone = false, 
}) => {
  const boardSize = CELL_SIZE * 9;
  const placedPieces = useMemo(() => boardToPlaced(board), [board]);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchTapRef = useRef<{ square: Square; timestamp: number } | null>(null);
  
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [selectedHand, setSelectedHand] = useState<SelectedHand>(null);
  
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);

  const viewerOrientation: "sente" | "gote" = orientation ?? (flipped ? "gote" : "sente");
  const isGoteView = viewerOrientation === "gote";
  const canEdit = mode === "edit" && Boolean(onBoardChange);

  useEffect(() => {
    if (!canEdit) {
      setSelectedSquare(null);
      setSelectedHand(null);
      setPendingMove(null);
    }
  }, [canEdit]);

  const getDisplayPos = useCallback((x: number, y: number) => {
    return isGoteView ? { x: 8 - x, y: 8 - y } : { x, y };
  }, [isGoteView]);

  const isHighlighted = useCallback((x: number, y: number) => {
    return highlightSquares?.some((sq) => sq.x === x && sq.y === y) ?? false;
  }, [highlightSquares]);

  const isPromotionZone = useCallback((y: number) => {
    return y <= 2;
  }, []);

  const canPromotePiece = (piece: string) => {
      const base = piece.toUpperCase().replace("+", "");
      return ["P", "L", "N", "S", "B", "R"].includes(base) && !piece.startsWith("+");
  };

  const isTouchDoubleTap = useCallback((square: Square) => {
    const now = performance.now();
    const previous = touchTapRef.current;
    if (previous && now - previous.timestamp < TOUCH_DOUBLE_TAP_MS && previous.square.x === square.x && previous.square.y === square.y) {
      touchTapRef.current = null;
      return true;
    }
    touchTapRef.current = { square, timestamp: now };
    return false;
  }, []);

  // ★追加: 音を鳴らす関数
  const playPieceSound = useCallback(() => {
    try {
        const audio = new Audio("/sounds/koma.mp3");
        audio.volume = 0.6; // 音量調整 (0.0 ~ 1.0)
        audio.currentTime = 0;
        audio.play().catch(e => console.log("Audio play blocked", e));
    } catch (e) {
        // エラーは無視（ファイルがない場合など）
    }
  }, []);

  const handleHandClick = useCallback((base: PieceBase, side: "b" | "w") => {
    if (!canEdit) return;
    if (selectedHand && selectedHand.base === base && selectedHand.side === side) {
      setSelectedHand(null);
    } else {
      setSelectedHand({ base, side });
      setSelectedSquare(null);
    }
  }, [canEdit, selectedHand]);

  const executeMove = useCallback((source: Square, target: Square, pieceCode: PieceCode, isDrop: boolean) => {
      if (!onBoardChange) return;

      const nextBoard = board.map(row => row.slice());
      
      if (isDrop && selectedHand && hands && onHandsChange) {
          const nextHands = { b: { ...hands.b }, w: { ...hands.w } };
          const count = nextHands[selectedHand.side][selectedHand.base] || 0;
          if (count > 0) {
              nextHands[selectedHand.side][selectedHand.base] = count - 1;
              if (nextHands[selectedHand.side][selectedHand.base] === 0) delete nextHands[selectedHand.side][selectedHand.base];
              onHandsChange(nextHands);
          }
      } else {
          nextBoard[source.y][source.x] = null;
      }

      const targetPiece = board[target.y][target.x];
      if (!isDrop && targetPiece && hands && onHandsChange) {
          const nextHands = { b: { ...hands.b }, w: { ...hands.w } };
          const sourcePieceObj = board[source.y][source.x];
          if (sourcePieceObj) {
            const capturedBase = targetPiece.replace("+", "").toUpperCase() as PieceBase;
            const capturerSide = getPieceOwner(sourcePieceObj) === "sente" ? "b" : "w";
            nextHands[capturerSide][capturedBase] = (nextHands[capturerSide][capturedBase] || 0) + 1;
            onHandsChange(nextHands);
          }
      }

      nextBoard[target.y][target.x] = pieceCode;
      
      onBoardChange(nextBoard);
      
      // ★追加: ここで音を鳴らす
      playPieceSound();

      onMove?.({ from: isDrop ? undefined : source, to: target, piece: pieceCode, drop: isDrop });
      
      setSelectedSquare(null);
      setSelectedHand(null);
      setPendingMove(null);
  }, [board, hands, onBoardChange, onHandsChange, onMove, selectedHand, playPieceSound]);


  const attemptAction = useCallback(
    (target: Square) => {
      if (!onBoardChange) return false;

      // ケース1: 持ち駒を打つ
      if (selectedHand) {
        if (board[target.y][target.x]) return false;
        const pieceCode = (selectedHand.side === "b" ? selectedHand.base : selectedHand.base.toLowerCase()) as PieceCode;
        executeMove({x: -1, y: -1}, target, pieceCode, true);
        return true;
      }

      // ケース2: 盤上の駒を移動する
      if (selectedSquare) {
        if (selectedSquare.x === target.x && selectedSquare.y === target.y) return false;
        
        const sourcePiece = board[selectedSquare.y]?.[selectedSquare.x];
        if (!sourcePiece) {
          setSelectedSquare(null);
          return false;
        }

        const targetPiece = board[target.y][target.x];
        if (targetPiece && getPieceOwner(targetPiece) === getPieceOwner(sourcePiece)) {
            return false;
        }

        const owner = getPieceOwner(sourcePiece);
        const isSente = owner === "sente";
        const isZone = isSente 
            ? (target.y <= 2 || selectedSquare.y <= 2)
            : (target.y >= 6 || selectedSquare.y >= 6);

        if (isZone && canPromotePiece(sourcePiece)) {
            if (autoPromote) {
                // Auto promote if entering zone (simplified)
                executeMove(selectedSquare, target, promotePiece(sourcePiece) as PieceCode, false);
            } else {
                setPendingMove({
                    sourceSquare: selectedSquare,
                    targetSquare: target,
                    piece: sourcePiece
                });
            }
            return true;
        }

        executeMove(selectedSquare, target, sourcePiece, false);
        return true;
      }

      return false;
    },
    [board, hands, onBoardChange, onHandsChange, selectedHand, selectedSquare, autoPromote, isPromotionZone, executeMove],
  );

  const togglePromotionAt = useCallback(
    (square: Square) => {
      if (!canEdit || !onBoardChange) return;
      const piece = board[square.y]?.[square.x];
      if (!piece) return;
      const nextBoard = board.map((row) => row.slice());
      nextBoard[square.y][square.x] = piece.startsWith("+") ? demotePiece(piece) : promotePiece(piece);
      onBoardChange(nextBoard);
      
      // ★追加: 成り/不成の変更時にも音を鳴らす
      playPieceSound();

      setSelectedSquare(null);
      setSelectedHand(null);
    },
    [board, canEdit, onBoardChange, playPieceSound],
  );

  const handleEditSquareClick = useCallback(
    (square: Square) => {
      if (!onBoardChange) return;
      if (attemptAction(square)) return;

      const pieceAtTarget = board[square.y]?.[square.x];
      if (pieceAtTarget) {
        setSelectedSquare({ ...square });
        setSelectedHand(null);
      } else {
        setSelectedSquare(null);
      }
    },
    [attemptAction, board, onBoardChange],
  );

  const handleBoardClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
      if (!canEdit) return;
      if (pendingMove) return;

      const rect = event.currentTarget.getBoundingClientRect();
      let clientX, clientY;

      if ('touches' in event) {
         if (event.touches.length > 0) {
            clientX = event.touches[0].clientX;
            clientY = event.touches[0].clientY;
         } else return;
      } else {
         clientX = (event as React.MouseEvent).clientX;
         clientY = (event as React.MouseEvent).clientY;
      }

      const xRel = clientX - rect.left;
      const yRel = clientY - rect.top;
      const rawX = Math.floor(xRel / CELL_SIZE);
      const rawY = Math.floor(yRel / CELL_SIZE);

      if (rawX < 0 || rawX > 8 || rawY < 0 || rawY > 8) return;

      const x = isGoteView ? 8 - rawX : rawX;
      const y = isGoteView ? 8 - rawY : rawY;
      const square = { x, y };

      if ('touches' in event && isTouchDoubleTap(square)) {
        togglePromotionAt(square);
        return;
      }

      handleEditSquareClick(square);
    },
    [canEdit, handleEditSquareClick, isGoteView, pendingMove, isTouchDoubleTap, togglePromotionAt]
  );

  const handleBoardDoubleClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
      if (!canEdit) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const xRel = event.clientX - rect.left;
      const yRel = event.clientY - rect.top;
      const rawX = Math.floor(xRel / CELL_SIZE);
      const rawY = Math.floor(yRel / CELL_SIZE);
      if (rawX < 0 || rawX > 8 || rawY < 0 || rawY > 8) return;
      
      const x = isGoteView ? 8 - rawX : rawX;
      const y = isGoteView ? 8 - rawY : rawY;
      
      togglePromotionAt({ x, y });
  }, [canEdit, isGoteView, togglePromotionAt]);


  const effectiveLastMove = mode === "edit" ? null : lastMove;
  const effectiveBestMove = mode === "edit" ? null : bestmove;

  const boardElement = (
    <div 
      className="relative select-none shrink-0" 
      style={{ width: boardSize, height: boardSize }}
    >
      <div className="absolute inset-0 rounded-xl shadow-2xl border-[6px] border-[#5d4037]"
        style={{ background: "linear-gradient(135deg, #eecfa1 0%, #d4a373 100%)", boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.5)" }} />

      <div ref={containerRef} className="absolute inset-0">
        <svg width={boardSize} height={boardSize} className="absolute inset-0 pointer-events-none z-0">
          {[...Array(10)].map((_, i) => (
            <line key={`v-${i}`} x1={i * CELL_SIZE} y1={0} x2={i * CELL_SIZE} y2={boardSize} stroke="#5d4037" strokeWidth={i === 0 || i === 9 ? 2 : 1} />
          ))}
          {[...Array(10)].map((_, i) => (
            <line key={`h-${i}`} x1={0} y1={i * CELL_SIZE} x2={boardSize} y2={i * CELL_SIZE} stroke="#5d4037" strokeWidth={i === 0 || i === 9 ? 2 : 1} />
          ))}
        </svg>

        <div className="absolute inset-0 pointer-events-none z-[1]">
          {HOSHI_POINTS.map(({ file, rank }) => {
            const display = getDisplayPos(file - 1, rank - 1);
            return (
              <div key={`hoshi-${file}-${rank}`} className="absolute h-1.5 w-1.5 rounded-full bg-amber-900"
                style={{ left: `${((display.x + 0.5) / 9) * 100}%`, top: `${((display.y + 0.5) / 9) * 100}%`, transform: "translate(-50%, -50%)" }} />
            );
          })}
        </div>

        <div className="absolute inset-0 grid grid-cols-9 grid-rows-9 z-[5] pointer-events-none">
          {[...Array(81)].map((_, index) => {
            const x = index % 9;
            const y = Math.floor(index / 9);
            const display = getDisplayPos(x, y);
            const isSelected = selectedSquare && selectedSquare.x === x && selectedSquare.y === y;
            const isZone = showPromotionZone && isPromotionZone(y);

            return (
              <div key={`hl-${x}-${y}`} 
                className={isZone ? "animate-pulse" : ""}
                style={{
                  gridColumnStart: display.x + 1, gridRowStart: display.y + 1,
                  backgroundColor: (() => {
                    if (mode === "edit" && isSelected) return "rgba(251, 191, 36, 0.5)";
                    if (isHighlighted(x, y)) return "rgba(59, 130, 246, 0.18)";
                    if (isZone) return "rgba(239, 68, 68, 0.25)"; 
                    return "transparent";
                  })(),
                }} />
            );
          })}
        </div>
        
        <div className="absolute inset-0 z-10 pointer-events-none">
          {placedPieces.map((piece, idx) => {
            const display = getDisplayPos(piece.x, piece.y);
            return (
              <div key={`${idx}-${piece.x}-${piece.y}`} className="contents">
                <PieceSprite piece={piece.piece} x={display.x} y={display.y} size={PIECE_SIZE} cellSize={CELL_SIZE}
                  owner={getPieceOwner(piece.piece)} orientationMode={orientationMode} viewerSide={viewerOrientation} />
              </div>
            );
          })}
        </div>

        {effectiveBestMove && (
          <svg width={boardSize} height={boardSize} className="absolute inset-0 pointer-events-none z-30">
            <Arrow x1={getDisplayPos(effectiveBestMove.from.x, effectiveBestMove.from.y).x * CELL_SIZE + CELL_SIZE / 2}
              y1={getDisplayPos(effectiveBestMove.from.x, effectiveBestMove.from.y).y * CELL_SIZE + CELL_SIZE / 2}
              x2={getDisplayPos(effectiveBestMove.to.x, effectiveBestMove.to.y).x * CELL_SIZE + CELL_SIZE / 2}
              y2={getDisplayPos(effectiveBestMove.to.x, effectiveBestMove.to.y).y * CELL_SIZE + CELL_SIZE / 2} />
          </svg>
        )}

        <div className="absolute top-0 left-0 z-[100]"
          style={{ width: `${boardSize}px`, height: `${boardSize}px`, backgroundColor: "transparent", cursor: mode === "edit" ? "pointer" : "default", pointerEvents: "auto" }}
          onClick={handleBoardClick}
          onDoubleClick={handleBoardDoubleClick}
        />

        {pendingMove && (
            <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-[1px] rounded-xl animate-in fade-in duration-200">
                <div className="bg-white p-4 rounded-xl shadow-2xl flex gap-4 border border-slate-200 transform scale-110">
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            executeMove(pendingMove.sourceSquare, pendingMove.targetSquare, promotePiece(pendingMove.piece) as PieceCode, false);
                        }}
                        className="flex flex-col items-center gap-2 p-3 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors border border-amber-300 min-w-[80px]"
                    >
                        <div className="scale-125"><PieceSprite piece={promotePiece(pendingMove.piece) as PieceCode} x={0} y={0} size={40} cellSize={40} orientationMode="sprite" owner="sente" viewerSide="sente" /></div>
                        <span className="font-bold text-amber-900 text-sm">成る</span>
                    </button>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            executeMove(pendingMove.sourceSquare, pendingMove.targetSquare, pendingMove.piece, false);
                        }}
                        className="flex flex-col items-center gap-2 p-3 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-300 min-w-[80px]"
                    >
                        <div className="scale-125"><PieceSprite piece={pendingMove.piece} x={0} y={0} size={40} cellSize={40} orientationMode="sprite" owner="sente" viewerSide="sente" /></div>
                        <span className="font-bold text-slate-700 text-sm">成らず</span>
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );

  const topFileLabels = viewerOrientation === "sente" ? FILE_LABELS_SENTE : FILE_LABELS_GOTE;
  const rightRankLabels = viewerOrientation === "sente" ? RANK_LABELS_SENTE : RANK_LABELS_GOTE;

  const boardWithLabels = (
    <div className="grid select-none" style={{ gridTemplateColumns: `repeat(9, ${CELL_SIZE}px) ${LABEL_GAP}px`, gridTemplateRows: `${LABEL_GAP}px repeat(9, ${CELL_SIZE}px)`, gap: 0 }}>
      <div style={{ gridColumn: "1 / span 9", gridRow: "2 / span 9" }}>{boardElement}</div>
      {topFileLabels.map((label, index) => (
        <div key={`file-top-${label}-${index}`} className="flex items-center justify-center text-xs font-bold text-[#5d4037]" style={{ gridColumn: index + 1, gridRow: 1 }}>{label}</div>
      ))}
      {rightRankLabels.map((label, index) => (
        <div key={`rank-right-${label}-${index}`} className="flex items-center justify-center text-xs font-bold text-[#5d4037]" style={{ gridColumn: 10, gridRow: index + 2 }}>{label}</div>
      ))}
    </div>
  );

  if (!hands) return boardWithLabels;

  const topHandSide = viewerOrientation === "sente" ? "w" : "b";
  const bottomHandSide = viewerOrientation === "sente" ? "b" : "w";

  return (
    <div className="flex flex-col items-center gap-3">
      <HandArea side={topHandSide} hands={hands[topHandSide]} orientationMode={orientationMode} viewerSide={viewerOrientation} 
        canEdit={canEdit} selectedHand={selectedHand} onHandClick={handleHandClick} />
      {boardWithLabels}
      <HandArea side={bottomHandSide} hands={hands[bottomHandSide]} orientationMode={orientationMode} viewerSide={viewerOrientation}
        canEdit={canEdit} selectedHand={selectedHand} onHandClick={handleHandClick} />
    </div>
  );
};

// HandAreaとArrowコンポーネントはそのまま使用可能
type HandAreaProps = {
  side: "b" | "w";
  hands?: Partial<Record<PieceBase, number>>;
  orientationMode: OrientationMode;
  viewerSide: "sente" | "gote";
  canEdit?: boolean;
  selectedHand?: SelectedHand;
  onHandClick?: (base: PieceBase, side: "b" | "w") => void;
};

const HandArea: React.FC<HandAreaProps> = ({ side, hands, orientationMode, viewerSide, canEdit, selectedHand, onHandClick }) => {
  const owner = side === "b" ? "sente" : "gote";
  const label = owner === "sente" ? "先手の持ち駒" : "後手の持ち駒";
  const items = HAND_ORDER.map((base) => {
    const count = hands?.[base];
    if (!count) return null;
    const piece = (side === "b" ? base : base.toLowerCase()) as PieceCode;
    const isSelected = selectedHand && selectedHand.base === base && selectedHand.side === side;

    return (
      <div 
        key={`${side}-${base}`} 
        className={`relative transition-all rounded-md ${canEdit && isSelected ? "bg-amber-300 shadow-md scale-110" : ""}`}
        style={{ width: HAND_CELL_SIZE, height: HAND_CELL_SIZE, cursor: canEdit ? "pointer" : "default" }}
        onClick={() => canEdit && onHandClick?.(base, side)}
      >
        <PieceSprite piece={piece} x={0} y={0} size={HAND_PIECE_SIZE} cellSize={HAND_CELL_SIZE} orientationMode={orientationMode} owner={owner} viewerSide={viewerSide} />
        {count > 1 && (
          <span className="absolute -top-1 -right-1 rounded-full bg-[#fef1d6] px-1 text-xs font-semibold text-[#2b2b2b] border border-black/10">{count}</span>
        )}
      </div>
    );
  }).filter(Boolean) as React.ReactNode[];

  return (
    <div className="flex flex-col items-center justify-center gap-1 min-h-[60px]">
      <span className="text-xs font-semibold text-[#5d4037]">{label}</span>
      <div className="flex items-center justify-center gap-2">
        {items.length ? items : <span className="text-xs text-slate-500">--</span>}
      </div>
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
      <polygon points={`${endX},${endY} ${endX - 10 * Math.cos(angle - Math.PI / 6)},${endY - 10 * Math.sin(angle - Math.PI / 6)} ${endX - 10 * Math.cos(angle + Math.PI / 6)},${endY - 10 * Math.sin(angle + Math.PI / 6)}`} fill="#22c55e" fillOpacity={0.8} />
    </g>
  );
};