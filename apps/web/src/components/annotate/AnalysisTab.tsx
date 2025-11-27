"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ShogiBoard, type BoardMode } from "@/components/ShogiBoard";
import { PieceSprite, type OrientationMode } from "@/components/PieceSprite";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { showToast } from "@/components/ui/toast";
import {
  boardToPlaced,
  buildBoardTimeline,
  buildPositionFromUsi,
  cloneBoard,
  getStartBoard,
  type BoardMatrix,
  type HandsState,
  type Side,
} from "@/lib/board";
import { toStartposUSI } from "@/lib/ingest";
import { formatUsiMoveJapanese, usiMoveToCoords, type PieceBase, type PieceCode } from "@/lib/sfen";
import { buildUsiPositionForPly } from "@/lib/usi";
import type { EngineAnalyzeResponse, EngineMultipvItem } from "@/lib/annotateHook";
import {
  AnalysisCache,
  buildMoveImpacts,
  getPrimaryEvalScore,
} from "@/lib/analysisUtils";
import { FileText, RotateCcw, Search, Play } from "lucide-react";
import MoveListPanel from "@/components/annotate/MoveListPanel";
import MoveQualityPanel from "@/components/annotate/MoveQualityPanel";
import EvalGraph from "@/components/annotate/EvalGraph";
import layoutStyles from "./AnalysisLayout.module.css";

const API_BASE =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_ENGINE_URL ||
  process.env.ENGINE_URL ||
  "http://localhost:8787";

type AnalysisTabProps = {
  usi: string;
  setUsi: (next: string) => void;
  orientationMode?: OrientationMode;
};

type BatchAnalysisResponsePayload = {
  analyses?: Record<string, EngineAnalyzeResponse>;
  results?: Record<string, EngineAnalyzeResponse>;
  elapsed_ms?: number;
  analyzed_plies?: number;
};

// --- Helper: 盤面からSFEN文字列を生成 ---
const boardToSfen = (board: BoardMatrix, hands: HandsState, turn: Side): string => {
  let sfen = "";
  let emptyCount = 0;

  for (let y = 0; y < 9; y++) {
    for (let x = 0; x < 9; x++) {
      const piece = board[y][x];
      if (piece) {
        if (emptyCount > 0) {
          sfen += emptyCount.toString();
          emptyCount = 0;
        }
        sfen += piece;
      } else {
        emptyCount++;
      }
    }
    if (emptyCount > 0) {
      sfen += emptyCount.toString();
      emptyCount = 0;
    }
    if (y < 8) sfen += "/";
  }

  sfen += ` ${turn} `;

  const handOrder: PieceBase[] = ["R", "B", "G", "S", "N", "L", "P"];
  let handStr = "";
  
  handOrder.forEach((p) => {
    const count = hands.b[p] || 0;
    if (count === 1) handStr += p;
    else if (count > 1) handStr += count + p;
  });
  
  handOrder.forEach((p) => {
    const count = hands.w[p] || 0;
    if (count === 1) handStr += p.toLowerCase();
    else if (count > 1) handStr += count + p.toLowerCase();
  });

  if (handStr === "") handStr = "-";
  sfen += handStr;
  sfen += " 1";

  return `sfen ${sfen}`;
};

const flipTurn = (side: Side): Side => (side === "b" ? "w" : "b");

const clampIndex = (index: number, boards: BoardMatrix[]): number => {
  if (!boards.length) return 0;
  return Math.max(0, Math.min(index, boards.length - 1));
};

const formatScoreLabel = (score?: EngineMultipvItem["score"]): string => {
  if (!score) return "?";
  if (score.type === "mate") {
    const mateValue = typeof score.mate === "number" ? score.mate : 0;
    return mateValue === 0 ? "Mate" : `Mate ${mateValue}`;
  }
  const cpValue = typeof score.cp === "number" ? score.cp : 0;
  const prefix = cpValue > 0 ? "+" : "";
  return `${prefix}${cpValue}cp`;
};

const formatDepthLabel = (depth?: number): string | null => {
  if (typeof depth !== "number" || Number.isNaN(depth)) return null;
  return `Depth ${depth}`;
};

