"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useAnnotate, type EngineAnalyzeResponse, type EngineMultipvItem } from "@/lib/annotateHook";
import { toStartposUSI, splitKifGames } from "@/lib/ingest";
import { showToast } from "@/components/ui/toast";
import { ShogiBoard } from "@/components/ShogiBoard";
import { sfenToPlaced, usiMoveToCoords, formatUsiMoveJapanese, type Placed } from "@/lib/sfen";
import { Play, Square, RefreshCw, Upload, Clipboard, Settings, ChevronRight, ChevronDown, FileText } from "lucide-react";

// 棋神アナリティクス風レイアウト
// 左: 盤面
// 右: 解析情報 (MultiPV)
// 下: 棋譜リスト / 入力

export default function AnnotateView() {
  const { usi, setUsi, isPending: isStaticPending, data: staticData } = useAnnotate();
  const [pieces, setPieces] = useState<Placed[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamData, setStreamData] = useState<EngineAnalyzeResponse | null>(null);
  const [bestMoveCoords, setBestMoveCoords] = useState<{from:{x:number,y:number}, to:{x:number,y:number}} | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  
  // 棋譜入力用
  const [kifuText, setKifuText] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // USIが変更されたら盤面を更新
  useEffect(() => {
    try {
      // USIから現局面のSFENを取得する簡易ロジックが必要
      // ここでは簡易的に "startpos moves ..." を解析して最終局面のSFENを得る必要があるが、
      // クライアントサイドで完全な局面管理をするのは重いため、
      // 本来はバックエンドから局面SFENをもらうか、軽量なライブラリを使う。
      // 今回は sfenToPlaced が "startpos" か "sfen ..." しか受け付けないため、
      // 暫定的に "startpos" のみ表示し、movesがある場合は本当は局面を進める必要がある。
      // ★注意: クライアントサイドでUSI movesを再生するロジックが sfen.ts にはないため、
      // 暫定的に初期局面を表示するか、バックエンドのレスポンスに含まれるsfenを使う。
      // ここでは、解析結果(staticData/streamData)にsfenが含まれていればそれを使う方針にする。
      
      // とりあえず初期配置
      if (usi.startsWith("startpos") && !usi.includes("moves")) {
        setPieces(sfenToPlaced("startpos"));
      } else if (usi.startsWith("sfen")) {
        setPieces(sfenToPlaced(usi));
      }
      // movesがある場合は... 現状の sfen.ts では対応不可。
      // ユーザー体験向上のため、解析結果が返ってきたらそのSFENを使うようにする実装とする。
    } catch (e) {
      console.error(e);
    }
  }, [usi]);

  // 解析データが更新されたら盤面や矢印を更新
  const activeData = streamData || staticData;
  useEffect(() => {
    if (activeData?.bestmove) {
      setBestMoveCoords(usiMoveToCoords(activeData.bestmove));
    } else {
      setBestMoveCoords(null);
    }
    // もしバックエンドが sfen を返してくれるならここで setPieces する
    // activeData.sfen があると仮定したいが、型定義にはない。
  }, [activeData]);

  // ストリーミング制御
  const toggleStreaming = useCallback(() => {
    if (isStreaming) {
      // Stop
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      setIsStreaming(false);
    } else {
      // Start
      setIsStreaming(true);
      setStreamData(null);
      
      // SSE接続
      const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8787";
      // Fix: use position param instead of usi
      const url = `${API_BASE}/api/analysis/stream?position=${encodeURIComponent(usi)}`;
      
      const es = new EventSource(url);
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Fix: Update stream data (backend sends full list, so replacement is safe)
          setStreamData(data);
        } catch (e) {
          console.warn("SSE parse error", e);
        }
      };
      es.onerror = (err) => {
        // Fix: use console.warn to avoid Next.js error overlay
        console.warn("SSE error", err);
        es.close();
        setIsStreaming(false);
        showToast({ title: "ストリーミング切断", description: "接続が切れました", variant: "error" });
      };
      eventSourceRef.current = es;
    }
  }, [isStreaming, usi]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  // 棋譜読み込みハンドラ
  const handleLoadKifu = useCallback(() => {
    setErrorMessage("");
    if (!kifuText.trim()) return;
    try {
      const newUsi = toStartposUSI(kifuText);
      setUsi(newUsi);
      showToast({ title: "棋譜を読み込みました", variant: "success" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrorMessage(msg);
      showToast({ title: "読み込み失敗", description: msg, variant: "error" });
    }
  }, [kifuText, setUsi]);

  // 手番判定 (簡易: movesの数で判定)
  const getSideToMove = useCallback(() => {
    if (usi.includes("moves")) {
      const moves = usi.split("moves")[1].trim().split(" ").filter(m => m);
      return moves.length % 2 === 0 ? "b" : "w";
    }
    return "b"; // default startpos
  }, [usi]);

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] gap-4 p-4 max-w-[1600px] mx-auto">
      {/* Top Control Bar */}
      <div className="flex items-center justify-between bg-shogi-panel p-3 rounded-xl border border-white/10">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-shogi-gold">☗</span> 検討モード
          </h2>
          <div className="h-6 w-px bg-white/10" />
          <Button 
            onClick={toggleStreaming}
            variant={isStreaming ? "destructive" : "default"}
            className={`gap-2 ${isStreaming ? "" : "bg-blue-600 hover:bg-blue-500"}`}
          >
            {isStreaming ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            {isStreaming ? "検討停止" : "検討開始 (Stream)"}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-slate-400"><Settings className="w-4 h-4" /></Button>
        </div>
      </div>

      <div className="flex flex-1 gap-4 min-h-0">
        {/* Left: Board Area */}
        <div className="flex-none bg-[#2a2a2a] rounded-xl p-8 flex items-center justify-center shadow-inner border border-white/5">
          <ShogiBoard 
            pieces={pieces} 
            bestmove={bestMoveCoords}
            // onCellClick={(x,y) => console.log(x,y)}
          />
        </div>

        {/* Right: Analysis Panel */}
        <div className="flex-1 flex flex-col gap-4 min-w-[400px]">
          {/* Engine Status / Best Move */}
          <div className="bg-shogi-panel rounded-xl p-4 border border-white/10 shadow-lg">
            <div className="flex justify-between items-start mb-2">
              <div className="text-xs font-bold text-slate-500 uppercase">Best Move</div>
              {isStreaming && <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />}
            </div>
            <div className="text-4xl font-mono font-bold text-white mb-1">
              {activeData?.bestmove ? formatUsiMoveJapanese(activeData.bestmove, pieces, getSideToMove()) : "---"}
            </div>
            <div className="text-sm text-slate-400">
              {activeData?.multipv?.[0]?.score.type === "cp" 
                ? `評価値: ${activeData.multipv[0].score.cp}` 
                : activeData?.multipv?.[0]?.score.type === "mate"
                ? `詰み: ${activeData.multipv[0].score.mate}`
                : "解析待ち..."}
            </div>
          </div>

          {/* Candidates List */}
          <div className="flex-1 bg-shogi-panel rounded-xl border border-white/10 shadow-lg overflow-hidden flex flex-col">
            <div className="p-3 border-b border-white/10 bg-black/20 flex justify-between items-center">
              <span className="font-bold text-sm text-slate-300">候補手 (MultiPV)</span>
              <span className="text-xs text-slate-500">Depth: --</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {activeData?.multipv?.map((pv, idx) => {
                const moveUsi = pv.pv.split(" ")[0];
                const moveJp = formatUsiMoveJapanese(moveUsi, pieces, getSideToMove());
                return (
                  <div key={idx} className="bg-black/20 rounded-lg p-3 border border-white/5 hover:bg-white/5 transition-colors group">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-3">
                        <span className="bg-white/10 text-slate-300 text-xs font-mono px-1.5 py-0.5 rounded">#{pv.multipv}</span>
                        <span className="font-bold text-lg text-blue-400">{moveJp}</span>
                      </div>
                      <div className="font-mono font-bold">
                        {pv.score.type === "cp" ? (
                          <span className={pv.score.cp && pv.score.cp > 0 ? "text-green-400" : "text-red-400"}>
                            {pv.score.cp && pv.score.cp > 0 ? "+" : ""}{pv.score.cp}
                          </span>
                        ) : (
                          <span className="text-purple-400">Mate {pv.score.mate}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-slate-500 font-mono truncate group-hover:whitespace-normal group-hover:break-all">
                      {pv.pv}
                    </div>
                  </div>
                );
              })}
              {!activeData && (
                <div className="text-center text-slate-600 py-10">
                  解析データがありません
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: Kifu / Input */}
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
          <textarea 
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
            <div className="flex gap-2">
               <button className="hover:text-white"><Clipboard className="w-3 h-3" /></button>
               <button className="hover:text-white"><Upload className="w-3 h-3" /></button>
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
