"use client";
import React, { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useAnnotate, useGameAnalysis, type AnnotationNote, type DigestResponse, type KeyMoment, type EngineAnalyzeResponse, type EngineMultipvItem, type AnalyzeGameMove } from "@/lib/annotateHook";
import { toStartposUSI, splitKifGames } from "@/lib/ingest";
import { showToast } from "@/components/ui/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button as SmallButton } from "@/components/ui/button";
import { KifuPlayer, type KifuPlayerRef } from "@/components/kifu/KifuPlayer";
import { Board } from "@/components/Board";
import { usiToMoves } from "@/lib/usi";

import { Copy, Zap, FolderOpen } from "lucide-react";

// This file extracts the AnnotateView UI so the root page can be a homepage.
export default function AnnotateView() {
  // reuse existing hook from lib (kept minimal)
  const { usi, setUsi, submit, isPending, data, localError, downloadCsv, checkHealth } = useAnnotate();
  const { analysis, isPending: analysisLoading, error: analysisError, analyzeGame } = useGameAnalysis();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const kifuPlayerRef = useRef<KifuPlayerRef | null>(null);
  const [kifGames, setKifGames] = useState<string[] | null>(null);
  const [gameDialogOpen, setGameDialogOpen] = useState(false);
  const [selectedGameIndex, setSelectedGameIndex] = useState(0);
  const [digest, setDigest] = useState<DigestResponse | null>(null);
  const [digestPending, setDigestPending] = useState(false);
  const [batchPending, setBatchPending] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);

  // 棋譜再生用のボード表示関数
  const renderBoard = React.useCallback((_ply: number) => {
    // 簡易実装：現時点では初期局面のみ表示
    // 実際の手順実行は今後の機能拡張で実装
    try {
      // const _moves = usiToMoves(usi);
      // 初期局面の盤面を表示
      const initialBoard = [
        // 後手の駒
        { piece: "l" as const, x: 0, y: 0 }, { piece: "n" as const, x: 1, y: 0 }, { piece: "s" as const, x: 2, y: 0 }, 
        { piece: "g" as const, x: 3, y: 0 }, { piece: "k" as const, x: 4, y: 0 }, { piece: "g" as const, x: 5, y: 0 }, 
        { piece: "s" as const, x: 6, y: 0 }, { piece: "n" as const, x: 7, y: 0 }, { piece: "l" as const, x: 8, y: 0 },
        { piece: "r" as const, x: 1, y: 1 }, { piece: "b" as const, x: 7, y: 1 },
        ...Array.from({length: 9}, (_, i) => ({ piece: "p" as const, x: i, y: 2 })),
        
        // 先手の駒
        ...Array.from({length: 9}, (_, i) => ({ piece: "P" as const, x: i, y: 6 })),
        { piece: "B" as const, x: 1, y: 7 }, { piece: "R" as const, x: 7, y: 7 },
        { piece: "L" as const, x: 0, y: 8 }, { piece: "N" as const, x: 1, y: 8 }, { piece: "S" as const, x: 2, y: 8 }, 
        { piece: "G" as const, x: 3, y: 8 }, { piece: "K" as const, x: 4, y: 8 }, { piece: "G" as const, x: 5, y: 8 }, 
        { piece: "S" as const, x: 6, y: 8 }, { piece: "N" as const, x: 7, y: 8 }, { piece: "L" as const, x: 8, y: 8 }
      ];
      
      return <Board pieces={initialBoard} />;
    } catch (error) {
      console.error("Failed to render board:", error);
      return <div className="p-4 text-center text-muted-foreground">盤面を表示できません</div>;
    }
  }, [usi]);

  function handlePickFile() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    try {
      const games = splitKifGames(text);
      if (games.length > 1) {
        setKifGames(games);
        setSelectedGameIndex(0);
        setGameDialogOpen(true);
      } else {
        const usiText = toStartposUSI(text);
        setUsi(usiText);
      }
          } catch (err) {
            showToast({ title: "読み込み失敗", description: String(err ?? ""), variant: "error" });
    } finally {
      e.target.value = "";
    }
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
  }

  async function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    const text = await f.text();
    try {
      const games = splitKifGames(text);
      if (games.length > 1) {
        setKifGames(games);
        setSelectedGameIndex(0);
        setGameDialogOpen(true);
      } else {
        const usiText = toStartposUSI(text);
        setUsi(usiText);
      }
    } catch (err) {
      showToast({ title: "読み込み失敗", description: String(err ?? ""), variant: "error" });
    }
  }

  async function handlePasteAsGame() {
    const text = await navigator.clipboard.readText().catch(() => "");
    if (!text) {
      showToast({ title: "クリップボードにテキストがありません。", variant: "warning" });
      return;
    }
    try {
      const usiText = toStartposUSI(text);
      setUsi(usiText);
    } catch (err) {
      showToast({ title: "貼り付け解析に失敗しました", description: (err as Error).message, variant: "error" });
    }
  }

  async function handleBatchAnnotate() {
    setBatchPending(true);
    try {
      const response = await fetch("/api/backend/ingest/annotate/folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recursive: true,
          byoyomi_ms: 250
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        showToast({
          title: "フォルダ注釈完了",
          description: `${result.annotated}件のファイルを処理しました (スキャン: ${result.scanned}件、エラー: ${result.errors}件)`,
          variant: "success"
        });
      } else {
        showToast({
          title: "フォルダ注釈で一部エラー",
          description: `${result.annotated}件成功、${result.errors}件エラー`,
          variant: "warning"
        });
      }
    } catch (err) {
      showToast({
        title: "フォルダ注釈失敗",
        description: String(err),
        variant: "error"
      });
    } finally {
      setBatchPending(false);
    }
  }

  return (
    <Card className="mt-4 p-4 rounded-2xl shadow-soft max-w-3xl mx-auto">
      <div className="space-y-3">
        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className="rounded border-2 border-dashed p-1"
          title="ここにKIF/CSA/USIファイルをドロップできます"
        >
          <Textarea
            value={usi}
            onChange={(e) => setUsi(e.target.value)}
            onPaste={async (e) => {
              try {
                const pasted = e.clipboardData?.getData("text") || "";
                if (!pasted) return;
                // if it's already USI, keep it
                if (pasted.trim().startsWith("startpos") || pasted.trim().startsWith("sfen")) return;
                const games = splitKifGames(pasted);
                if (games.length > 1) {
                  setKifGames(games);
                  setSelectedGameIndex(0);
                  setGameDialogOpen(true);
                  return;
                }
                const usiText = toStartposUSI(pasted);
                setUsi(usiText);
              } catch (err) {
                showToast({ title: "貼り付け解析に失敗しました", description: String(err ?? ""), variant: "error" });
              }
            }}
            onBlur={(e) => {
              const txt = e.currentTarget.value || "";
              if (!txt.trim()) return;
              if (txt.trim().startsWith("startpos") || txt.trim().startsWith("sfen")) return;
              try {
                const usiText = toStartposUSI(txt);
                setUsi(usiText);
              } catch {
                // ignore on blur unless needed
              }
            }}
            className="font-mono min-h-28"
            placeholder='USI棋譜を貼り付（Ctrl/⌘+Enter で実行）'
          />
        </div>
          <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" className="rounded-2xl" onClick={() => setUsi("startpos moves 7g7f 3c3d 2g2f 8c8d")}>サンプル（USI）</Button>
          <Button onClick={submit} disabled={isPending} className="rounded-2xl">{isPending ? "注釈生成中…" : "注釈を生成"}</Button>
          <button className="border px-3 py-1 rounded-2xl" onClick={handlePickFile}>ファイル読込（KIF/CSA/USI）</button>
          <button className="border px-3 py-1 rounded-2xl bg-blue-50 hover:bg-blue-100 text-blue-700" onClick={handleBatchAnnotate} disabled={batchPending}>
            <FolderOpen className="inline-block w-4 h-4 mr-1" />
            {batchPending ? "処理中..." : "フォルダから一括注釈 (dev)"}
          </button>

          <button className="border px-3 py-1 rounded-2xl" onClick={async () => {
            const st = await checkHealth();
            showToast({ title: "Engine health", description: st, variant: st === "ok" ? "success" : "warning" });
          }}>エンジン /health 確認</button>

          <button className="border px-3 py-1 rounded-2xl" onClick={handlePasteAsGame}>クリップボードから貼り付け解析</button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".kif,.kifu,.csa,.txt,.usi"
            className="hidden"
            onChange={handleFileChange}
          />
            <Dialog open={gameDialogOpen} onOpenChange={setGameDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>複数局のKIFが検出されました</DialogTitle>
                  <DialogDescription>読み込まれたファイルには複数の対局が含まれています。採用するゲームを選んでください。</DialogDescription>
                </DialogHeader>
                <div className="mt-3 space-y-2 max-h-72 overflow-auto">
                  {(kifGames || []).map((g, idx) => (
                    <div key={idx} className={`p-2 border rounded cursor-pointer ${selectedGameIndex===idx? 'bg-slate-100': ''}`} role="listitem" tabIndex={0} onClick={() => setSelectedGameIndex(idx)}>
                      <div className="font-mono text-sm">{(g||'').slice(0,60).replace(/\n/g,' / ')}</div>
                      <div className="text-xs text-muted-foreground">{g.split('\n').length} 行</div>
                    </div>
                  ))}
                </div>
                <DialogFooter>
                  <div className="flex gap-2">
                    <SmallButton onClick={() => { setGameDialogOpen(false); setKifGames(null); }}>キャンセル</SmallButton>
                    <SmallButton onClick={() => {
                      const g = (kifGames || [])[selectedGameIndex];
                        if (g) {
                        try {
                          const usiText = toStartposUSI(g);
                          setUsi(usiText);
                        } catch (err) {
                          showToast({ title: "読み込み失敗", description: (err as Error).message, variant: "error" });
                        }
                      }
                      setGameDialogOpen(false);
                      setKifGames(null);
                    }}>選択して反映</SmallButton>
                  </div>
                </DialogFooter>
                <DialogClose />
              </DialogContent>
            </Dialog>
          <Button variant="outline" onClick={async () => {
            setDigestPending(true);
              try {
                const DIGEST_BASE = process.env.NEXT_PUBLIC_ENGINE_URL || process.env.ENGINE_URL || "http://localhost:8001";
                const url = `${DIGEST_BASE}/digest`;
                // eslint-disable-next-line no-console
                console.log("[web] digest fetch to:", url);
                const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ usi, time_budget_ms: 10000 }),
              });
              if (!res.ok) throw new Error(await res.text());
              const json = await res.json();
              setDigest(json);
            } catch (e) {
              setDigest({ error: String(e) });
            } finally {
              setDigestPending(false);
            }
          }} disabled={digestPending} className="rounded-2xl">{digestPending ? "解析中…" : "10秒ダイジェスト"}</Button>
          
          <Button variant="outline" onClick={() => analyzeGame(usi, "sente", 10)} disabled={analysisLoading} className="rounded-2xl bg-purple-50 hover:bg-purple-100">
            {analysisLoading ? "棋譜解析中…" : "棋譜全体解析"}
          </Button>
        </div>
        {localError && <p className="text-sm text-red-600 mt-2">エラー: {localError}</p>}
        {data && !data.ok && (
          <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded">
            <p className="text-sm text-red-600">エンジンエラー: {data.error || "不明なエラー"}</p>
            {data.detail && <p className="text-xs text-red-500 mt-1">{data.detail}</p>}
          </div>
        )}
        {data && data.ok && (
          <div className="mt-4">
            <Card className="p-4">
              <h3 className="font-semibold text-lg mb-3">注釈結果（エンジン解析）</h3>
              
              {/* Bestmove */}
              <div className="mb-4">
                <div className="text-sm font-medium text-muted-foreground">最善手</div>
                <div className="font-mono text-lg font-bold text-blue-700">{data.bestmove || "—"}</div>
              </div>

              {/* MultiPV candidates */}
              {data.multipv && data.multipv.length > 0 && (
                <div className="mb-4">
                  <div className="text-sm font-medium text-muted-foreground mb-2">候補手（MultiPV）</div>
                  <div className="space-y-2">
                    {data.multipv.map((item: EngineMultipvItem, idx: number) => (
                      <div key={idx} className="border rounded p-3 bg-gray-50">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-mono text-sm font-medium">#{item.multipv}</div>
                          <div className="text-sm">
                            {item.score.type === "cp" && (
                              <span className={item.score.cp && item.score.cp > 0 ? "text-green-700 font-semibold" : item.score.cp && item.score.cp < 0 ? "text-red-700 font-semibold" : "text-gray-700"}>
                                {item.score.cp !== undefined ? (item.score.cp > 0 ? `+${item.score.cp}` : String(item.score.cp)) : "0"} cp
                              </span>
                            )}
                            {item.score.type === "mate" && (
                              <span className="text-purple-700 font-semibold">
                                詰み {item.score.mate !== undefined ? `${item.score.mate}手` : ""}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="font-mono text-xs bg-white p-2 rounded border">
                          <div className="text-muted-foreground mb-1">PV:</div>
                          <div className="whitespace-pre-wrap break-all">{item.pv || "—"}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Raw logs (collapsible) */}
              {data.raw && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">エンジン生ログを表示</summary>
                  <div className="mt-2 font-mono text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-auto max-h-96">
                    <pre className="whitespace-pre-wrap">{data.raw}</pre>
                  </div>
                </details>
              )}
            </Card>
          </div>
        )}
        
        {/* Kifu Player (shown when showPlayer is true) */}
        {showPlayer && (
          <div className="mt-6">
            <div className="flex justify-end mb-2">
              <Button variant="outline" size="sm" onClick={() => setShowPlayer(false)} className="rounded-2xl">
                棋譜再生プレイヤーを閉じる
              </Button>
            </div>
            <KifuPlayer
              ref={kifuPlayerRef}
              moves={usiToMoves(usi)}
              renderBoard={renderBoard}
              speedMs={750}
              initialPly={0}
            />
          </div>
        )}
        
        {digest && (
          <div className="mt-6">
            <Card className="p-4">
              <h3 className="font-semibold">10秒ダイジェスト</h3>
              {digest.error ? (
                <p className="text-sm text-red-600">Error: {String(digest.error)}</p>
              ) : (
                <div className="mt-2 space-y-3">
                  <div>
                    {(digest.summary || []).slice(0,7).map((s: string, idx: number) => (
                      <div key={idx} className="text-sm">• {s}</div>
                    ))}
                  </div>
                  <div className="mt-2">
                    <h4 className="font-medium">Key moments</h4>
                    <div className="mt-2 space-y-2">
                      {(digest.key_moments || []).slice(0,8).map((km: KeyMoment) => (
                        <div key={km.ply} className="border rounded p-2 flex items-center justify-between">
                          <div>
                            <div className="font-mono">{km.ply}手目: {km.move}</div>
                            <div className="text-sm text-muted-foreground">PV: {km.pv ?? '-'}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className={(km.delta_cp !== undefined && km.delta_cp !== null && km.delta_cp >= 100) ? 'text-emerald-600 font-bold' : ((km.delta_cp !== undefined && km.delta_cp !== null && km.delta_cp <= -100) ? 'text-rose-600 font-bold' : 'text-gray-700')}>{(km.delta_cp !== undefined && km.delta_cp !== null) ? (km.delta_cp>0?`+${km.delta_cp}`:String(km.delta_cp)) : '—'}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}
        
        {/* Game Analysis Results */}
        {analysisError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
            <p className="text-sm text-red-600">解析エラー: {analysisError}</p>
          </div>
        )}
        {analysis && analysis.moves.length > 0 && (
          <div className="mt-6">
            <Card className="p-4">
              <h3 className="font-semibold text-lg mb-4">棋譜全体解析</h3>
              
              {/* Evaluation Graph */}
              <div className="mb-6">
                <div className="text-sm font-medium text-muted-foreground mb-2">評価値推移（先手視点）</div>
                <EvalGraph moves={analysis.moves} onClickPly={(ply) => {
                  setShowPlayer(true);
                  // Small delay to ensure player is rendered
                  setTimeout(() => kifuPlayerRef.current?.jumpToPly(ply), 50);
                }} />
              </div>
              
              {/* Move List */}
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-2">手の一覧</div>
                <div className="max-h-96 overflow-y-auto border rounded">
                  {analysis.moves.map((m) => (
                    <div
                      key={m.ply}
                      className="flex items-center justify-between p-2 border-b hover:bg-gray-50 cursor-pointer"
                      onClick={() => {
                        setShowPlayer(true);
                        setTimeout(() => kifuPlayerRef.current?.jumpToPly(m.ply), 50);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm w-12">{m.ply}手</span>
                        <span className="font-medium">{m.move}</span>
                        <span className="text-xs text-muted-foreground">{m.side === "sente" ? "先手" : "後手"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {m.povEval !== null && (
                          <span className="text-xs font-mono">{m.povEval > 0 ? `+${m.povEval}` : m.povEval}</span>
                        )}
                        {m.delta !== null && (
                          <span className={`text-xs font-mono ${m.delta > 0 ? "text-green-600" : m.delta < 0 ? "text-red-600" : "text-gray-600"}`}>
                            ({m.delta > 0 ? "+" : ""}{m.delta})
                          </span>
                        )}
                        <MoveLabel label={m.label} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </Card>
  );
}

// Evaluation graph component
function EvalGraph({ moves, onClickPly }: { moves: AnalyzeGameMove[]; onClickPly: (ply: number) => void }) {
  const width = 800;
  const height = 300;
  const padding = { top: 20, right: 20, bottom: 40, left: 60 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;
  
  // Filter moves with valid povEval
  const validMoves = moves.filter(m => m.povEval !== null);
  if (validMoves.length === 0) {
    return <div className="text-sm text-muted-foreground">評価値データがありません</div>;
  }
  
  // Determine Y scale (clip extreme values for better visualization)
  const maxEval = Math.min(1000, Math.max(...validMoves.map(m => m.povEval!)));
  const minEval = Math.max(-1000, Math.min(...validMoves.map(m => m.povEval!)));
  const yRange = maxEval - minEval || 1000;
  
  const xScale = (ply: number) => padding.left + ((ply - 1) / Math.max(1, moves.length - 1)) * graphWidth;
  const yScale = (val: number) => {
    const clipped = Math.max(minEval, Math.min(maxEval, val));
    return padding.top + graphHeight - ((clipped - minEval) / yRange) * graphHeight;
  };
  
  // Build path
  const pathData = validMoves.map((m, i) => {
    const x = xScale(m.ply);
    const y = yScale(m.povEval!);
    return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
  }).join(" ");
  
  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} className="border rounded bg-white">
        {/* Grid lines */}
        {[0, 250, 500, 750, 1000, -250, -500, -750, -1000].map(val => {
          if (val < minEval || val > maxEval) return null;
          const y = yScale(val);
          return (
            <g key={val}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#e5e7eb" strokeWidth="1" />
              <text x={padding.left - 10} y={y + 4} textAnchor="end" fontSize="10" fill="#6b7280">{val}</text>
            </g>
          );
        })}
        {/* Zero line */}
        {minEval <= 0 && maxEval >= 0 && (
          <line x1={padding.left} y1={yScale(0)} x2={width - padding.right} y2={yScale(0)} stroke="#9ca3af" strokeWidth="2" />
        )}
        {/* Path */}
        <path d={pathData} fill="none" stroke="#3b82f6" strokeWidth="2" />
        {/* Points (clickable) */}
        {validMoves.map(m => {
          const cx = xScale(m.ply);
          const cy = yScale(m.povEval!);
          let fillColor = "#3b82f6";
          if (m.label === "blunder") fillColor = "#dc2626";
          else if (m.label === "mistake") fillColor = "#f97316";
          else if (m.label === "inaccuracy") fillColor = "#eab308";
          else if (m.label === "brilliant") fillColor = "#10b981";
          else if (m.label === "good") fillColor = "#06b6d4";
          return (
            <circle
              key={m.ply}
              cx={cx}
              cy={cy}
              r={4}
              fill={fillColor}
              stroke="white"
              strokeWidth="2"
              className="cursor-pointer hover:r-6"
              onClick={() => onClickPly(m.ply)}
            >
              <title>{m.ply}手: {m.move} ({m.povEval})</title>
            </circle>
          );
        })}
        {/* X axis labels */}
        {[1, Math.floor(moves.length / 2), moves.length].map(ply => {
          const x = xScale(ply);
          return (
            <text key={ply} x={x} y={height - 10} textAnchor="middle" fontSize="10" fill="#6b7280">
              {ply}手
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// Move label badge
function MoveLabel({ label }: { label: AnalyzeGameMove["label"] }) {
  let bgColor = "bg-gray-100";
  let textColor = "text-gray-700";
  let text = "";
  
  switch (label) {
    case "brilliant":
      bgColor = "bg-emerald-100";
      textColor = "text-emerald-800";
      text = "妙手";
      break;
    case "good":
      bgColor = "bg-cyan-100";
      textColor = "text-cyan-800";
      text = "好手";
      break;
    case "inaccuracy":
      bgColor = "bg-yellow-100";
      textColor = "text-yellow-800";
      text = "疑問手";
      break;
    case "mistake":
      bgColor = "bg-orange-100";
      textColor = "text-orange-800";
      text = "悪手";
      break;
    case "blunder":
      bgColor = "bg-red-100";
      textColor = "text-red-800";
      text = "大悪手";
      break;
    default:
      return null;
  }
  
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${bgColor} ${textColor}`}>
      {text}
    </span>
  );
}

function getVerdictClass(verdict?: string) {
  switch (verdict) {
    case "好手":
      return "bg-emerald-100 text-emerald-800 border-transparent";
    case "疑問手":
      return "bg-amber-100 text-amber-800 border-transparent";
    case "悪手":
      return "bg-rose-100 text-rose-800 border-transparent";
    default:
      return "bg-slate-100 text-slate-800 border-transparent";
  }
}

function tagClass(tag: string) {
  switch (tag) {
    case "駒取り":
    case "capture":
      return "bg-blue-100 text-blue-800";
    case "王手":
    case "check":
      return "bg-violet-100 text-violet-800";
    case "tempo":
      return "bg-orange-100 text-orange-800";
    case "develop":
      return "bg-cyan-100 text-cyan-800";
    case "safety":
      return "bg-rose-50 text-rose-700";
    default:
      return "bg-slate-100 text-slate-800";
  }
}

function principleClass() {
  return "bg-indigo-100 text-indigo-800";
}

function MoveRow({ note, onCopy }: { note: AnnotationNote; onCopy: (t: string) => void }) {
  const [open, setOpen] = useState(false);
  const delta = note.delta_cp ?? null;
  const verdict = note.verdict;

  const summaryId = `detail-${String(note.ply)}-summary`;
  const contentId = `detail-${String(note.ply)}-content`;

  return (
    <div className="border rounded-md p-2">
      <div className="flex items-center justify-between gap-2" role="group">
        <div className="flex items-center gap-3">
          <div className="font-mono text-sm">{note.ply}. {note.move}</div>
          <div className="text-sm text-muted-foreground">Δcp: {delta !== null ? (delta>0?`+${delta}`:String(delta)) : "—"}</div>
          {verdict ? (
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getVerdictClass(verdict)}`}>{verdict}</span>
          ) : null}
          <div className="flex items-center gap-1">
            {(note.tags || []).slice(0,3).map((t) => (
              <span key={t} className={`px-2 py-0.5 rounded text-xs ${tagClass(t)}`}>{t}</span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {note.evidence?.tactical ? (
            <button title={JSON.stringify(note.evidence.tactical)} className="p-1 rounded hover:bg-gray-100" aria-label="戦術ヒント">
              <Zap className="w-4 h-4 text-yellow-600" />
            </button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={() => { onCopy(note.pv ?? ""); }} aria-label="Copy PV">
            <Copy className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls={contentId} id={summaryId}>
            {open ? "閉じる" : "詳細"}
          </Button>
        </div>
      </div>

      <div id={contentId} role="region" aria-labelledby={summaryId} hidden={!open} className="mt-3 text-sm space-y-2">
        {note.comment ? (<div><strong>Comment:</strong> {note.comment}</div>) : null}
        <div className="flex gap-4">
          {note.score_before_cp !== undefined && note.score_before_cp !== null && (
            <div><strong>Before:</strong> {note.score_before_cp}</div>
          )}
          {note.score_after_cp !== undefined && note.score_after_cp !== null && (
            <div><strong>After:</strong> {note.score_after_cp}</div>
          )}
          {note.delta_cp !== undefined && note.delta_cp !== null && (
            <div><strong>Δcp:</strong> {note.delta_cp>0?`+${note.delta_cp}`:note.delta_cp}</div>
          )}
        </div>
        {note.principles && note.principles.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {note.principles.map((p) => (
              <span key={p} className={`px-2 py-0.5 rounded text-xs ${principleClass()}`}>{p}</span>
            ))}
            <div className="w-full text-xs text-muted-foreground">{(note.principles || []).join(", ")}</div>
          </div>
        )}
        {note.pv ? (
          <div className="font-mono text-xs bg-gray-50 p-2 rounded">
            <div className="flex justify-end mb-1">
              <Button size="sm" variant="outline" onClick={() => onCopy(note.pv ?? "")}>コピー</Button>
            </div>
            <pre className="whitespace-pre-wrap">{note.pv}</pre>
          </div>
        ) : null}
      </div>
    </div>
  );
}
