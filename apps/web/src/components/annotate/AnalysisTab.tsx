"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KifuPlayer } from "@/components/kifu/KifuPlayer";
import { ShogiBoard } from "@/components/ShogiBoard";
import type { OrientationMode } from "@/components/PieceSprite";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { showToast } from "@/components/ui/toast";
import {
  boardToPlaced,
  buildBoardTimeline,
  buildPositionFromUsi,
  getStartBoard,
  type BoardMatrix,
  type HandsState,
  type Side,
} from "@/lib/board";
import { toStartposUSI } from "@/lib/ingest";
import { formatUsiMoveJapanese, usiMoveToCoords } from "@/lib/sfen";
import { buildUsiPositionForPly } from "@/lib/usi";
import type { EngineAnalyzeResponse, EngineMultipvItem } from "@/lib/annotateHook";
import {
  AnalysisCache,
  buildMoveImpacts,
  getPrimaryEvalScore,
} from "@/lib/analysisUtils";
import { FileText } from "lucide-react";
import MoveListPanel from "@/components/annotate/MoveListPanel";
import MoveQualityPanel from "@/components/annotate/MoveQualityPanel";
import EvalGraph from "@/components/annotate/EvalGraph";
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
  elapsed_ms?: number;
  analyzed_plies?: number;
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

