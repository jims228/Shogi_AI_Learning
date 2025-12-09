"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ShogiBoard, type BoardMode } from "@/components/ShogiBoard";
import { PieceSprite, type OrientationMode } from "@/components/PieceSprite";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { showToast } from "@/components/ui/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
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
import { FileText, RotateCcw, Search, Play, Sparkles, Upload, ChevronFirst, ChevronLeft, ChevronRight, ChevronLast, ArrowRight, BrainCircuit, X, ScrollText, Eye } from "lucide-react";
import MoveListPanel from "@/components/annotate/MoveListPanel";
import EvalGraph from "@/components/annotate/EvalGraph";
import { useBatchAnalysis } from "@/hooks/useBatchAnalysis";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8787";

const HAND_DISPLAY_ORDER: PieceBase[] = ["P", "L", "N", "S", "G", "B", "R", "K"];

const formatHandLabel = (base: PieceBase): string => { 
    switch (base) { case "P": return "歩"; case "L": return "香"; case "N": return "桂"; case "S": return "銀"; case "G": return "金"; case "B": return "角"; case "R": return "飛"; case "K": return "玉"; default: return base; } 
};

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

const convertFullPvToJapanese = (baseUsi: string, pv: string): string => {
    if (!pv) return "";
    const moves = pv.trim().split(" ");
    const displayMoves = moves.slice(0, 5);
    try {
        const baseMoveCount = baseUsi.split(" ").filter(s => s !== "startpos" && s !== "moves").length;
        const fullUsi = baseUsi + " " + displayMoves.join(" ");
        const timeline = buildBoardTimeline(fullUsi);
        const result: string[] = [];
        for (let i = 0; i < displayMoves.length; i++) {
            const boardState = timeline.boards[baseMoveCount + i];
            const turn = (baseMoveCount + i) % 2 === 0 ? "b" : "w";
            if (!boardState) break;
            const placed = boardToPlaced(boardState);
            const jp = formatUsiMoveJapanese(displayMoves[i], placed, turn);
            result.push(jp);
        }
        return result.join(" ");
    } catch { return pv; }
};

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

// ヘルパー関数: 指定手数でUSI文字列をカットする
const getSubsetUSI = (originalUsi: string, ply: number): string => {
  const parts = originalUsi.trim().split(" moves ");
  const header = parts[0]; 
  const moveStr = parts[1];
  
  if (!moveStr) return header;
  
  const moves = moveStr.trim().split(" ");
  
  if (ply === 0) return header;

  const neededMoves = moves.slice(0, ply);
  
  if (neededMoves.length === 0) return header;
  
  return `${header} moves ${neededMoves.join(" ")}`;
};

type AnalysisTabProps = {
  usi: string;
  setUsi: (next: string) => void;
  orientationMode?: OrientationMode;
};