const HAND_DISPLAY_ORDER: PieceBase[] = ["P", "L", "N", "S", "G", "B", "R", "K"];

export default function AnalysisTab({ usi, setUsi, orientationMode = "sprite" }: AnalysisTabProps) {
  // 1. State Declarations
  const [currentPly, setCurrentPly] = useState(0);
  const [analysisByPly, setAnalysisByPly] = useState<AnalysisCache>({});
  const eventSourceRef = useRef<EventSource | null>(null);
  const activeStreamPlyRef = useRef<number | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isBatchAnalyzing, setIsBatchAnalyzing] = useState(false);
  const [kifuText, setKifuText] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [boardOrientation, setBoardOrientation] = useState<"sente" | "gote">("sente");

  const [snapshotOverrides, setSnapshotOverrides] = useState<Record<number, BoardMatrix>>({});
  const [handsOverrides, setHandsOverrides] = useState<Record<number, HandsState>>({});
  
  const [editHistory, setEditHistory] = useState<{ board: BoardMatrix; hands: HandsState }[]>([]);

  // 2. Basic Data (Memo)
  const timeline = useMemo(() => {
    try {
      return buildBoardTimeline(usi);
    } catch (error) {
      console.warn("Failed to build analysis timeline", error);
      const emptyHandsSnapshot: HandsState = { b: {}, w: {} };
      return { boards: [getStartBoard()], hands: [emptyHandsSnapshot], moves: [] };
    }
  }, [usi]);

  const parsedPosition = useMemo(() => {
    try {
      return buildPositionFromUsi(usi);
    } catch (error) {
      return { board: getStartBoard(), moves: [], turn: "b" as Side };
    }
  }, [usi]);

  const initialTurn = useMemo(() => {
    const moveCount = parsedPosition.moves.length;
    return moveCount % 2 === 0 ? parsedPosition.turn : flipTurn(parsedPosition.turn);
  }, [parsedPosition.moves.length, parsedPosition.turn]);

  // 変数定義順序の修正: ここで先に定義する
  const moveSequence = timeline.moves;
  const totalMoves = moveSequence.length;
  const maxPly = totalMoves; 

  const timelinePlacedPieces = useMemo(() => {
    if (!timeline.boards.length) {
      return [boardToPlaced(getStartBoard())];
    }
    return timeline.boards.map((board) => boardToPlaced(board));
  }, [timeline.boards]);

  const safeCurrentPly = useMemo(
    () => clampIndex(currentPly, timeline.boards),
    [currentPly, timeline.boards],
  );

  const fallbackHands = useMemo<HandsState>(() => ({ b: {}, w: {} }), []);
  const timelineHands = useMemo<HandsState[]>(() => timeline.hands ?? [], [timeline.hands]);
  
  const baseBoard = timeline.boards[safeCurrentPly] ?? getStartBoard();
  const displayedBoard = snapshotOverrides[safeCurrentPly] ?? baseBoard;
  
  const baseHands = timelineHands[safeCurrentPly] ?? fallbackHands;
  const activeHands = handsOverrides[safeCurrentPly] ?? baseHands;

  const currentPlacedPieces = useMemo(() => boardToPlaced(displayedBoard), [displayedBoard]);
  const currentSideToMove = useMemo(() => {
    let side = initialTurn;
    if (safeCurrentPly % 2 === 1) {
      side = flipTurn(side);
    }
    return side;
  }, [safeCurrentPly, initialTurn]);

  const currentAnalysis = analysisByPly[safeCurrentPly];
  const hasCurrentAnalysis = Boolean(currentAnalysis);
  
  const prevMove = safeCurrentPly > 0 ? moveSequence[safeCurrentPly - 1] : null;
  const lastMoveCoords = !isEditMode && prevMove ? usiMoveToCoords(prevMove) : null;
  const bestmoveCoords = !isEditMode && currentAnalysis?.bestmove ? usiMoveToCoords(currentAnalysis.bestmove) : null;
  
  const currentMoveUsi = safeCurrentPly === 0 ? null : moveSequence[safeCurrentPly - 1] ?? null;
  const currentMoveLabel = currentMoveUsi
    ? formatUsiMoveJapanese(currentMoveUsi, currentPlacedPieces, flipTurn(currentSideToMove))
    : "開始局面";

  // 3. Callbacks
  const stopEngineAnalysis = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    activeStreamPlyRef.current = null;
    setIsStreaming(false);
  }, []);

  const startEngineAnalysis = useCallback(
    (command: string, ply: number) => {
      if (!command) return;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      const url = `${API_BASE}/api/analysis/stream?position=${encodeURIComponent(command)}`;
      const es = new EventSource(url);
      eventSourceRef.current = es;
      activeStreamPlyRef.current = ply;
      setIsStreaming(true);

      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as EngineAnalyzeResponse;
          setAnalysisByPly((prev) => {
            const previous = prev[ply];
            const merged: EngineAnalyzeResponse = {
              ...(previous ?? {}),
              ...payload,
              multipv: payload.multipv?.length ? payload.multipv : previous?.multipv,
              bestmove: payload.bestmove ?? previous?.bestmove,
            };
            return { ...prev, [ply]: merged };
          });
        } catch (error) {
          console.warn("Failed to parse engine stream", error);
        }
      };

      es.onerror = (error) => {
        console.warn("Engine analysis stream error", error);
        stopEngineAnalysis();
      };
    },
    [stopEngineAnalysis],
  );

  const requestAnalysisForPly = useCallback(
    (ply: number, options?: { force?: boolean }) => {
      if (options?.force) {
        setAnalysisByPly((prev) => {
          if (!prev[ply]) return prev;
          const next = { ...prev } as AnalysisCache;
          delete next[ply];
          return next;
        });
      }
      const command = buildUsiPositionForPly(usi, ply);
      if (!command) return;
      startEngineAnalysis(command, ply);
    },
    [startEngineAnalysis, usi],
  );

  // Effects
  useEffect(() => {
    setCurrentPly(0);
    setAnalysisByPly({});
    setErrorMessage("");
    setIsAnalyzing(false);
    setIsEditMode(false);
    setSnapshotOverrides({});
    setHandsOverrides({});
    setEditHistory([]);
    stopEngineAnalysis();
  }, [stopEngineAnalysis, usi]);

  useEffect(() => stopEngineAnalysis, [stopEngineAnalysis]);

  useEffect(() => {
    if (!isEditMode) return;
    setIsAnalyzing(false);
    stopEngineAnalysis();
  }, [isEditMode, stopEngineAnalysis]);

  useEffect(() => {
    if (!isAnalyzing || isEditMode) return;
    if (!timeline.boards.length) return;
    if (analysisByPly[safeCurrentPly]) return;
    if (activeStreamPlyRef.current === safeCurrentPly && isStreaming) return;
    requestAnalysisForPly(safeCurrentPly);
  }, [analysisByPly, isAnalyzing, isStreaming, isEditMode, requestAnalysisForPly, safeCurrentPly, timeline.boards.length]);

  useEffect(() => {
    if (isEditMode) {
      setEditHistory([]);
    } else {
      setIsAnalyzing(false);
      stopEngineAnalysis();
    }
  }, [isEditMode, stopEngineAnalysis]);

  // 編集・履歴関連
  const saveToHistory = useCallback((board: BoardMatrix, hands: HandsState) => {
    setEditHistory((prev) => {
      const newHistory = [...prev, { board: cloneBoard(board), hands: { ...hands } }];
      if (newHistory.length > 5) {
        return newHistory.slice(newHistory.length - 5);
      }
      return newHistory;
    });
  }, []);

  const handleUndo = useCallback(() => {
    if (editHistory.length === 0) return;
    const prevState = editHistory[editHistory.length - 1];
    const newHistory = editHistory.slice(0, -1);
    setEditHistory(newHistory);
    setSnapshotOverrides((prev) => ({
      ...prev,
      [safeCurrentPly]: cloneBoard(prevState.board),
    }));
    setHandsOverrides((prev) => ({
      ...prev,
      [safeCurrentPly]: { ...prevState.hands },
    }));
    if (isAnalyzing) {
        stopEngineAnalysis();
        setIsAnalyzing(false);
    }
  }, [editHistory, safeCurrentPly, isAnalyzing, stopEngineAnalysis]);

  const handleBoardEdit = useCallback((next: BoardMatrix) => {
    if (!isEditMode) return;
    saveToHistory(displayedBoard, activeHands);
    setSnapshotOverrides((prev) => ({
      ...prev,
      [safeCurrentPly]: cloneBoard(next),
    }));
    if (isAnalyzing) {
        stopEngineAnalysis();
        setIsAnalyzing(false);
    }
  }, [isEditMode, safeCurrentPly, displayedBoard, activeHands, saveToHistory, isAnalyzing, stopEngineAnalysis]);

  const handleHandsEdit = useCallback((next: HandsState) => {
    if (!isEditMode) return;
    saveToHistory(displayedBoard, activeHands);
    setHandsOverrides((prev) => ({
      ...prev,
      [safeCurrentPly]: next,
    }));
    if (isAnalyzing) {
        stopEngineAnalysis();
        setIsAnalyzing(false);
    }
  }, [isEditMode, safeCurrentPly, displayedBoard, activeHands, saveToHistory, isAnalyzing, stopEngineAnalysis]);

  // Actions
  const handlePlyChange = useCallback(
    (nextPly: number) => {
      if (isEditMode) return;
      setCurrentPly(clampIndex(nextPly, timeline.boards));
    },
    [isEditMode, timeline.boards],
  );

  const goToStart = useCallback(() => handlePlyChange(0), [handlePlyChange]);
  const goToPrev = useCallback(() => handlePlyChange(safeCurrentPly - 1), [handlePlyChange, safeCurrentPly]);
  const goToNext = useCallback(() => handlePlyChange(safeCurrentPly + 1), [handlePlyChange, safeCurrentPly]);
  const goToEnd = useCallback(() => handlePlyChange(maxPly), [handlePlyChange, maxPly]);
  
  const navDisabled = isEditMode;
  const canGoPrev = safeCurrentPly > 0;
  const canGoNext = safeCurrentPly < maxPly;

  const handleStartStreamingAnalysis = useCallback(() => {
    if (isEditMode || !timeline.boards.length) return;
    setIsAnalyzing(true);
    const command = buildUsiPositionForPly(usi, safeCurrentPly);
    if (command) startEngineAnalysis(command, safeCurrentPly);
  }, [isEditMode, safeCurrentPly, timeline.boards.length, usi, startEngineAnalysis]);

  const handleAnalyzeEditedPosition = useCallback(() => {
    if (!isEditMode) return;
    const sfenCommand = `position ${boardToSfen(displayedBoard, activeHands, currentSideToMove)}`;
    setIsAnalyzing(true);
    startEngineAnalysis(sfenCommand, safeCurrentPly);
    showToast({ title: "編集局面の解析を開始しました", variant: "success" });
  }, [isEditMode, displayedBoard, activeHands, currentSideToMove, safeCurrentPly, startEngineAnalysis]);

  const handleStopAnalysis = useCallback(() => {
    setIsAnalyzing(false);
    stopEngineAnalysis();
  }, [stopEngineAnalysis]);

  const handleBatchAnalysis = useCallback(async () => {
    if (isEditMode || isBatchAnalyzing) return;
    if (!timeline.boards.length) {
      showToast({ title: "棋譜が読み込まれていません", variant: "warning" });
      return;
    }
    const basePosition = buildUsiPositionForPly(usi, totalMoves) || (moveSequence.length ? `position startpos moves ${moveSequence.join(" ")}` : "position startpos");
    if (!basePosition?.trim()) {
      showToast({ title: "局面データが無効です", variant: "warning" });
      return;
    }
    setIsBatchAnalyzing(true);
    stopEngineAnalysis();
    setIsAnalyzing(false);
    try {
      const response = await fetch(`${API_BASE}/api/analysis/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: basePosition, usi: basePosition, moves: moveSequence, max_ply: totalMoves, movetime_ms: 250, multipv: 3, time_budget_ms: 30000 }),
      });
      if (!response.ok) throw new Error("全体解析APIエラー");
      const payload = (await response.json()) as BatchAnalysisResponsePayload;
      const analysisMap = payload.analyses ?? payload.results;
      if (!analysisMap) throw new Error("解析結果なし");
      setAnalysisByPly((prev) => {
        const next = { ...prev } as AnalysisCache;
        Object.entries(analysisMap).forEach(([key, value]) => {
          const plyIndex = Number(key);
          if (!Number.isNaN(plyIndex)) next[plyIndex] = value;
        });
        return next;
      });
      showToast({ title: "全体解析完了", variant: "success" });
    } catch (error) {
      showToast({ title: "解析失敗", description: String(error), variant: "error" });
    } finally {
      setIsBatchAnalyzing(false);
    }
  }, [isBatchAnalyzing, isEditMode, moveSequence, stopEngineAnalysis, timeline.boards.length, totalMoves, usi]);

  const handleLoadKifu = useCallback(() => {
    setErrorMessage("");
    if (!kifuText.trim()) return;
    try {
      const newUsi = toStartposUSI(kifuText);
      setUsi(newUsi);
      showToast({ title: "棋譜を読み込みました", variant: "success" });
    } catch (error) {
      setErrorMessage(String(error));
    }
  }, [kifuText, setUsi]);

  // Render Helpers
  const primaryPv = currentAnalysis?.multipv?.[0];
  const primaryScoreLabel = primaryPv ? formatScoreLabel(primaryPv.score) : null;
  const primaryDepthLabel = formatDepthLabel(primaryPv?.depth);
  const primaryCpScore = primaryPv?.score.type === "cp" ? primaryPv.score.cp ?? null : null;
  
  const moveImpacts = useMemo(() => buildMoveImpacts(analysisByPly, totalMoves, initialTurn), [analysisByPly, initialTurn, totalMoves]);
  const moveListEntries = useMemo(() => {
    if (!moveSequence.length) return [];
    return moveSequence.map((move, index) => {
      const pieces = timelinePlacedPieces[index] ?? timelinePlacedPieces[0] ?? [];
      const sideToMove = index % 2 === 0 ? initialTurn : flipTurn(initialTurn);
      const readableMove = formatUsiMoveJapanese(move, pieces, sideToMove);
      return { ply: index + 1, label: readableMove, diff: moveImpacts[index]?.diff ?? null };
    });
  }, [initialTurn, moveImpacts, moveSequence, timelinePlacedPieces]);
  
  const moveQualityItems = useMemo(() => moveListEntries.map((entry) => ({ ply: entry.ply, moveLabel: entry.label, diff: entry.diff })), [moveListEntries]);
  
  const evalPoints = useMemo(() => {
    const boardCount = timeline.boards.length || totalMoves + 1;
    return Array.from({ length: boardCount }, (_, ply) => ({ ply, cp: getPrimaryEvalScore(analysisByPly[ply]) }));
  }, [analysisByPly, timeline.boards.length, totalMoves]);

  const boardMode: BoardMode = isEditMode ? "edit" : "view";
  
  // ★重要: ここで定義（return直前）
  const topHandSide: Side = boardOrientation === "sente" ? "w" : "b";
  const bottomHandSide: Side = boardOrientation === "sente" ? "b" : "w";

  return (
    <div className="space-y-6 text-[#1c1209]">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-black/10 bg-[#fbf7ef] p-4 md:p-5">
        <div className="text-sm font-semibold text-[#2b1c10]">検討モード</div>
        <div className="flex flex-wrap gap-2">
          {!isEditMode ? (
            <>
              <Button variant="outline" size="sm" onClick={handleBatchAnalysis} disabled={isBatchAnalyzing} className="border-black/20 text-slate-900 hover:bg-amber-50">
                {isBatchAnalyzing ? "全体解析中…" : "全体解析(高速)"}
              </Button>
              <Button variant="outline" size="sm" onClick={handleStartStreamingAnalysis} disabled={isAnalyzing} className="border-black/20 text-slate-900 hover:bg-amber-50">
                <Play className="w-3 h-3 mr-1" /> 検討開始
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleUndo} disabled={editHistory.length === 0} className="border-black/20 text-slate-900 hover:bg-slate-100">
                    <RotateCcw className="w-3 h-3 mr-1" /> 1手戻す
                </Button>
                <Button variant="default" size="sm" onClick={handleAnalyzeEditedPosition} disabled={isAnalyzing} className="bg-amber-600 hover:bg-amber-700 text-white border-none">
                    {isAnalyzing ? "解析中..." : <><Search className="w-3 h-3 mr-1" /> 現局面を解析</>}
                </Button>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={handleStopAnalysis} disabled={!isAnalyzing} className="border-black/20 text-slate-900 hover:bg-rose-50">
            停止
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setBoardOrientation((prev) => (prev === "sente" ? "gote" : "sente"))} className={`border-black/20 text-slate-900 hover:bg-amber-50 ${boardOrientation === "gote" ? "bg-amber-100" : ""}`}>
            {boardOrientation === "gote" ? "後手視点" : "先手視点"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsEditMode((prev) => !prev)} className={isEditMode ? "border-rose-300 bg-rose-100 text-rose-700" : "border-black/20 text-slate-900 hover:bg-amber-50"}>
            {isEditMode ? "編集終了" : "編集"}
          </Button>
        </div>
      </div>

      <div className={layoutStyles.analysisMain}>
        <aside className={layoutStyles.sidebar}>
          <MoveListPanel entries={moveListEntries} activePly={safeCurrentPly} onSelectPly={handlePlyChange} className="h-full" />
        </aside>

        <section className={`${layoutStyles.mainPanel} space-y-6`}>
          <div className="rounded-3xl border border-black/10 bg-white/95 p-4 shadow-[0_12px_30px_rgba(0,0,0,0.12)]">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#7a5f36]">
              <span>局面 {safeCurrentPly} / {maxPly}</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={goToStart} disabled={navDisabled || !canGoPrev}>{"<<"}</Button>
                <Button variant="outline" size="sm" onClick={goToPrev} disabled={navDisabled || !canGoPrev}>{"<"}</Button>
                <Button variant="outline" size="sm" onClick={goToNext} disabled={navDisabled || !canGoNext}>{">"}</Button>
                <Button variant="outline" size="sm" onClick={goToEnd} disabled={navDisabled || !canGoNext}>{">>"}</Button>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-4">
              <HandsColumn side={topHandSide} hands={activeHands[topHandSide] ?? {}} orientationMode={orientationMode} align="start" />
              <div className="flex justify-start">
                <ShogiBoard
                  board={displayedBoard}
                  hands={activeHands}
                  mode={boardMode}
                  lastMove={isEditMode ? undefined : lastMoveCoords ?? undefined}
                  bestmove={isEditMode ? undefined : bestmoveCoords ?? null}
                  orientationMode={orientationMode}
                  orientation={boardOrientation}
                  onBoardChange={isEditMode ? handleBoardEdit : undefined}
                  onHandsChange={isEditMode ? handleHandsEdit : undefined}
                />
              </div>
              <HandsColumn side={bottomHandSide} hands={activeHands[bottomHandSide] ?? {}} orientationMode={orientationMode} align="end" />
            </div>
          </div>

          {/* 以下、解析結果パネルなどは変更なし */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border border-black/10 bg-[#f9f3e5]/95 p-4 shadow-[0_10px_20px_rgba(0,0,0,0.1)]">
              <div className="flex justify-between items-center mb-2 text-xs text-[#7a5f36]">
                <span>候補手</span>
                {isAnalyzing && !hasCurrentAnalysis && <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />}
              </div>
              <div className="text-3xl font-serif text-[#3a2b17]">
                {currentAnalysis?.bestmove ? formatUsiMoveJapanese(currentAnalysis.bestmove, currentPlacedPieces, currentSideToMove) : "---"}
              </div>
              <p className="text-sm text-[#555] mt-1 flex items-center gap-3">
                {primaryScoreLabel ? `評価値: ${primaryScoreLabel}` : isAnalyzing ? "解析中..." : "エンジン結果なし"}
              </p>
            </div>
            <div className="rounded-3xl border border-black/10 bg-[#f9f3e5]/95 p-4 shadow-[0_10px_20px_rgba(0,0,0,0.1)] max-h-[420px] overflow-y-auto space-y-3">
               {currentAnalysis?.multipv?.length ? currentAnalysis.multipv.map((pv) => (
                   <div key={`${pv.multipv}`} className="rounded-xl border border-black/10 bg-white p-3 shadow-sm">
                       <div className="flex items-center justify-between">
                           <span className="font-bold">{formatUsiMoveJapanese(pv.pv?.split(" ")[0] || "", currentPlacedPieces, currentSideToMove)}</span>
                           <span className="font-mono">{formatScoreLabel(pv.score)}</span>
                       </div>
                       <div className="text-xs text-[#555] mt-1 truncate">{pv.pv}</div>
                   </div>
               )) : <div className="text-center text-[#555]">データなし</div>}
            </div>
          </div>
          
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="w-full"><EvalGraph data={evalPoints} currentPly={safeCurrentPly} /></div>
            <div className="w-full"><MoveQualityPanel items={moveQualityItems} /></div>
          </div>

          <div className="flex flex-col rounded-3xl border border-black/10 bg-[#f9f3e5]/95 shadow-[0_10px_20px_rgba(0,0,0,0.1)]">
            <div className="p-3 border-b border-black/10 text-xs font-bold text-[#7a5f36] flex justify-between items-center">
              <span>棋譜入力 (KIF/CSA/USI)</span>
              <Button size="sm" variant="ghost" onClick={handleLoadKifu} className="h-6 text-xs text-[#7a5f36] hover:bg-amber-50">
                <FileText className="w-3 h-3 mr-1 text-[#555]" />読み込み
              </Button>
            </div>
            <Textarea value={kifuText} onChange={(e) => setKifuText(e.target.value)} className="flex-1 border-none bg-white/80 p-3 text-xs font-mono focus:ring-0" placeholder="KIF/CSA/USI" />
            {errorMessage && <div className="p-2 bg-rose-100 text-rose-700 text-xs border-t border-rose-200">{errorMessage}</div>}
          </div>
        </section>
      </div>
    </div>
  );
}

type HandsColumnProps = { side: Side; hands: Partial<Record<PieceBase, number>>; orientationMode: OrientationMode; align?: "start" | "end"; };
const HandsColumn: React.FC<HandsColumnProps> = ({ side, hands, orientationMode, align = "start" }) => {
  const owner = side === "b" ? "sente" : "gote";
  const entries = HAND_DISPLAY_ORDER.map((base) => {
    const count = hands?.[base];
    if (!count) return null;
    const piece = (side === "b" ? base : base.toLowerCase()) as PieceCode;
    return (
      <div key={`${side}-${base}`} className="flex items-center gap-2 text-sm text-[#2b1c10]">
        <div className="relative h-10 w-10">
          <PieceSprite piece={piece} x={0} y={0} size={34} cellSize={40} orientationMode={orientationMode} owner={owner} />
          {count > 1 && <span className="absolute -top-1 -right-1 rounded-full bg-white/90 px-1 text-xs font-semibold text-[#2b1c10]">x{count}</span>}
        </div>
        <span className="font-semibold">{formatHandLabel(base)} x{count}</span>
      </div>
    );
  }).filter(Boolean) as React.ReactNode[];
  return (
    <div className={`flex w-24 flex-col gap-3 ${align === "end" ? "self-end items-end text-right" : "items-start text-left"}`}>
      <span className="text-xs font-semibold text-[#7a5f36]">{side === "b" ? "先手の持ち駒" : "後手の持ち駒"}</span>
      <div className="flex flex-col gap-2">{entries.length ? entries : <span className="text-[11px] text-[#9a8a78]">持ち駒なし</span>}</div>
    </div>
  );
};
const formatHandLabel = (base: PieceBase): string => { switch (base) { case "P": return "歩"; case "L": return "香"; case "N": return "桂"; case "S": return "銀"; case "G": return "金"; case "B": return "角"; case "R": return "飛"; case "K": return "玉"; default: return base; } };