export default function AnalysisTab({ usi, setUsi, orientationMode = "sprite" }: AnalysisTabProps) {
  const [currentPly, setCurrentPly] = useState(0);
  const [analysisByPly, setAnalysisByPly] = useState<AnalysisCache>({});
  const eventSourceRef = useRef<EventSource | null>(null);
  const activeStreamPlyRef = useRef<number | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isBatchAnalyzing, setIsBatchAnalyzing] = useState(false);
  const [kifuText, setKifuText] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

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
      console.warn("Failed to parse USI for analysis", error);
      return { board: getStartBoard(), moves: [], turn: "b" as Side };
    }
  }, [usi]);

  const initialTurn = useMemo(() => {
    const moveCount = parsedPosition.moves.length;
    return moveCount % 2 === 0 ? parsedPosition.turn : flipTurn(parsedPosition.turn);
  }, [parsedPosition.moves.length, parsedPosition.turn]);

  const stopEngineAnalysis = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    activeStreamPlyRef.current = null;
    setIsStreaming(false);
  }, []);

  useEffect(() => {
    setCurrentPly(0);
    setAnalysisByPly({});
    setErrorMessage("");
    setIsAnalyzing(false);
    stopEngineAnalysis();
  }, [stopEngineAnalysis, usi]);

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

  useEffect(() => stopEngineAnalysis, [stopEngineAnalysis]);

  const safeCurrentPly = useMemo(
    () => clampIndex(currentPly, timeline.boards),
    [currentPly, timeline.boards],
  );

  const fallbackHands = useMemo<HandsState>(() => ({ b: {}, w: {} }), []);
  const timelineHands = useMemo<HandsState[]>(() => timeline.hands ?? [], [timeline.hands]);

  const timelinePlacedPieces = useMemo(() => {
    if (!timeline.boards.length) {
      return [boardToPlaced(getStartBoard())];
    }
    return timeline.boards.map((board) => boardToPlaced(board));
  }, [timeline.boards]);

  const currentBoard = timeline.boards[safeCurrentPly] ?? getStartBoard();
  const currentAnalysis = analysisByPly[safeCurrentPly];
  const hasCurrentAnalysis = Boolean(currentAnalysis);
  const currentPlacedPieces = useMemo(() => boardToPlaced(currentBoard), [currentBoard]);
  const currentSideToMove = useMemo(() => {
    let side = initialTurn;
    if (safeCurrentPly % 2 === 1) {
      side = flipTurn(side);
    }
    return side;
  }, [safeCurrentPly, initialTurn]);

  useEffect(() => {
    if (!isAnalyzing) return;
    if (!timeline.boards.length) return;
    if (analysisByPly[safeCurrentPly]) return;
    if (activeStreamPlyRef.current === safeCurrentPly && isStreaming) return;
    requestAnalysisForPly(safeCurrentPly);
  }, [analysisByPly, isAnalyzing, isStreaming, requestAnalysisForPly, safeCurrentPly, timeline.boards.length]);

  const renderBoard = useCallback(
    (ply: number) => {
      if (!timeline.boards.length) return null;
      const clamped = clampIndex(ply, timeline.boards);
      const board = timeline.boards[clamped];
      const prevMove = clamped > 0 ? timeline.moves[clamped - 1] : null;
      const lastMove = prevMove ? usiMoveToCoords(prevMove) : null;
      const bestmove = analysisByPly[clamped]?.bestmove;
      const bestmoveCoords = bestmove ? usiMoveToCoords(bestmove) : null;
      const hands = timelineHands[clamped] ?? fallbackHands;

      return (
        <ShogiBoard
          key={clamped}
          board={board}
          hands={hands}
          mode="view"
          lastMove={lastMove ?? undefined}
          bestmove={bestmoveCoords ?? undefined}
          orientationMode={orientationMode}
        />
      );
    },
    [analysisByPly, fallbackHands, orientationMode, timeline.boards, timelineHands, timeline.moves],
  );

  const handlePlyChange = useCallback(
    (nextPly: number) => {
      setCurrentPly(clampIndex(nextPly, timeline.boards));
    },
    [timeline.boards],
  );

  const handleStartAnalysis = useCallback(() => {
    if (!timeline.boards.length) return;
    setIsAnalyzing(true);
    requestAnalysisForPly(safeCurrentPly, { force: true });
  }, [requestAnalysisForPly, safeCurrentPly, timeline.boards.length]);

  const handleStopAnalysis = useCallback(() => {
    setIsAnalyzing(false);
    stopEngineAnalysis();
  }, [stopEngineAnalysis]);

  const handleBatchAnalysis = useCallback(async () => {
    if (isBatchAnalyzing) return;
    if (!timeline.boards.length) {
      showToast({ title: "棋譜が読み込まれていません", variant: "warning" });
      return;
    }

    setIsBatchAnalyzing(true);
    try {
      const fullPosition = buildUsiPositionForPly(usi, timeline.moves.length) || usi;
      const response = await fetch(`${API_BASE}/api/analysis/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usi: fullPosition,
          movetime_ms: 250,
          multipv: 3,
          time_budget_ms: 30000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "全体解析APIエラー");
      }

      const payload = (await response.json()) as BatchAnalysisResponsePayload;
      if (payload?.analyses) {
        setAnalysisByPly((prev) => {
          const next = { ...prev } as AnalysisCache;
          Object.entries(payload.analyses as Record<string, EngineAnalyzeResponse>).forEach(
            ([key, value]) => {
              const plyIndex = Number(key);
              if (Number.isNaN(plyIndex)) return;
              next[plyIndex] = value;
            },
          );
          return next;
        });
      }

      const elapsedSeconds = payload?.elapsed_ms ? Math.round(payload.elapsed_ms / 1000) : null;
      showToast({
        title: "全体解析が完了しました",
        description: elapsedSeconds ? `${elapsedSeconds}秒で完了しました` : undefined,
        variant: "success",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showToast({ title: "全体解析に失敗しました", description: message, variant: "error" });
    } finally {
      setIsBatchAnalyzing(false);
    }
  }, [isBatchAnalyzing, timeline.boards.length, timeline.moves.length, usi]);

  const handleLoadKifu = useCallback(() => {
    setErrorMessage("");
    if (!kifuText.trim()) return;
    try {
      const newUsi = toStartposUSI(kifuText);
      setUsi(newUsi);
      showToast({ title: "棋譜を読み込みました", variant: "success" });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setErrorMessage(msg);
      showToast({ title: "読み込み失敗", description: msg, variant: "error" });
    }
  }, [kifuText, setUsi]);

  const currentMoveUsi = safeCurrentPly === 0 ? null : timeline.moves[safeCurrentPly - 1] ?? null;
  const currentMoveLabel = currentMoveUsi
    ? formatUsiMoveJapanese(currentMoveUsi, currentPlacedPieces, flipTurn(currentSideToMove))
    : "開始局面";

  const primaryPv = currentAnalysis?.multipv?.[0];
  const primaryScoreLabel = primaryPv ? formatScoreLabel(primaryPv.score) : null;
  const primaryDepthLabel = formatDepthLabel(primaryPv?.depth);

  const moveImpacts = useMemo(
    () => buildMoveImpacts(analysisByPly, timeline.moves.length, initialTurn),
    [analysisByPly, initialTurn, timeline.moves.length],
  );

  const moveListEntries = useMemo(() => {
    if (!timeline.moves.length) return [];
    return timeline.moves.map((move, index) => {
      const pieces = timelinePlacedPieces[index] ?? timelinePlacedPieces[0] ?? [];
      const sideToMove = index % 2 === 0 ? initialTurn : flipTurn(initialTurn);
      const readableMove = formatUsiMoveJapanese(move, pieces, sideToMove);
      return {
        ply: index + 1,
        label: readableMove,
        diff: moveImpacts[index]?.diff ?? null,
      };
    });
  }, [initialTurn, moveImpacts, timeline.moves, timelinePlacedPieces]);

  const moveQualityItems = useMemo(
    () => moveListEntries.map((entry) => ({ ply: entry.ply, moveLabel: entry.label, diff: entry.diff })),
    [moveListEntries],
  );

  const evalPoints = useMemo(() => {
    const boardCount = timeline.boards.length || timeline.moves.length + 1;
    return Array.from({ length: boardCount }, (_, ply) => ({
      ply,
      cp: getPrimaryEvalScore(analysisByPly[ply]),
    }));
  }, [analysisByPly, timeline.boards.length, timeline.moves.length]);

  return (
    <div className="space-y-6 text-[#1c1209]">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-black/10 bg-[#fbf7ef] p-4 md:p-5">
        <div className="text-sm font-semibold text-[#2b1c10]">検討モード</div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleBatchAnalysis}
            disabled={isBatchAnalyzing}
            className="border-black/20 text-slate-900 hover:bg-amber-50"
          >
            {isBatchAnalyzing ? "全体解析中…" : "全体解析(高速)"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleStartAnalysis}
            disabled={isAnalyzing}
            className="border-black/20 text-slate-900 hover:bg-amber-50"
          >
            検討開始(Stream)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleStopAnalysis}
            disabled={!isAnalyzing}
            className="border-black/20 text-slate-900 hover:bg-rose-50"
          >
            停止
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-6 xl:flex-row">
        <div className="flex-1 space-y-4">
          <div className="space-y-4 rounded-3xl border border-black/10 bg-white/90 p-4 shadow-[0_15px_30px_rgba(0,0,0,0.12)] md:p-6">
            <div className="flex items-center justify-between text-sm text-[#2b1c10]">
              <span>局面プレイヤー</span>
              <span>Ply #{safeCurrentPly}</span>
            </div>
            <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
              <KifuPlayer
                moves={timeline.moves}
                currentPly={safeCurrentPly}
                onPlyChange={handlePlyChange}
                renderBoard={renderBoard}
              />
            </div>
          </div>

          <div className="rounded-3xl border border-black/10 bg-[#f9f3e5]/95 p-4 shadow-[0_10px_20px_rgba(0,0,0,0.1)]">
            <div className="flex justify-between items-center mb-2 text-xs text-[#7a5f36]">
              <span>候補手</span>
              {isAnalyzing && !hasCurrentAnalysis && (
                <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              )}
            </div>
            <div className="text-3xl font-serif text-[#3a2b17]">
              {currentAnalysis?.bestmove
                ? formatUsiMoveJapanese(currentAnalysis.bestmove, currentPlacedPieces, currentSideToMove)
                : "---"}
            </div>
            <p className="text-sm text-[#555] mt-1 flex items-center gap-3">
              {primaryScoreLabel ? `評価値: ${primaryScoreLabel}` : isAnalyzing ? "解析中..." : "エンジン結果なし"}
              {primaryDepthLabel && <span className="text-xs text-[#7a5f36]">{primaryDepthLabel}</span>}
            </p>
          </div>

          <div className="rounded-3xl border border-black/10 bg-[#f9f3e5]/95 p-4 shadow-[0_10px_20px_rgba(0,0,0,0.1)] max-h-[420px] overflow-y-auto space-y-3">
            <div className="flex items-center justify-between text-sm text-[#555]">
              <span>MultiPV 候補</span>
              <span className="text-xs">{currentMoveLabel}</span>
            </div>
            {currentAnalysis?.multipv?.length ? (
              currentAnalysis.multipv.map((pv) => {
                const pvSequence = pv.pv?.trim() ?? "";
                const moveUsi = pvSequence.split(" ")[0] || pvSequence || currentAnalysis?.bestmove || "";
                const moveJp = moveUsi
                  ? formatUsiMoveJapanese(moveUsi, currentPlacedPieces, currentSideToMove)
                  : "---";
                const scoreValue = pv.score.type === "cp" ? pv.score.cp ?? 0 : pv.score.mate ?? 0;
                const scoreClass = pv.score.type === "cp"
                  ? scoreValue >= 0
                    ? "text-emerald-600"
                    : "text-rose-500"
                  : "text-indigo-600";
                const depthLabel = formatDepthLabel(pv.depth);
                const scoreLabel = formatScoreLabel(pv.score);
                return (
                  <div key={`${pv.multipv}-${moveUsi}`} className="rounded-xl border border-black/10 bg-white p-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="bg-amber-100 text-[#3a2b17] text-xs font-mono px-2 py-0.5 rounded-full">#{pv.multipv}</span>
                        <span className="font-semibold text-lg text-[#3a2b17]">{moveJp}</span>
                      </div>
                      <div className="flex flex-col items-end text-right">
                        <span className={`font-mono font-bold ${scoreClass}`}>{scoreLabel}</span>
                        {depthLabel && <span className="text-[10px] text-[#7a5f36]">{depthLabel}</span>}
                      </div>
                    </div>
                    <div className="text-xs text-[#555] font-mono mt-1 break-all">{pv.pv}</div>
                  </div>
                );
              })
            ) : (
              <div className="text-center text-[#555] py-6 border border-dashed border-slate-300 rounded-xl bg-white/70">
                {isAnalyzing ? "解析中..." : "解析データがありません"}
              </div>
            )}
          </div>

          <div className="flex flex-col rounded-3xl border border-black/10 bg-[#f9f3e5]/95 shadow-[0_10px_20px_rgba(0,0,0,0.1)]">
            <div className="p-3 border-b border-black/10 text-xs font-bold text-[#7a5f36] flex justify-between items-center">
              <span>棋譜入力 (KIF/CSA/USI)</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs text-[#7a5f36] hover:bg-amber-50"
                onClick={handleLoadKifu}
              >
                <FileText className="w-3 h-3 mr-1 text-[#555]" />
                読み込み
              </Button>
            </div>
            <Textarea
              value={kifuText}
              onChange={(e) => setKifuText(e.target.value)}
              className="flex-1 border-none bg-white/80 p-3 text-xs font-mono text-slate-900 focus:ring-0"
              placeholder="ここに KIF / CSA / USI を貼り付けてください"
            />
            {errorMessage && (
              <div className="p-2 bg-rose-100 text-rose-700 text-xs border-t border-rose-200">{errorMessage}</div>
            )}
          </div>
        </div>

        <div className="w-full xl:w-[360px] flex flex-col gap-4">
          <EvalGraph data={evalPoints} currentPly={safeCurrentPly} />
          <MoveListPanel
            entries={moveListEntries}
            activePly={safeCurrentPly}
            onSelectPly={handlePlyChange}
          />
          <MoveQualityPanel items={moveQualityItems} />
        </div>
      </div>
    </div>
  );
}