export default function AnalysisTab({ usi, setUsi, orientationMode = "sprite" }: AnalysisTabProps) {
  const [currentPly, setCurrentPly] = useState(0);
  const [realtimeAnalysis, setRealtimeAnalysis] = useState<AnalysisCache>({});
  
  const { 
    batchData, 
    isBatchAnalyzing, 
    progress: batchProgress,
    runBatchAnalysis, 
    cancelBatchAnalysis,
    resetBatchData 
  } = useBatchAnalysis();

  const eventSourceRef = useRef<EventSource | null>(null);
  const activeStreamPlyRef = useRef<number | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [kifuText, setKifuText] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [boardOrientation, setBoardOrientation] = useState<"sente" | "gote">("sente");
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [snapshotOverrides, setSnapshotOverrides] = useState<Record<number, BoardMatrix>>({});
  const [handsOverrides, setHandsOverrides] = useState<Record<number, HandsState>>({});
  const [editHistory, setEditHistory] = useState<{ board: BoardMatrix; hands: HandsState }[]>([]);
  const [explanation, setExplanation] = useState<string>("");
  const [gameDigest, setGameDigest] = useState<string>("");
  const [isExplaining, setIsExplaining] = useState(false);
  const [isDigesting, setIsDigesting] = useState(false);

  const [previewSequence, setPreviewSequence] = useState<string[] | null>(null);
  const [previewStep, setPreviewStep] = useState<number>(0);

  const timeline = useMemo(() => {
    try { return buildBoardTimeline(usi); } 
    catch { return { boards: [getStartBoard()], hands: [{ b: {}, w: {} }], moves: [] }; }
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
  
  const previewState = useMemo(() => {
    if (!previewSequence) return null;
    const currentUsi = getSubsetUSI(usi, safeCurrentPly);
    if (!currentUsi) return null;
    
    const activeMoves = previewSequence.slice(0, previewStep);
    
    const baseStr = currentUsi;
    const connector = baseStr.includes("moves") ? " " : " moves ";
    const finalUsi = activeMoves.length > 0 ? baseStr + connector + activeMoves.join(" ") : baseStr;

    try {
        const previewTimeline = buildBoardTimeline(finalUsi);
        const lastIndex = previewTimeline.boards.length - 1;
        return {
            board: previewTimeline.boards[lastIndex],
            hands: previewTimeline.hands[lastIndex],
            lastMove: previewTimeline.moves[previewTimeline.moves.length - 1]
        };
    } catch {
        return null;
    }
  }, [previewSequence, previewStep, usi, safeCurrentPly]);

  const displayedBoard = previewState ? previewState.board : (snapshotOverrides[safeCurrentPly] ?? baseBoard);
  const fallbackHands = useMemo<HandsState>(() => ({ b: {}, w: {} }), []);
  const timelineHands = useMemo<HandsState[]>(() => timeline.hands ?? [], [timeline.hands]);
  const baseHands = timelineHands[safeCurrentPly] ?? fallbackHands;
  const activeHands = previewState ? previewState.hands : (handsOverrides[safeCurrentPly] ?? baseHands);

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

  // ★重要: これは「停止ボタン」用。UIの状態もFalseにする。
  const stopEngineAnalysis = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    activeStreamPlyRef.current = null;
    setIsAnalyzing(false);
  }, []);

  const evalSource = useMemo(() => {
    return { ...batchData, ...realtimeAnalysis };
  }, [batchData, realtimeAnalysis]);

  const currentAnalysis = evalSource[safeCurrentPly];
  const hasCurrentAnalysis = Boolean(currentAnalysis);
  
  const showArrow = !isEditMode && (isAnalyzing || !!currentAnalysis);

  const bestmoveCoords = (showArrow && currentAnalysis?.bestmove && !previewSequence) 
      ? usiMoveToCoords(currentAnalysis.bestmove) 
      : null;
  
  const prevMove = safeCurrentPly > 0 ? moveSequence[safeCurrentPly - 1] : null;
  const lastMoveCoords = previewState 
      ? (previewState.lastMove ? usiMoveToCoords(previewState.lastMove) : null)
      : (!isEditMode && prevMove ? usiMoveToCoords(prevMove) : null);
  
  const startEngineAnalysis = useCallback((command: string, ply: number) => {
    if (!command) return;
    
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setRealtimeAnalysis(prev => {
        const next = { ...prev };
        delete next[ply];
        return next;
    });
    
    const url = `${API_BASE}/api/analysis/stream?position=${encodeURIComponent(command)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;
    activeStreamPlyRef.current = ply;

    es.onopen = () => {
      console.log(`[Analysis] Connection opened for ply ${ply}`);
    };

    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.multipv_update) {
            setRealtimeAnalysis((prev) => {
                const previousEntry = prev[ply] || { ok: true, multipv: [] };
                const currentList = previousEntry.multipv ? [...previousEntry.multipv] : [];
                const newItem = payload.multipv_update;
                if (!newItem.multipv) return prev;
                const index = currentList.findIndex(item => item.multipv === newItem.multipv);
                if (index !== -1) {
                    currentList[index] = newItem;
                } else {
                    currentList.push(newItem);
                }
                currentList.sort((a, b) => (a.multipv || 0) - (b.multipv || 0));
                return {
                    ...prev,
                    [ply]: {
                        ...previousEntry,
                        multipv: currentList
                    }
                };
            });
        }
        if (payload.bestmove) {
            setRealtimeAnalysis(prev => {
                const previousEntry = prev[ply] || { ok: true };
                return {
                    ...prev,
                    [ply]: {
                        ...previousEntry,
                        bestmove: payload.bestmove,
                        multipv: previousEntry.multipv 
                    }
                };
            });
            es.close();
            if (eventSourceRef.current === es) {
                eventSourceRef.current = null;
                activeStreamPlyRef.current = null;
            }
        }
      } catch (e) {
        console.error("[Analysis] Parse error:", e);
      }
    };
    es.onerror = () => { 
        console.debug("[Analysis] Stream closed/ended (onerror)"); 
        es.close();
        if (eventSourceRef.current === es) {
            eventSourceRef.current = null;
            activeStreamPlyRef.current = null;
        }
    };
  }, []);

  const requestAnalysisForPly = useCallback((ply: number, options?: { force?: boolean }) => {
    if (options?.force) {
      setRealtimeAnalysis(prev => {
         const next = { ...prev };
         delete next[ply];
         return next;
      });
    }
    const command = getSubsetUSI(usi, ply);
    if (command) startEngineAnalysis(command, ply);
  }, [startEngineAnalysis, usi]);

  // ★連続検討のキモ: 局面が変わっても isAnalyzing が true なら新しい局面を解析しに行く
  useEffect(() => {
    if (isAnalyzing && !isEditMode) {
        const hasRealtimeResult = !!realtimeAnalysis[safeCurrentPly]?.bestmove;
        const isCurrentlyStreamingThis = activeStreamPlyRef.current === safeCurrentPly;
        
        // 解析済み(キャッシュあり)でなく、現在ストリーミング中でもない場合のみリクエスト
        if (!isCurrentlyStreamingThis && !hasRealtimeResult) {
             requestAnalysisForPly(safeCurrentPly);
        }
    }
  }, [safeCurrentPly, isAnalyzing, isEditMode, requestAnalysisForPly, usi, realtimeAnalysis]);

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
    if (isAnalyzing) { stopEngineAnalysis(); }
  }, [editHistory, safeCurrentPly, isAnalyzing, stopEngineAnalysis]);

  const handleBoardEdit = useCallback((next: BoardMatrix) => {
    if (!isEditMode) return;
    saveToHistory(displayedBoard, activeHands);
    setSnapshotOverrides((prev) => ({ ...prev, [safeCurrentPly]: cloneBoard(next) }));
    if (isAnalyzing) { stopEngineAnalysis(); }
  }, [isEditMode, safeCurrentPly, displayedBoard, activeHands, saveToHistory, isAnalyzing, stopEngineAnalysis]);

  const handleHandsEdit = useCallback((next: HandsState) => {
    if (!isEditMode) return;
    saveToHistory(displayedBoard, activeHands);
    setHandsOverrides((prev) => ({ ...prev, [safeCurrentPly]: next }));
    if (isAnalyzing) { stopEngineAnalysis(); }
  }, [isEditMode, safeCurrentPly, displayedBoard, activeHands, saveToHistory, isAnalyzing, stopEngineAnalysis]);

  // ★修正: 手数を変更したときの処理
  const handlePlyChange = useCallback((nextPly: number) => {
    if (isEditMode) return;
    
    // ここで stopEngineAnalysis() を呼んでしまうと「検討モード」自体がOFFになってしまうため削除。
    // 代わりに「通信だけ」を切断して、リソースを解放する。
    if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
    }
    activeStreamPlyRef.current = null;

    setPreviewSequence(null);
    setPreviewStep(0);
    setCurrentPly(clampIndex(nextPly, timeline.boards));
  }, [isEditMode, timeline.boards]);

  const goToStart = useCallback(() => {
      if (previewSequence) {
          setPreviewStep(0);
      } else {
          handlePlyChange(0);
      }
  }, [handlePlyChange, previewSequence]);

  const goToPrev = useCallback(() => {
      if (previewSequence) {
          setPreviewStep(p => Math.max(0, p - 1));
      } else {
          handlePlyChange(safeCurrentPly - 1);
      }
  }, [handlePlyChange, safeCurrentPly, previewSequence]);

  const goToNext = useCallback(() => {
      if (previewSequence) {
          setPreviewStep(p => Math.min(previewSequence.length, p + 1));
      } else {
          handlePlyChange(safeCurrentPly + 1);
      }
  }, [handlePlyChange, safeCurrentPly, previewSequence]);

  const goToEnd = useCallback(() => {
      if (previewSequence) {
          setPreviewStep(previewSequence.length);
      } else {
          handlePlyChange(maxPly);
      }
  }, [handlePlyChange, maxPly, previewSequence]);
  
  const navDisabled = isEditMode;
  const canGoPrev = previewSequence ? previewStep > 0 : safeCurrentPly > 0;
  const canGoNext = previewSequence ? previewStep < previewSequence.length : safeCurrentPly < maxPly;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditMode) return;
      if (e.key === "ArrowLeft") {
        goToPrev();
      } else if (e.key === "ArrowRight") {
        goToNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEditMode, goToPrev, goToNext]);

  const handleStartStreamingAnalysis = useCallback(() => {
    if (isEditMode || !timeline.boards.length) return;
    setIsAnalyzing(true);
    requestAnalysisForPly(safeCurrentPly, { force: true });
  }, [isEditMode, requestAnalysisForPly, safeCurrentPly, timeline.boards.length]);

  const handleStopAnalysis = useCallback(() => {
    stopEngineAnalysis();
  }, [stopEngineAnalysis]);

  const handleAnalyzeEditedPosition = useCallback(() => {
    if (!isEditMode) return;
    const sfenCommand = `position ${boardToSfen(displayedBoard, activeHands, currentSideToMove)}`;
    startEngineAnalysis(sfenCommand, safeCurrentPly);
    showToast({ title: "編集局面の解析を開始しました", variant: "default" });
  }, [isEditMode, displayedBoard, activeHands, currentSideToMove, safeCurrentPly, startEngineAnalysis]);

  const handleGenerateExplanation = useCallback(async () => {
    const currentSfen = isEditMode 
      ? `position ${boardToSfen(displayedBoard, activeHands, currentSideToMove)}`
      : getSubsetUSI(usi, safeCurrentPly);

    const analysis = evalSource[safeCurrentPly];
    if (!analysis || !analysis.bestmove) {
      showToast({ title: "先に解析を行ってください", variant: "default" });
      return;
    }
    const recentMoves = moveSequence.slice(Math.max(0, safeCurrentPly - 5), safeCurrentPly);

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
          pv: analysis.multipv?.[0]?.pv || "", turn: currentSideToMove, history: recentMoves 
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setExplanation(data.explanation);
    } catch {
      showToast({ title: "解説生成エラー", variant: "error" });
    } finally {
      setIsExplaining(false);
    }
  }, [evalSource, safeCurrentPly, usi, isEditMode, displayedBoard, activeHands, currentSideToMove, moveSequence]);

  const handleGenerateGameDigest = useCallback(async () => {
    const hasData = Object.keys(batchData).length > 0;
    if (!hasData) {
        showToast({ title: "先に全体解析を行ってください", variant: "default" });
        return;
    }
    setIsDigesting(true);
    setIsReportModalOpen(true);
    setGameDigest("");
    const evalList = [];
    for (let i = 0; i <= totalMoves; i++) {
        const score = getPrimaryEvalScore(batchData[i]);
        evalList.push(score || 0);
    }
    try {
        const res = await fetch(`${API_BASE}/api/explain/digest`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ total_moves: totalMoves, eval_history: evalList, winner: null }),
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setGameDigest(data.explanation);
    } catch {
        setGameDigest("レポート生成に失敗しました。");
    } finally {
        setIsDigesting(false);
    }
  }, [batchData, totalMoves]);

  const handleBatchAnalysisClick = useCallback(() => {
    if (isEditMode || isBatchAnalyzing) return;
    if (!timeline.boards.length) return;
    runBatchAnalysis(usi, totalMoves, moveSequence);
  }, [isEditMode, isBatchAnalyzing, timeline.boards.length, runBatchAnalysis, usi, totalMoves, moveSequence]);

  const handleLoadKifu = useCallback(() => {
    setErrorMessage("");
    if (!kifuText.trim()) return;
    try {
      const newUsi = toStartposUSI(kifuText);
      if (!newUsi) throw new Error("形式を認識できませんでした");
      setUsi(newUsi);
      showToast({ title: "読み込みました", variant: "default" });
      setIsModalOpen(false);
    } catch (e) { 
        setErrorMessage(String(e)); 
        showToast({ title: "エラー", description: String(e), variant: "error" });
    }
  }, [kifuText, setUsi]);

  const handleCandidateClick = useCallback((pvStr: string) => {
      const moves = pvStr.trim().split(/\s+/);
      if (moves.length === 0) return;
      setPreviewSequence(moves);
      setPreviewStep(1);
  }, []);

  useEffect(() => {
      return () => {
          if (eventSourceRef.current) {
              eventSourceRef.current.close();
          }
      };
  }, []);
  
  useEffect(() => {
    setCurrentPly(0);
    setRealtimeAnalysis({});
    setSnapshotOverrides({});
    setHandsOverrides({});
    setEditHistory([]);
    setExplanation("");
    setGameDigest("");
    setPreviewSequence(null);
    setPreviewStep(0);
    stopEngineAnalysis();
    resetBatchData(); 
  }, [stopEngineAnalysis, usi, resetBatchData]);

  useEffect(() => {
    if (isEditMode) {
      setEditHistory([]);
      setExplanation("");
      setPreviewSequence(null);
      setPreviewStep(0);
    } else {
      // 編集モードでない場合はここでは何もしない（継続解析のため）
      // ただし、「停止ボタン」を押したときは stopEngineAnalysis が呼ばれるのでOK
    }
  }, [isEditMode]);

  const moveImpacts = useMemo(() => buildMoveImpacts(evalSource, totalMoves, initialTurn), [evalSource, initialTurn, totalMoves]);
  
  const moveListEntries = useMemo(() => {
    if (!moveSequence.length) return [];
    return moveSequence.map((move, index) => {
      const ply = index + 1;
      const analysis = evalSource[ply];
      const score = analysis?.multipv?.[0]?.score;
      return {
        ply: ply,
        label: formatUsiMoveJapanese(move, timelinePlacedPieces[index] ?? [], index % 2 === 0 ? initialTurn : flipTurn(initialTurn)),
        diff: moveImpacts[index]?.diff ?? null,
        score: score
      };
    });
  }, [initialTurn, moveImpacts, moveSequence, timelinePlacedPieces, evalSource]);
  
  const evalPoints = useMemo(() => Array.from({ length: timeline.boards.length || totalMoves + 1 }, (_, ply) => ({ ply, cp: getPrimaryEvalScore(evalSource[ply]) })), [evalSource, timeline.boards.length, totalMoves]);

  const boardMode: BoardMode = isEditMode ? "edit" : "view";
  const topHandSide: Side = boardOrientation === "sente" ? "w" : "b";
  const bottomHandSide: Side = boardOrientation === "sente" ? "b" : "w";

  return (
    <div className="relative h-screen flex flex-col gap-4 p-4 text-[#1c1209] overflow-hidden bg-[#fbf7ef]">
      <div className="flex-none flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-sm relative z-10">
        <div className="flex items-center gap-4">
            <div className="text-sm font-bold text-slate-700">検討モード</div>
            <div className="text-xs text-slate-500">局面: {safeCurrentPly} / {maxPly}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsModalOpen(true)} className="border-slate-300 text-slate-700 h-8 text-xs cursor-pointer active:scale-95 transition-transform">
            <Upload className="w-3 h-3 mr-1" /> 棋譜読み込み
          </Button>
          {!isEditMode ? (
            <>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleBatchAnalysisClick} 
                disabled={isBatchAnalyzing} 
                className="border-slate-300 text-slate-700 h-8 text-xs relative overflow-hidden"
              >
                {isBatchAnalyzing && (
                  <span 
                    className="absolute left-0 top-0 bottom-0 bg-green-100 opacity-50 transition-all duration-300" 
                    style={{ width: `${batchProgress}%` }} 
                  />
                )}
                <span className="relative z-10">
                    {isBatchAnalyzing ? `解析中 ${batchProgress}%` : "全体解析"}
                </span>
              </Button>
              {Object.keys(batchData).length > 5 && (
                  <Button variant="outline" size="sm" onClick={handleGenerateGameDigest} className="border-amber-400 text-amber-700 bg-amber-50 h-8 text-xs">
                      <ScrollText className="w-3 h-3 mr-1" /> レポート
                  </Button>
              )}
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

      <div className="flex-1 flex flex-row gap-4 min-h-0 overflow-hidden relative z-0">
        <div className="flex-1 flex flex-col gap-4 overflow-y-auto min-w-[400px]">
          <div className="flex-none rounded-xl border border-slate-200 bg-[#f9f8f3] p-4 shadow-md flex flex-col items-center gap-4 relative" style={{ minHeight: "550px" }}>
            
            <div className="flex flex-col items-center justify-center w-full gap-2 mb-2">
                {previewSequence && (
                    <div className="bg-amber-100 text-amber-800 px-4 py-1.5 rounded-full flex items-center gap-3 animate-in fade-in slide-in-from-top-2 mb-1 shadow-sm border border-amber-200">
                        <div className="flex items-center gap-1.5 font-bold text-sm">
                            <Eye className="w-4 h-4" />
                            <span>読み筋を確認中: {previewStep}手目</span>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => { setPreviewSequence(null); setPreviewStep(0); }} className="h-6 text-xs hover:bg-amber-200 px-2 text-amber-900">
                            本譜に戻る
                        </Button>
                    </div>
                )}

                <div className="flex items-center justify-center gap-4">
                    <Button variant="outline" size="icon" className="w-8 h-8" onClick={goToStart} disabled={navDisabled || !canGoPrev}><ChevronFirst className="w-4 h-4"/></Button>
                    <Button variant="outline" size="icon" className="w-8 h-8" onClick={goToPrev} disabled={navDisabled || !canGoPrev}><ChevronLeft className="w-4 h-4"/></Button>
                    <Button variant="outline" size="icon" className="w-8 h-8" onClick={goToNext} disabled={navDisabled || !canGoNext}><ChevronRight className="w-4 h-4"/></Button>
                    <Button variant="outline" size="icon" className="w-8 h-8" onClick={goToEnd} disabled={navDisabled || !canGoNext}><ChevronLast className="w-4 h-4"/></Button>
                </div>
            </div>

            <div className="flex items-center justify-center w-full h-full">
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-4">
                    <HandsColumn side={topHandSide} hands={activeHands[topHandSide] ?? {}} orientationMode={orientationMode} align="start" />
                    <div className={`flex justify-center shadow-lg rounded-lg overflow-hidden border-4 transition-colors duration-300 ${previewSequence ? 'border-amber-500' : 'border-[#5d4037]'}`}>
                        <ShogiBoard
                        board={displayedBoard}
                        hands={activeHands}
                        mode={boardMode}
                        lastMove={isEditMode ? undefined : lastMoveCoords ?? undefined}
                        bestmove={bestmoveCoords}
                        orientationMode={orientationMode}
                        orientation={boardOrientation}
                        onBoardChange={isEditMode ? handleBoardEdit : undefined}
                        onHandsChange={isEditMode ? handleHandsEdit : undefined}
                        />
                    </div>
                    <HandsColumn side={bottomHandSide} hands={activeHands[bottomHandSide] ?? {}} orientationMode={orientationMode} align="end" />
                </div>
            </div>
          </div>
          {explanation && (
            <div className="flex-none p-4 bg-white rounded-xl border border-purple-200 shadow-sm animate-in fade-in slide-in-from-bottom-4">
                <div className="font-bold text-purple-700 mb-2 flex items-center gap-2 border-b border-purple-100 pb-2">
                    <Sparkles className="w-5 h-5 fill-purple-100"/> 将棋仙人の解説
                </div>
                <div className="prose prose-sm max-w-none text-slate-700 leading-relaxed whitespace-pre-wrap font-sans text-sm">
                    {explanation}
                </div>
            </div>
          )}
        </div>

        <div className="w-[300px] flex-none flex flex-col gap-2 h-full overflow-hidden border-x border-slate-100 px-2">
            <div className="text-sm font-bold text-slate-600 flex items-center gap-2 px-1">
                <BrainCircuit className="w-4 h-4" />
                AI解析 (候補手)
                {isAnalyzing && !hasCurrentAnalysis && <span className="text-[10px] text-green-600 animate-pulse ml-auto">思考中...</span>}
            </div>
            <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                {(showArrow && currentAnalysis?.multipv?.length) ? currentAnalysis.multipv.map((pv: EngineMultipvItem, idx: number) => {
                    const currentUsi = getSubsetUSI(usi, safeCurrentPly);
                    const firstMoveUSI = pv.pv?.split(" ")[0] || "";
                    const firstMoveLabel = formatUsiMoveJapanese(firstMoveUSI, currentPlacedPieces, currentSideToMove);
                    const fullPvLabel = convertFullPvToJapanese(currentUsi, pv.pv || "");
                    const isSelected = previewSequence && pv.pv === previewSequence.join(" ");
                    
                    return (
                    <div 
                        key={`${idx}-${pv.score.cp}`} 
                        onClick={() => handleCandidateClick(pv.pv || "")} 
                        className={`group p-3 rounded-xl border cursor-pointer transition-all shadow-sm ${isSelected ? 'border-amber-500 bg-amber-50 ring-1 ring-amber-500' : 'border-slate-200 bg-white hover:border-amber-400 hover:bg-amber-50'}`}
                    >
                        <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${idx === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>#{idx + 1}</span>
                                <span className="text-base font-bold text-slate-800">{firstMoveLabel}</span>
                            </div>
                            <span className={`text-sm font-mono font-bold ${pv.score.type === 'mate' ? 'text-rose-600' : ((pv.score.cp ?? 0) > 0 ? 'text-emerald-600' : 'text-slate-600')}`}>{formatScoreLabel(pv.score)}</span>
                        </div>
                        <div className="flex items-start gap-1 text-xs text-slate-400 group-hover:text-slate-600 bg-slate-50 p-1 rounded">
                            <ArrowRight className="w-3 h-3 mt-0.5 shrink-0" />
                            <span className="break-words leading-tight font-mono opacity-80">{fullPvLabel || pv.pv}</span>
                        </div>
                    </div>
                )}) : (
                    <div className="h-40 flex items-center justify-center text-slate-400 text-xs border-2 border-dashed border-slate-100 rounded-xl">
                        {isAnalyzing ? "解析中..." : "解析データなし"}
                    </div>
                )}
            </div>
        </div>

        <div className="w-[320px] flex-none flex flex-col gap-4 h-full overflow-hidden pl-1">
            <div className="flex-1 min-h-0 shadow-md border border-slate-300 rounded-xl overflow-hidden bg-white">
                <MoveListPanel entries={moveListEntries} activePly={safeCurrentPly} onSelectPly={handlePlyChange} className="h-full border-0 rounded-none" />
            </div>
            <div className="h-[180px] shrink-0 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
                <EvalGraph data={evalPoints} currentPly={safeCurrentPly} onPlyClick={handlePlyChange} />
            </div>
        </div>
      </div>
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="fixed z-50 left-1/2 top-1/2 w-[90vw] max-w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-0 shadow-2xl border border-slate-200 gap-0 [&>button]:hidden">
          <DialogHeader className="flex flex-row items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3 space-y-0">
            <div className="flex flex-col gap-0.5 text-left">
                <DialogTitle className="flex items-center gap-2 text-slate-700 text-base font-bold">
                <FileText className="w-4 h-4 text-slate-500" /> 棋譜読み込み
                </DialogTitle>
                <DialogDescription className="text-slate-500 text-xs">
                KIF, CSA, USI形式、またはSFEN
                </DialogDescription>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full" onClick={() => setIsModalOpen(false)}>
                <X className="w-4 h-4" />
            </Button>
          </DialogHeader>
          <div className="p-4 flex flex-col gap-4 bg-white">
            <Textarea 
              value={kifuText} 
              onChange={(e) => setKifuText(e.target.value)} 
              className="min-h-[200px] font-mono text-xs resize-none bg-white text-slate-900 border-slate-300 focus:border-slate-400 focus:ring-slate-200 placeholder:text-slate-400" 
              placeholder={`Example:\nposition startpos moves 7g7f 3c3d...`} 
            />
            {errorMessage && (
              <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200 font-bold">
                エラー: {errorMessage}
              </div>
            )}
          </div>
          <DialogFooter className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3 sm:justify-end">
            <Button variant="outline" onClick={() => setIsModalOpen(false)} className="text-slate-600 border-slate-300 bg-white hover:bg-slate-50">
              キャンセル
            </Button>
            <Button onClick={handleLoadKifu} className="bg-slate-800 hover:bg-slate-700 text-white shadow-sm">
              <Upload className="w-4 h-4 mr-2" /> 読み込む
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isReportModalOpen} onOpenChange={setIsReportModalOpen}>
        <DialogContent className="fixed z-50 left-1/2 top-1/2 w-[90vw] max-w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-0 shadow-2xl border border-slate-200 gap-0">
          <DialogHeader className="border-b border-purple-100 bg-purple-50 px-6 py-4">
            <DialogTitle className="flex items-center gap-2 text-purple-800 text-lg font-bold">
                <ScrollText className="w-5 h-5" /> 対局総評レポート
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 max-h-[60vh] overflow-y-auto">
            {isDigesting ? (
                <div className="flex flex-col items-center justify-center gap-4 py-10">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                    <p className="text-sm text-slate-500">将棋仙人が対局を振り返っています...</p>
                </div>
            ) : (
                <div className="prose prose-sm max-w-none text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {gameDigest}
                </div>
            )}
          </div>
          <DialogFooter className="border-t border-slate-100 bg-slate-50 px-6 py-3">
            <Button onClick={() => setIsReportModalOpen(false)}>閉じる</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}