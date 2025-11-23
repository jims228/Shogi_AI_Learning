"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ShogiBoard } from "@/components/ShogiBoard";
import { KifuPlayer } from "@/components/kifu/KifuPlayer";
import { buildBoardTimeline, getStartBoard, type BoardMatrix, type HandsState } from "@/lib/board";
import { usiMoveToCoords } from "@/lib/sfen";
import type { OrientationMode } from "@/components/PieceSprite";

type ReviewTabProps = {
  usi: string;
  orientationMode?: OrientationMode;
};

const DEFAULT_ORIENTATION: OrientationMode = "sprite";

const createEmptyHandsSnapshot = (): HandsState => ({ b: {}, w: {} });

const ReviewTab: React.FC<ReviewTabProps> = ({ usi, orientationMode = DEFAULT_ORIENTATION }) => {
  const [currentPly, setCurrentPly] = useState(0);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedBoard, setEditedBoard] = useState<BoardMatrix | null>(null);

  const timeline = useMemo(() => {
    try {
      return buildBoardTimeline(usi);
    } catch (error) {
      console.warn("Failed to build review timeline", error);
      return { boards: [getStartBoard()], hands: [createEmptyHandsSnapshot()], moves: [] };
    }
  }, [usi]);

  useEffect(() => {
    setCurrentPly(0);
    setEditedBoard(null);
    setIsEditMode(false);
  }, [usi]);

  useEffect(() => {
    setCurrentPly((prev) => {
      const maxIndex = Math.max(timeline.boards.length - 1, 0);
      return Math.min(prev, maxIndex);
    });
  }, [timeline.boards.length]);

  useEffect(() => {
    setEditedBoard(null);
  }, [currentPly]);

  useEffect(() => {
    if (!isEditMode) {
      setEditedBoard(null);
    }
  }, [isEditMode]);

  const handleBoardChange = useCallback((next: BoardMatrix) => {
    setEditedBoard(next);
  }, []);

  const renderBoard = useCallback((ply: number) => {
    if (!timeline.boards.length) return null;
    const clamped = Math.max(0, Math.min(ply, timeline.boards.length - 1));
    const board = timeline.boards[clamped];
    const prevMove = clamped > 0 ? timeline.moves[clamped - 1] : null;
    const lastMove = prevMove ? usiMoveToCoords(prevMove) : null;
    const hands = timeline.hands?.[clamped] ?? createEmptyHandsSnapshot();
    const isActivePly = clamped === currentPly;
    const boardForRender = isActivePly && editedBoard ? editedBoard : board;
    const mode = isEditMode && isActivePly ? "edit" : "view";

    return (
      <ShogiBoard
        key={`${clamped}-${mode}`}
        board={boardForRender}
        hands={hands}
        mode={mode}
        lastMove={lastMove ?? undefined}
        bestmove={null}
        orientationMode={orientationMode}
        onBoardChange={mode === "edit" ? handleBoardChange : undefined}
      />
    );
  }, [timeline.boards, timeline.moves, timeline.hands, orientationMode, currentPly, editedBoard, isEditMode, handleBoardChange]);

  const maxPly = Math.max(timeline.boards.length - 1, 0);

  return (
    <div className="flex h-full w-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">
          手数 {currentPly} / {maxPly}
        </span>
        <button
          type="button"
          onClick={() => setIsEditMode((prev) => !prev)}
          className={`rounded border px-3 py-1 text-sm font-medium transition ${
            isEditMode ? "border-amber-500 bg-amber-50 text-amber-700" : "border-slate-300 bg-white hover:bg-slate-100"
          }`}
        >
          {isEditMode ? "編集モードを終了" : "編集モード"}
        </button>
      </div>
      <KifuPlayer
        moves={timeline.moves}
        currentPly={currentPly}
        onPlyChange={setCurrentPly}
        renderBoard={renderBoard}
      />
    </div>
  );
};

export default ReviewTab;
