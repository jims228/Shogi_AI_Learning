"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KifuPlayer } from "@/components/kifu/KifuPlayer";
import { ShogiBoard } from "@/components/ShogiBoard";
import type { OrientationMode } from "@/components/PieceSprite";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { showToast } from "@/components/ui/toast";
import { buildBoardTimeline, buildPositionFromUsi, boardToPlaced, getStartBoard, type BoardMatrix, type Side } from "@/lib/board";
import { toStartposUSI } from "@/lib/ingest";
import { formatUsiMoveJapanese, usiMoveToCoords } from "@/lib/sfen";
import { buildUsiPositionForPly } from "@/lib/usi";
import type { EngineAnalyzeResponse } from "@/lib/annotateHook";
import { Clipboard, FileText, Upload } from "lucide-react";

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

type AnalysisCache = Record<number, EngineAnalyzeResponse | undefined>;

const flipTurn = (side: Side): Side => (side === "b" ? "w" : "b");

const clampIndex = (index: number, boards: BoardMatrix[]): number => {
  if (!boards.length) return 0;
  return Math.max(0, Math.min(index, boards.length - 1));
};

export default function AnalysisTab({ usi, setUsi, orientationMode = "sprite" }: AnalysisTabProps) {
  const [currentPly, setCurrentPly] = useState(0);
  const [analysisByPly, setAnalysisByPly] = useState<AnalysisCache>({});
  const analysisCacheRef = useRef<AnalysisCache>({});
  const eventSourceRef = useRef<EventSource | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [kifuText, setKifuText] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const timeline = useMemo(() => {
    try {
      return buildBoardTimeline(usi);
    } catch (error) {
      console.warn("Failed to build analysis timeline", error);
      return { boards: [getStartBoard()], moves: [] };
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
    setIsAnalyzing(false);
  }, []);

  const startEngineAnalysis = useCallback((command: string, ply: number) => {
    if (!command) return;
    stopEngineAnalysis();
    const url = `${API_BASE}/api/analysis/stream?position=${encodeURIComponent(command)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;
    setIsAnalyzing(true);

    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as EngineAnalyzeResponse;
        analysisCacheRef.current[ply] = payload;
        setAnalysisByPly((prev) => ({ ...prev, [ply]: payload }));
      } catch (error) {
        console.warn("Failed to parse engine stream", error);
      }
    };

    es.onerror = (error) => {
      console.warn("Engine analysis stream error", error);
      stopEngineAnalysis();
    };
  }, [stopEngineAnalysis]);

  useEffect(() => {
    analysisCacheRef.current = {};
    setAnalysisByPly({});
    setCurrentPly(0);
    stopEngineAnalysis();
  }, [stopEngineAnalysis, usi]);

  useEffect(() => {
    setCurrentPly((prev) => clampIndex(prev, timeline.boards));
  }, [timeline.boards]);

  useEffect(() => {
    const cached = analysisCacheRef.current[currentPly];
    if (cached) {
      stopEngineAnalysis();
      return;
    }

    if (!timeline.boards.length) {
      stopEngineAnalysis();
      return;
    }

    const command = buildUsiPositionForPly(usi, currentPly);
    if (!command) {
      stopEngineAnalysis();
      return;
    }

    startEngineAnalysis(command, currentPly);

    return () => {
      stopEngineAnalysis();
    };
  }, [currentPly, startEngineAnalysis, stopEngineAnalysis, timeline.boards.length, usi]);

  useEffect(() => stopEngineAnalysis, [stopEngineAnalysis]);

  const currentAnalysis = analysisByPly[currentPly];
  const currentBoardIndex = clampIndex(currentPly, timeline.boards);
  const currentBoard = timeline.boards[currentBoardIndex] ?? getStartBoard();
  const currentPlacedPieces = useMemo(() => boardToPlaced(currentBoard), [currentBoard]);
  const currentSideToMove = useMemo(() => {
    let side = initialTurn;
    if (currentBoardIndex % 2 === 1) {
      side = flipTurn(side);
    }
    return side;
  }, [currentBoardIndex, initialTurn]);

  const renderBoard = useCallback((ply: number) => {
    if (!timeline.boards.length) return null;
    const clamped = clampIndex(ply, timeline.boards);
    const board = timeline.boards[clamped];
    const prevMove = clamped > 0 ? timeline.moves[clamped - 1] : null;
    const lastMove = prevMove ? usiMoveToCoords(prevMove) : null;
    const bestmove = analysisCacheRef.current[clamped]?.bestmove;
    const bestmoveCoords = bestmove ? usiMoveToCoords(bestmove) : null;

    return (
      <ShogiBoard
        key={clamped}
        board={board}
        mode="view"
        lastMove={lastMove ?? undefined}
        bestmove={bestmoveCoords ?? undefined}
        orientationMode={orientationMode}
      />
    );
  }, [orientationMode, timeline.boards, timeline.moves]);

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

  const currentMoveUsi = currentBoardIndex === 0 ? null : timeline.moves[currentBoardIndex - 1] ?? null;
  const currentMoveLabel = currentMoveUsi
    ? formatUsiMoveJapanese(currentMoveUsi, currentPlacedPieces, flipTurn(currentSideToMove))
    : "開始局面";

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex flex-1 gap-4 min-h-0">
        <div className="flex-none bg-[#2a2a2a] rounded-xl p-6 flex items-center justify-center shadow-inner border border-white/5">
          <div className="w-full">
            <KifuPlayer
              moves={timeline.moves}
              currentPly={currentPly}
              onPlyChange={setCurrentPly}
              renderBoard={renderBoard}
            />
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-4 min-w-[400px]">
          <div className="bg-shogi-panel rounded-xl p-4 border border-white/10 shadow-lg">
            <div className="flex justify-between items-start mb-2">
              <div className="text-xs font-bold text-slate-500 uppercase">Ply #{currentPly}</div>
              {isAnalyzing && !analysisCacheRef.current[currentPly] && (
                <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              )}
            </div>
            <div className="text-4xl font-mono font-bold text-white mb-1">
              {currentAnalysis?.bestmove
                ? formatUsiMoveJapanese(currentAnalysis.bestmove, currentPlacedPieces, currentSideToMove)
                : "---"}
            </div>
            <div className="text-sm text-slate-400">
              {currentAnalysis?.multipv?.[0]?.score
                ? currentAnalysis.multipv[0].score.type === "cp"
                  ? `評価値: ${currentAnalysis.multipv[0].score.cp ?? 0}`
                  : `詰み: ${currentAnalysis.multipv[0].score.mate ?? "?"}`
                : isAnalyzing
                  ? "解析中..."
                  : "エンジン結果なし"}
            </div>
          </div>

          <div className="flex-1 bg-shogi-panel rounded-xl border border-white/10 shadow-lg overflow-hidden flex flex-col">
            <div className="p-3 border-b border-white/10 bg-black/20 flex justify-between items-center">
              <span className="font-bold text-sm text-slate-300">候補手 (MultiPV)</span>
              <span className="text-xs text-slate-500">{currentMoveLabel}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {currentAnalysis?.multipv?.length ? (
                currentAnalysis.multipv.map((pv) => {
                  const moveUsi = pv.pv.split(" ")[0];
                  const moveJp = formatUsiMoveJapanese(moveUsi, currentPlacedPieces, currentSideToMove);
                  const scoreLabel = pv.score.type === "cp" ? pv.score.cp ?? 0 : pv.score.mate ?? 0;
                  const scoreClass = pv.score.type === "cp"
                    ? (pv.score.cp ?? 0) >= 0 ? "text-green-400" : "text-red-400"
                    : "text-purple-400";
                  return (
                    <div key={`${pv.multipv}-${moveUsi}`} className="bg-black/20 rounded-lg p-3 border border-white/5 hover:bg-white/5 transition-colors group">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-3">
                          <span className="bg-white/10 text-slate-300 text-xs font-mono px-1.5 py-0.5 rounded">#{pv.multipv}</span>
                          <span className="font-bold text-lg text-blue-400">{moveJp}</span>
                        </div>
                        <div className={`font-mono font-bold ${scoreClass}`}>
                          {pv.score.type === "cp" ? (pv.score.cp ?? 0) : `Mate ${scoreLabel}`}
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 font-mono truncate group-hover:whitespace-normal group-hover:break-all">
                        {pv.pv}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center text-slate-600 py-10">
                  {isAnalyzing ? "解析中..." : "解析データがありません"}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="h-48 bg-shogi-panel rounded-xl border border-white/10 flex overflow-hidden shadow-lg">
        <div className="w-1/3 border-r border-white/10 flex flex-col">
          <div className="p-2 bg-black/20 border-b border-white/10 text-xs font-bold text-slate-500 flex justify-between items-center">
            <span>棋譜入力 (KIF/CSA/USI)</span>
            <Button 
              size="sm" 
              variant="ghost" 
              className="h-6 text-xs hover:bg-white/10 text-blue-400"
              onClick={handleLoadKifu}
            >
              <FileText className="w-3 h-3 mr-1" />
              読み込み
            </Button>
          </div>
          <Textarea 
            value={kifuText}
            onChange={(e) => setKifuText(e.target.value)}
            className="flex-1 bg-transparent border-none resize-none font-mono text-xs p-3 focus:outline-none text-slate-200 placeholder:text-slate-600"
            placeholder="ここに KIF / CSA / USI を貼り付けてください"
          />
          {errorMessage && (
            <div className="p-2 bg-red-900/50 text-red-200 text-xs border-t border-red-500/30">
              {errorMessage}
            </div>
          )}
        </div>
        <div className="flex-1 flex flex-col">
          <div className="p-2 bg-black/20 border-b border-white/10 text-xs font-bold text-slate-500 flex justify-between">
            <span>棋譜リスト</span>
            <div className="flex gap-2 text-slate-400">
              <button className="hover:text-white" type="button"><Clipboard className="w-3 h-3" /></button>
              <button className="hover:text-white" type="button"><Upload className="w-3 h-3" /></button>
            </div>
          </div>
          <div className="flex-1 p-4 text-slate-400 text-sm flex items-center justify-center">
            (棋譜リスト機能は実装中です)
          </div>
        </div>
      </div>
    </div>
  );
}
