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
import { AnalysisCache, buildMoveImpacts, getPrimaryEvalScore } from "@/lib/analysisUtils";
import { FileText, RotateCcw, Search, Play, Sparkles, Upload, ChevronFirst, ChevronLeft, ChevronRight, ChevronLast, ArrowRight } from "lucide-react";
import MoveListPanel from "@/components/annotate/MoveListPanel";
import EvalGraph from "@/components/annotate/EvalGraph";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8787";

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

// Helper Functions
const boardToSfen = (board: BoardMatrix, hands: HandsState, turn: Side): string => {
  let sfen = "";
  let emptyCount = 0;
  for (let y = 0; y < 9; y++) {
    for (let x = 0; x < 9; x++) {
      const piece = board[y][x];
      if (piece) {
        if (emptyCount > 0) { sfen += emptyCount.toString(); emptyCount = 0; }
        sfen += piece;
      } else { emptyCount++; }
    }
    if (emptyCount > 0) { sfen += emptyCount.toString(); emptyCount = 0; }
    if (y < 8) sfen += "/";
  }
  sfen += ` ${turn} `;
  const handOrder: PieceBase[] = ["R", "B", "G", "S", "N", "L", "P"];
  let handStr = "";
  handOrder.forEach((p) => {
    const count = hands.b[p] || 0;
    if (count === 1) handStr += p; else if (count > 1) handStr += count + p;
  });
  handOrder.forEach((p) => {
    const count = hands.w[p] || 0;
    if (count === 1) handStr += p.toLowerCase(); else if (count > 1) handStr += count + p.toLowerCase();
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
  if (score.type === "mate") return typeof score.mate === "number" && score.mate !== 0 ? `Mate ${score.mate}` : "Mate";
  const cp = typeof score.cp === "number" ? score.cp : 0;
  return `${cp > 0 ? "+" : ""}${cp}cp`;
};
const HAND_DISPLAY_ORDER: PieceBase[] = ["P", "L", "N", "S", "G", "B", "R", "K"];

export default function AnalysisTab({ usi, setUsi, orientationMode = "sprite" }: AnalysisTabProps) {
  // State
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
  const [explanation, setExplanation] = useState<string>("");
  const [isExplaining, setIsExplaining] = useState(false);

  // Data & Memo
  const timeline = useMemo(() => {
    try {
      return buildBoardTimeline(usi);
    } catch (error) {
      return { boards: [getStartBoard()], hands: [{ b: {}, w: {} }], moves: [] };
    }
  }, [usi]);

  const parsedPosition = useMemo(() => {
    try { return buildPositionFromUsi(usi); } 
    catch { return { board: getStartBoard(), moves: [], turn: "b" as Side }; }
  }, [usi]);

  const initialTurn = useMemo(() => {
    const moveCount = parsedPosition.moves.length;
    return moveCount % 2 === 0 ? parsedPosition.turn : flipTurn(parsedPosition.turn);
  }, [parsedPosition.moves.length, parsedPosition.turn]);

  const moveSequence = timeline.moves;
  const totalMoves = moveSequence.length;
  const maxPly = totalMoves;
  const safeCurrentPly = useMemo(() => clampIndex(currentPly, timeline.boards), [currentPly, timeline.boards]);

  const baseBoard = timeline.boards[safeCurrentPly] ?? getStartBoard();
  const displayedBoard = snapshotOverrides[safeCurrentPly] ?? baseBoard;
  const fallbackHands = useMemo<HandsState>(() => ({ b: {}, w: {} }), []);
  const timelineHands = useMemo<HandsState[]>(() => timeline.hands ?? [], [timeline.hands]);
  const baseHands = timelineHands[safeCurrentPly] ?? fallbackHands;
  const activeHands = handsOverrides[safeCurrentPly] ?? baseHands;

  const timelinePlacedPieces = useMemo(() => {
    if (!timeline.boards.length) return [boardToPlaced(getStartBoard())];
    return timeline.boards.map((board) => boardToPlaced(board));
  }, [timeline.boards]);

  const currentPlacedPieces = useMemo(() => boardToPlaced(displayedBoard), [displayedBoard]);
  const currentSideToMove = useMemo(() => {
    let side = initialTurn;
    if (safeCurrentPly % 2 === 1) side = flipTurn(side);
    return side;
  }, [safeCurrentPly, initialTurn]);

  const currentAnalysis = analysisByPly[safeCurrentPly];
  const hasCurrentAnalysis = Boolean(currentAnalysis);
  const prevMove = safeCurrentPly > 0 ? moveSequence[safeCurrentPly - 1] : null;
  const lastMoveCoords = !isEditMode && prevMove ? usiMoveToCoords(prevMove) : null;
  const bestmoveCoords = !isEditMode && currentAnalysis?.bestmove ? usiMoveToCoords(currentAnalysis.bestmove) : null;
  const currentMoveUsi = safeCurrentPly === 0 ? null : moveSequence[safeCurrentPly - 1] ?? null;

  // Callbacks
  const stopEngineAnalysis = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    activeStreamPlyRef.current = null;
    setIsStreaming(false);
  }, []);

  const startEngineAnalysis = useCallback((command: string, ply: number) => {
    if (!command) return;
    stopEngineAnalysis();
    
    const url = `${API_BASE}/api/analysis/stream?position=${encodeURIComponent(command)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;
    activeStreamPlyRef.current = ply;
    setIsStreaming(true);

    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as EngineAnalyzeResponse;
        setAnalysisByPly((prev) => {
          const previous = prev[ply] || {};
          const merged = { ...previous, ...payload };
          if (payload.multipv?.length) merged.multipv = payload.multipv;
          if (payload.bestmove) merged.bestmove = payload.bestmove;
          return { ...prev, [ply]: merged };
        });
      } catch (e) { console.warn("Stream parse error", e); }
    };
    es.onerror = (e) => { console.warn("Stream error", e); stopEngineAnalysis(); };
  }, [stopEngineAnalysis]);

  const requestAnalysisForPly = useCallback((ply: number, options?: { force?: boolean }) => {
    if (options?.force) {
      setAnalysisByPly((prev) => {
        if (!prev[ply]) return prev;
        const { [ply]: _, ...rest } = prev;
        return rest as AnalysisCache;
      });
    }
    const command = buildUsiPositionForPly(usi, ply);
    if (command) startEngineAnalysis(command, ply);
  }, [startEngineAnalysis, usi]);

  const saveToHistory = useCallback((board: BoardMatrix, hands: HandsState) => {
    setEditHistory((prev) => {
      const newHistory = [...prev, { board: cloneBoard(board), hands: { ...hands } }];
      return newHistory.length > 5 ? newHistory.slice(newHistory.length - 5) : newHistory;
    });
  }, []);

  const handleUndo = useCallback(() => {
    if (editHistory.length === 0) return;
    const prevState = editHistory[editHistory.length - 1];
    setEditHistory((prev) => prev.slice(0, -1));
    setSnapshotOverrides((prev) => ({ ...prev, [safeCurrentPly]: cloneBoard(prevState.board) }));
    setHandsOverrides((prev) => ({ ...prev, [safeCurrentPly]: { ...prevState.hands } }));
    if (isAnalyzing) { stopEngineAnalysis(); setIsAnalyzing(false); }
  }, [editHistory, safeCurrentPly, isAnalyzing, stopEngineAnalysis]);

  const handleBoardEdit = useCallback((next: BoardMatrix) => {
    if (!isEditMode) return;
    saveToHistory(displayedBoard, activeHands);
    setSnapshotOverrides((prev) => ({ ...prev, [safeCurrentPly]: cloneBoard(next) }));
    if (isAnalyzing) { stopEngineAnalysis(); setIsAnalyzing(false); }
  }, [isEditMode, safeCurrentPly, displayedBoard, activeHands, saveToHistory, isAnalyzing, stopEngineAnalysis]);

  const handleHandsEdit = useCallback((next: HandsState) => {
    if (!isEditMode) return;
    saveToHistory(displayedBoard, activeHands);
    setHandsOverrides((prev) => ({ ...prev, [safeCurrentPly]: next }));
    if (isAnalyzing) { stopEngineAnalysis(); setIsAnalyzing(false); }
  }, [isEditMode, safeCurrentPly, displayedBoard, activeHands, saveToHistory, isAnalyzing, stopEngineAnalysis]);

  const handlePlyChange = useCallback((nextPly: number) => {
    if (isEditMode) return;
    setCurrentPly(clampIndex(nextPly, timeline.boards));
  }, [isEditMode, timeline.boards]);

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
    requestAnalysisForPly(safeCurrentPly, { force: true });
  }, [isEditMode, requestAnalysisForPly, safeCurrentPly, timeline.boards.length]);

  const handleStopAnalysis = useCallback(() => {
    setIsAnalyzing(false);
    stopEngineAnalysis();
  }, [stopEngineAnalysis]);

  const handleAnalyzeEditedPosition = useCallback(() => {
    if (!isEditMode) return;
    const sfenCommand = `position ${boardToSfen(displayedBoard, activeHands, currentSideToMove)}`;
    setIsAnalyzing(true);
    startEngineAnalysis(sfenCommand, safeCurrentPly);
    showToast({ title: "編集局面の解析を開始しました", variant: "default" });
  }, [isEditMode, displayedBoard, activeHands, currentSideToMove, safeCurrentPly, startEngineAnalysis]);

  const handleGenerateExplanation = useCallback(async () => {
    const currentSfen = isEditMode 
      ? `position ${boardToSfen(displayedBoard, activeHands, currentSideToMove)}`
      : buildUsiPositionForPly(usi, safeCurrentPly);
    const analysis = analysisByPly[safeCurrentPly];
    if (!analysis || !analysis.bestmove) {
      showToast({ title: "先に解析を行ってください", variant: "default" });
      return;
    }
    setIsExplaining(true);
    setExplanation("");
    try {
      const res = await fetch(`${API_BASE}/api/explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sfen: currentSfen, ply: safeCurrentPly, bestmove: analysis.bestmove,
          score_cp: analysis.multipv?.[0]?.score.type === 'cp' ? analysis.multipv[0].score.cp : null,
          score_mate: analysis.multipv?.[0]?.score.type === 'mate' ? analysis.multipv[0].score.mate : null,
          pv: analysis.multipv?.[0]?.pv || "", turn: currentSideToMove
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setExplanation(data.explanation);
    } catch (e) {
      showToast({ title: "解説生成エラー", variant: "default" });
    } finally {
      setIsExplaining(false);
    }
  }, [analysisByPly, safeCurrentPly, usi, isEditMode, displayedBoard, activeHands, currentSideToMove]);

  const handleBatchAnalysis = useCallback(async () => {
    if (isEditMode || isBatchAnalyzing) return;
    if (!timeline.boards.length) return;
    const basePosition = buildUsiPositionForPly(usi, totalMoves);
    if (!basePosition?.trim()) return;

    setIsBatchAnalyzing(true);
    stopEngineAnalysis();
    setIsAnalyzing(false);

    try {
      const response = await fetch(`${API_BASE}/api/analysis/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          position: basePosition,
          usi: basePosition,
          moves: moveSequence,
          max_ply: totalMoves,
          movetime_ms: 250,
          multipv: 3,
          time_budget_ms: 30000
        }),
      });
      if (!response.ok) throw new Error();
      const payload = (await response.json()) as BatchAnalysisResponsePayload;
      const analysisMap = payload.analyses ?? payload.results;
      if (!analysisMap) throw new Error();
      setAnalysisByPly((prev) => {
        const next = { ...prev } as AnalysisCache;
        Object.entries(analysisMap).forEach(([key, value]) => {
          const ply = Number(key);
          if (!Number.isNaN(ply)) next[ply] = value;
        });
        return next;
      });
      showToast({ title: "全体解析完了", variant: "default" });
    } catch (error) {
      showToast({ title: "解析失敗", variant: "default" });
    } finally {
      setIsBatchAnalyzing(false);
    }
  }, [isBatchAnalyzing, isEditMode, moveSequence, stopEngineAnalysis, timeline.boards.length, totalMoves, usi]);

  const handleLoadKifu = useCallback(() => {
    setErrorMessage("");
    if (!kifuText.trim()) return;
    try {
      setUsi(toStartposUSI(kifuText));
      showToast({ title: "読み込みました", variant: "default" });
    } catch (e) { setErrorMessage(String(e)); }
  }, [kifuText, setUsi]);

  // ★候補手クリック時のハンドラ
  const handleCandidateClick = useCallback((pvStr: string) => {
      const moves = pvStr.trim().split(/\s+/);
      if (moves.length === 0) return;
      const nextMove = moves[0];
      
      // 現在の局面にこの手を適用して次の手数を表示する
      // (簡易実装: USI文字列に指し手を追加してSetUsiする)
      // ※本来は分岐を作るべきですが、今回は一直線に更新します
      if (!isEditMode) {
          // 現在の手数以降を切り捨てて、新しい手を追加する
          const currentUsi = buildUsiPositionForPly(usi, safeCurrentPly);
          if (currentUsi) {
              setUsi(`${currentUsi} ${nextMove}`);
              // 1手進める
              setTimeout(() => setCurrentPly(safeCurrentPly + 1), 50);
          }
      }
  }, [usi, safeCurrentPly, isEditMode, setUsi]);


  useEffect(() => stopEngineAnalysis, [stopEngineAnalysis]);
  useEffect(() => {
    setCurrentPly(0);
    setAnalysisByPly({});
    setSnapshotOverrides({});
    setHandsOverrides({});
    setEditHistory([]);
    setExplanation("");
    stopEngineAnalysis();
  }, [stopEngineAnalysis, usi]);
  useEffect(() => {
    if (isEditMode) {
      setEditHistory([]);
      setExplanation("");
    } else {
      setIsAnalyzing(false);
      stopEngineAnalysis();
    }
  }, [isEditMode, stopEngineAnalysis]);
  useEffect(() => {
    if (!isAnalyzing || isEditMode || !timeline.boards.length) return;
    if (analysisByPly[safeCurrentPly] || (activeStreamPlyRef.current === safeCurrentPly && isStreaming)) return;
    requestAnalysisForPly(safeCurrentPly);
  }, [analysisByPly, isAnalyzing, isStreaming, isEditMode, requestAnalysisForPly, safeCurrentPly, timeline.boards.length]);

  const moveImpacts = useMemo(() => buildMoveImpacts(analysisByPly, totalMoves, initialTurn), [analysisByPly, initialTurn, totalMoves]);
  const moveListEntries = useMemo(() => {
    if (!moveSequence.length) return [];
    return moveSequence.map((move, index) => {
      const ply = index + 1;
      const analysis = analysisByPly[ply];
      const score = analysis?.multipv?.[0]?.score;
      return {
        ply: ply,
        label: formatUsiMoveJapanese(move, timelinePlacedPieces[index] ?? [], index % 2 === 0 ? initialTurn : flipTurn(initialTurn)),
        diff: moveImpacts[index]?.diff ?? null,
        score: score
      };
    });
  }, [initialTurn, moveImpacts, moveSequence, timelinePlacedPieces, analysisByPly]);
  
  const evalPoints = useMemo(() => Array.from({ length: timeline.boards.length || totalMoves + 1 }, (_, ply) => ({ ply, cp: getPrimaryEvalScore(analysisByPly[ply]) })), [analysisByPly, timeline.boards.length, totalMoves]);

  const boardMode: BoardMode = isEditMode ? "edit" : "view";
  const topHandSide: Side = boardOrientation === "sente" ? "w" : "b";
  const bottomHandSide: Side = boardOrientation === "sente" ? "b" : "w";

  return (
    <div className="space-y-4 text-[#1c1209] h-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-sm">
        <div className="flex items-center gap-4">
            <div className="text-sm font-bold text-slate-700">検討モード</div>
            <div className="text-xs text-slate-500">局面: {safeCurrentPly} / {maxPly}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isEditMode ? (
            <>
              <Button variant="outline" size="sm" onClick={handleBatchAnalysis} disabled={isBatchAnalyzing} className="border-slate-300 text-slate-700 h-8 text-xs">全体解析</Button>
              <Button variant="outline" size="sm" onClick={handleStartStreamingAnalysis} disabled={isAnalyzing} className="border-slate-300 text-slate-700 h-8 text-xs"><Play className="w-3 h-3 mr-1" /> 検討開始</Button>
              <Button variant="default" size="sm" onClick={handleGenerateExplanation} disabled={isExplaining || !hasCurrentAnalysis} className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white border-none h-8 text-xs">{isExplaining ? "思考中..." : <><Sparkles className="w-3 h-3 mr-1" /> AI解説</>}</Button>
            </>
          ) : (
            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleUndo} disabled={editHistory.length === 0} className="border-slate-300 text-slate-700 h-8 text-xs"><RotateCcw className="w-3 h-3 mr-1" /> 1手戻す</Button>
                <Button variant="outline" size="sm" onClick={handleAnalyzeEditedPosition} disabled={isAnalyzing} className="border-amber-600 text-amber-700 h-8 text-xs"><Search className="w-3 h-3 mr-1" /> 現局面を解析</Button>
                <Button variant="default" size="sm" onClick={handleGenerateExplanation} disabled={isExplaining || !hasCurrentAnalysis} className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white border-none h-8 text-xs">{isExplaining ? "思考中..." : <><Sparkles className="w-3 h-3 mr-1" /> AI解説</>}</Button>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={handleStopAnalysis} disabled={!isAnalyzing} className="border-slate-300 text-slate-700 hover:bg-red-50 hover:text-red-600 h-8 text-xs">停止</Button>
        </div>
        <div className="flex flex-wrap gap-2">
           <Button variant="outline" size="sm" onClick={() => setBoardOrientation((prev) => (prev === "sente" ? "gote" : "sente"))} className="border-slate-300 text-slate-700 h-8 text-xs">{boardOrientation === "gote" ? "後手視点" : "先手視点"}</Button>
           <Button variant="outline" size="sm" onClick={() => setIsEditMode((prev) => !prev)} className={`${isEditMode ? "bg-amber-100 text-amber-800 border-amber-300" : "border-slate-300 text-slate-700"} h-8 text-xs`}>{isEditMode ? "編集終了" : "編集"}</Button>
        </div>
      </div>

      {/* Main Grid Layout (3 Columns) */}
      <div className="grid grid-cols-1 xl:grid-cols-[auto_320px_280px] gap-4 items-start">
        
        {/* Col 1: Board */}
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-slate-200 bg-[#f9f8f3] p-4 shadow-md flex flex-col items-center gap-4">
            <div className="flex items-center justify-center w-full gap-4 mb-2">
                <Button variant="outline" size="icon" className="w-8 h-8" onClick={goToStart} disabled={navDisabled || !canGoPrev}><ChevronFirst className="w-4 h-4"/></Button>
                <Button variant="outline" size="icon" className="w-8 h-8" onClick={goToPrev} disabled={navDisabled || !canGoPrev}><ChevronLeft className="w-4 h-4"/></Button>
                <Button variant="outline" size="icon" className="w-8 h-8" onClick={goToNext} disabled={navDisabled || !canGoNext}><ChevronRight className="w-4 h-4"/></Button>
                <Button variant="outline" size="icon" className="w-8 h-8" onClick={goToEnd} disabled={navDisabled || !canGoNext}><ChevronLast className="w-4 h-4"/></Button>
            </div>
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-4">
              <HandsColumn side={topHandSide} hands={activeHands[topHandSide] ?? {}} orientationMode={orientationMode} align="start" />
              <div className="flex justify-center shadow-lg rounded-lg overflow-hidden border-4 border-[#5d4037]">
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
          
          {/* Graph & Input (Bottom of Col 1) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
                <EvalGraph data={evalPoints} currentPly={safeCurrentPly} onPlyClick={handlePlyChange} />
             </div>
             <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm h-[260px] flex flex-col">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-slate-600 flex items-center gap-1"><FileText className="w-3 h-3"/> 棋譜入力</span>
                    <Button size="sm" variant="ghost" onClick={handleLoadKifu} className="h-6 text-[10px] bg-slate-100 hover:bg-amber-50 text-slate-700"><Upload className="w-3 h-3 mr-1"/> 読込</Button>
                </div>
                <Textarea value={kifuText} onChange={(e) => setKifuText(e.target.value)} className="flex-1 w-full text-[10px] font-mono border-slate-200 bg-slate-50 focus:bg-white resize-none mb-1" placeholder="ここにKIF/CSA/USIを貼り付け" />
             </div>
          </div>
        </div>

        {/* Col 2: Candidates (Vertical) */}
        <div className="flex flex-col gap-4 h-full max-h-[calc(100vh-140px)] overflow-y-auto">
            {/* AI Explanation */}
            {explanation && (
                <div className="p-4 bg-purple-50 rounded-xl border border-purple-100 text-sm text-slate-800 shadow-sm shrink-0">
                    <div className="font-bold text-purple-700 mb-1 flex items-center gap-2"><Sparkles className="w-4 h-4"/> AI解説</div>
                    {explanation}
                </div>
            )}

            {/* Candidates List */}
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm flex-1 min-h-[300px]">
                <div className="text-xs font-bold text-slate-500 mb-3 pb-2 border-b border-slate-100 flex justify-between">
                    <span>AI候補手 (MultiPV)</span>
                    {isAnalyzing && !hasCurrentAnalysis && <span className="text-[10px] text-green-600 animate-pulse">解析中...</span>}
                </div>
                <div className="flex flex-col gap-2">
                    {currentAnalysis?.multipv?.length ? currentAnalysis.multipv.map((pv) => (
                      <div 
                        key={`${pv.multipv}`} 
                        onClick={() => handleCandidateClick(pv.pv || "")}
                        className="group flex flex-col p-2 rounded-lg border border-slate-100 hover:border-amber-300 hover:bg-amber-50 cursor-pointer transition-all"
                      >
                          <div className="flex justify-between items-center mb-1">
                              <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold bg-slate-100 group-hover:bg-white px-1.5 py-0.5 rounded text-slate-600">#{pv.multipv}</span>
                                  <span className="text-sm font-bold text-slate-800">{formatUsiMoveJapanese(pv.pv?.split(" ")[0] || "", currentPlacedPieces, currentSideToMove)}</span>
                              </div>
                              <span className={`text-sm font-mono font-bold ${pv.score.type === 'mate' ? 'text-rose-600' : ((pv.score.cp ?? 0) > 0 ? 'text-emerald-600' : 'text-slate-600')}`}>
                                  {formatScoreLabel(pv.score)}
                              </span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 group-hover:text-slate-600">
                              <ArrowRight className="w-3 h-3" />
                              <span className="truncate">{pv.pv}</span>
                          </div>
                      </div>
                    )) : <div className="text-xs text-slate-400 text-center py-10">解析データなし</div>}
                </div>
            </div>
        </div>

        {/* Col 3: Move List (Tall) */}
        <div className="h-full max-h-[calc(100vh-140px)] shadow-md border border-slate-200 rounded-xl overflow-hidden bg-white">
             <MoveListPanel 
                entries={moveListEntries} 
                activePly={safeCurrentPly} 
                onSelectPly={handlePlyChange} 
                className="h-full border-0 rounded-none" 
            />
        </div>

      </div>
    </div>
  );
}

// HandsColumn (変更なし)
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