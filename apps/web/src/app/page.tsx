"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider, useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Board } from "@/components/Board";
import { sfenToPlaced, usiMoveToCoords } from "@/lib/sfen";

const queryClient = new QueryClient();
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

type Best = { from: { x: number; y: number }; to: { x: number; y: number } } | null;

type AnalyzeResp = {
  bestmove?: string;
  multipv?: Array<{ multipv: number; score?: { cp?: number; mate?: number }; pv?: string }>;
  raw?: string;
  output?: string;
};

function useAnalyze() {
  return useMutation({
    mutationFn: async (position: string) => {
      const res = await fetch(`${API_BASE}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position }),
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

    // 1) まず bestmove から
    let bm = r.bestmove;

    // 2) 無ければ raw / output から抜く（bestmove 7g7f）
    if (!bm) {
      const blob = r.raw || r.output || "";
      const m = /bestmove\s+([1-9][a-i][1-9][a-i])/i.exec(blob);
      bm = m?.[1];
    }

    if (bm) {
      const mv = usiMoveToCoords(bm); // ← 0始まり {from:{x,y}, to:{x,y}}
      if (mv) setBestOverlay(mv);
    }
  };

  return (
    <>
      {/* props 名と型を Board.tsx に合わせる */}
      <Board pieces={pieces} bestmove={bestOverlay} />

      <Card className="mt-4 p-4 rounded-2xl shadow-soft max-w-3xl mx-auto">
        <div className="flex gap-3 items-center">
          <Input
            value={sfenInput}
            onChange={(e) => setSfenInput(e.target.value)}
            placeholder='startpos もしくは "sfen <board> b - 1"'
            className="flex-1 font-mono"
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
            <div>bestmove: <code>{data.bestmove ?? "-"}</code></div>
            {Array.isArray(data.multipv) && data.multipv.length > 0 && (
              <ul className="mt-2 list-disc pl-6">
                {data.multipv.slice(0, 3).map((l, idx) => (
                  <li key={idx}>
                    #{l.multipv} score: {l.score?.mate ? `M${l.score.mate}` : (l.score?.cp ?? 0)} pv: <code>{l.pv ?? "-"}</code>
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

export default function Page() {
  return (
    <QueryClientProvider client={queryClient}>
      <main className="p-4">
        <h1 className="text-center text-3xl font-bold mb-4 text-amber-900">
          将棋指導AI（UIプロトタイプ）
        </h1>
        <AnalyzeView />
      </main>
    </QueryClientProvider>
  );
}
