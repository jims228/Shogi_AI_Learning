// apps/web/src/app/page.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { QueryClient, QueryClientProvider, useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Board } from "@/components/Board";
import { sfenToPlaced, usiMoveToCoords } from "@/lib/sfen";
import { Textarea } from "@/components/ui/textarea";
import kifToUsiMoves from "@/lib/convertKif";

const queryClient = new QueryClient();
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

type Best =
  | {
      from: { x: number; y: number };
      to: { x: number; y: number };
    }
  | null;

type AnalyzeResp = {
  bestmove?: string;
  multipv?: Array<{
    multipv: number;
    score?: { cp?: number; mate?: number };
    pv?: string;
  }>;
  raw?: string;
  output?: string;
};

function useAnalyze() {
  return useMutation({
    mutationFn: async (position: string) => {
      // position には "startpos" か "sfen <...>" を渡す前提
      const payload: any = { byoyomi_ms: 1000 };

      if (position && position.startsWith("sfen ")) {
        // 'sfen ' のあとを API の sfen フィールドに渡す
        payload.sfen = position.slice(5);
      } else if (position === "startpos" || !position) {
        // 何も入れなければ API 側が startpos 扱い
      } else {
        // 想定外の文字列は一旦無視して startpos と同等に
        // 必要ならここで `moves` 配列へ変換する分岐を書く
      }

      const res = await fetch(`${API_BASE}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as AnalyzeResp;
    },
  });
}

function AnalyzeView() {
  const [sfenInput, setSfenInput] = useState("startpos");
  const [bestOverlay, setBestOverlay] = useState<Best>(null);
  const { mutateAsync, isPending, data } = useAnalyze();

  const pieces = (() => {
    try {
      return sfenToPlaced(sfenInput);
    } catch {
      return sfenToPlaced("startpos");
    }
  })();

  const runAnalyze = async () => {
    setBestOverlay(null);
    const r = await mutateAsync(sfenInput);

    // 1) まず bestmove を直接使う
    let bm = r.bestmove;

    // 2) 無ければ raw / output から正規表現で拾う（例: "bestmove 7g7f"）
    if (!bm) {
      const blob = r.raw || r.output || "";
      const m = /bestmove\s+([1-9][a-i][1-9][a-i])/i.exec(blob);
      bm = m?.[1];
    }

    if (bm) {
      const mv = usiMoveToCoords(bm); // 0-based 座標 {from:{x,y}, to:{x,y}}
      if (mv) setBestOverlay(mv);
    }
  };

  return (
    <>
      {/* Board 側の props 型に合わせて渡す */}
      <div className="max-w-[min(90vw,480px)] mx-auto">
        <Board pieces={pieces} bestmove={bestOverlay} />
      </div>

      <Card className="mt-4 p-4 rounded-2xl shadow-soft max-w-3xl mx-auto">
        <div className="flex gap-3 items-center">
          <Input
            value={sfenInput}
            onChange={(e) => setSfenInput(e.target.value)}
            placeholder='startpos もしくは `sfen <board> b - 1`'
            className="block flex-1 font-mono w-full"
          />
          <Button onClick={runAnalyze} disabled={isPending} className="rounded-2xl">
            {isPending ? "解析中…" : "解析する"}
          </Button>
        </div>

        {isPending && (
          <div className="mt-4">
            <Progress value={66} />
            <p className="text-sm text-muted-foreground mt-2">エンジンが読み筋を探索中…</p>
          </div>
        )}

        {data && (
          <div className="mt-4 text-sm">
            <div>
              bestmove: <code>{data.bestmove ?? "-"}</code>
            </div>
            {Array.isArray(data.multipv) && data.multipv.length > 0 && (
              <ul className="mt-2 list-disc pl-6">
                {data.multipv.slice(0, 3).map((l, idx) => (
                  <li key={idx}>
                    #{l.multipv} score:{" "}
                    {typeof l.score?.mate === "number" ? `M${l.score.mate}` : l.score?.cp ?? 0} pv:{" "}
                    <code>{l.pv ?? "-"}</code>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>
    </>
  );
}

// ヘルパー関数：評価バッジのスタイル
const verdictClass = (v?: string | null) =>
  v === "好手" ? "bg-emerald-100 text-emerald-900"
    : v === "疑問手" ? "bg-amber-100 text-amber-900"
    : v === "悪手" ? "bg-rose-100 text-rose-900"
    : "bg-slate-100 text-slate-800";

type MoveNote = {
  ply: number;
  move: string;
  bestmove?: string | null;
  score_cp?: number | null;
  mate?: number | null;
  pv?: string | null;
  verdict?: string | null;
  comment?: string | null;
};
type AnnotateResp = {
  summary: string;
  notes: MoveNote[];
};

function useAnnotate() {
  // mutationFn accepts an object so caller can pass an AbortSignal for cancellation
  return useMutation({
    mutationFn: async ({ usi, signal }: { usi: string; signal?: AbortSignal }) => {
      const res = await fetch(`${API_BASE}/annotate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usi }),
        signal,
      });
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as AnnotateResp;
    },
  });
}
function AnnotateView() {
  const [usi, setUsi] = useState("startpos moves 7g7f 3c3d 2g2f 8c8d");
  const { mutateAsync, isPending, data, error } = useAnnotate();
  const [localError, setLocalError] = useState<string | null>(null);
  // progress UI state (per-move estimation)
  const [totalMoves, setTotalMoves] = useState<number>(0);
  const [progressIndex, setProgressIndex] = useState<number>(0);
  const progressTimer = useRef<number | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const PER_MOVE_MS = Number(process.env.NEXT_PUBLIC_ENGINE_PER_MOVE_MS ?? 250);
      useEffect(() => {
        if (!isPending) {
          if (progressTimer.current) {
            window.clearInterval(progressTimer.current);
            progressTimer.current = null;
          }
          if (data) {
            // finish progress and clear timer
            setProgressIndex((_) => totalMoves || 0);
            if (progressTimer.current) {
              window.clearInterval(progressTimer.current);
              progressTimer.current = null;
            }
            // auto-scroll: prefer first '悪手', else top of results
            setTimeout(() => {
              const root = resultsRef.current as HTMLElement | null;
              if (!root) return;
              const badEl = root.querySelector('.bad-move');
              if (badEl instanceof HTMLElement) {
                badEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                badEl.classList.add('ring-2', 'ring-rose-200');
                setTimeout(() => badEl.classList.remove('ring-2', 'ring-rose-200'), 1200);
              } else {
                root.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }, 80);
          }
        }
        return () => {
          if (progressTimer.current) {
            window.clearInterval(progressTimer.current);
            progressTimer.current = null;
          }
        };
      }, [isPending, data]);

  function normalizeUsiInput(raw: string): string {
    // Normalize full-width characters and convert newlines to spaces
    let s = (raw ?? "").replace(/\s+/g, " ").trim();
    try {
      // NFKC will convert full-width digits/ASCII to half-width
      s = s.normalize("NFKC");
    } catch {
      // ignore if normalize not supported
    }
    if (!s) return "startpos moves";
    if (s.startsWith("startpos ") || s.startsWith("position ")) return s;
    if (/^[1-9][a-i][1-9][a-i]/i.test(s)) return `startpos moves ${s}`;
    return s;
  }

  const submit = async () => {
    setLocalError(null);
    try {
      // attempt KIF/CSA -> USI conversion first
      const conv = kifToUsiMoves(usi);
      if (conv.errors && conv.errors.length > 0) {
        // show first non-fatal error as a hint (but still proceed if moves exist)
        setLocalError(conv.errors[0]);
      }
      let payloadUsi = "";
      if (conv.moves && conv.moves.length > 0) {
        payloadUsi = `startpos moves ${conv.moves.join(" ")}`;
      } else {
        payloadUsi = normalizeUsiInput(usi);
      }
      // basic validation: ensure there is at least one move when using startpos moves
      if (payloadUsi === "startpos moves") {
        setLocalError("棋譜が空です。USI手列を貼り付けてください。");
        return;
      }
      // prepare simple per-move progress estimation
      const toks = payloadUsi.split(" ").filter(Boolean);
      let movesCount = 0;
      if (toks.includes("moves")) {
        const i = toks.indexOf("moves");
        movesCount = Math.max(0, toks.length - (i + 1));
      } else {
        movesCount = toks.filter((t) => /^[1-9][a-i][1-9][a-i]/i.test(t)).length;
      }
      setTotalMoves(movesCount || 0);
      setProgressIndex(0);
      if (movesCount > 0) {
        if (progressTimer.current) window.clearInterval(progressTimer.current);
        progressTimer.current = window.setInterval(() => {
          setProgressIndex((p) => Math.min(p + 1, movesCount));
        }, Math.max(50, PER_MOVE_MS));
      }

      // create AbortController and pass signal to mutation so we can cancel
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
      const c = new AbortController();
      controllerRef.current = c;
      await mutateAsync({ usi: payloadUsi, signal: c.signal });
    } catch (e: any) {
      // If aborted, show friendly message
      if (e?.name === "AbortError") {
        setLocalError("注釈を中断しました。");
      } else {
        setLocalError(e?.message ?? String(e));
      }
    }
  };

  const handleCancel = () => {
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
    if (progressTimer.current) {
      window.clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
    setProgressIndex(0);
    setTotalMoves(0);
    setLocalError("注釈を中断しました。");
  };

  return (
    <Card className="mt-4 p-4 rounded-2xl shadow-soft max-w-3xl mx-auto">
      <div className="space-y-3">
        <Textarea
          value={usi}
          onChange={(e) => setUsi(e.target.value)}
          className="font-mono min-h-28"
          placeholder='USI棋譜を貼り付け（例: "startpos moves 7g7f 3c3d ..."）'
        />
        <Button onClick={submit} disabled={isPending} className="w-full sm:w-auto rounded-2xl">
          {isPending ? "注釈生成中…" : "注釈を生成"}
        </Button>
        {localError && <p className="text-sm text-red-600 mt-2">エラー: {localError}</p>}
        {error && <p className="text-sm text-red-600 mt-2">エラー: {(error as Error).message}</p>}
        {/* show cancel button while pending */}
        {isPending && (
          <div className="mt-2 flex gap-2 items-center">
            <Button variant="ghost" onClick={handleCancel} className="text-sm">
              中断
            </Button>
            {totalMoves > 0 && (
              <div className="flex-1">
                <Progress value={Math.round((progressIndex / Math.max(1, totalMoves)) * 100)} />
                <p className="text-xs text-muted-foreground mt-1">{progressIndex} / {totalMoves} 手 進捗</p>
              </div>
            )}
          </div>
        )}

        {data && (
          <div className="mt-2" ref={resultsRef}>
            <p className="text-sm text-muted-foreground">{data.summary}</p>

            <ul className="mt-3 space-y-2">
              {data.notes.map((n) => (
                <li key={n.ply} className={`p-3 rounded-xl border ${n.verdict === "悪手" ? "bad-move" : ""}`}>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">#{n.ply}</span>
                    <span>指し手: <code>{n.move}</code></span>
                    {typeof n.score_cp === "number" && <span>評価: {n.score_cp >= 0 ? `+${n.score_cp}` : n.score_cp}</span>}
                    {n.mate && <span>詰: M{n.mate}</span>}
                    {n.verdict && (
                      <span className={`px-2 py-0.5 rounded-full ${verdictClass(n.verdict)}`}>
                        {n.verdict}
                      </span>
                    )}
                  </div>
                  {n.bestmove && <div className="text-xs mt-1">推奨: <code>{n.bestmove}</code></div>}
                  {n.pv && <div className="text-xs mt-1">PV: <code className="break-all">{n.pv}</code></div>}
                  {n.comment && <p className="text-sm mt-2">{n.comment}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function Page() {
  const [tab, setTab] = useState<"analyze" | "annotate">("analyze");

  return (
    <QueryClientProvider client={queryClient}>
      <main className="p-4 max-w-5xl mx-auto">
        <h1 className="text-center text-2xl sm:text-3xl font-bold mb-4 text-amber-900">
          将棋指導AI（UIプロトタイプ）
        </h1>

        <div className="w-full flex justify-center mb-4">
          <div className="inline-flex rounded-xl bg-slate-50 p-1">
            <button
              className={`px-4 py-2 rounded-lg ${tab === "analyze" ? "bg-white shadow" : ""}`}
              onClick={() => setTab("analyze")}
            >
              単局面解析
            </button>
            <button
              className={`px-4 py-2 rounded-lg ${tab === "annotate" ? "bg-white shadow" : ""}`}
              onClick={() => setTab("annotate")}
            >
              棋譜注釈
            </button>
          </div>
        </div>

        {tab === "analyze" ? <AnalyzeView /> : <AnnotateView />}
      </main>
    </QueryClientProvider>
  );
}
