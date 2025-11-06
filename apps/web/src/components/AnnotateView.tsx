"use client";
import React from "react";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { kifToUsiMoves } from "@/lib/convertKif";
import { useAnnotate } from "@/lib/annotateHook";

// This file extracts the AnnotateView UI so the root page can be a homepage.
export default function AnnotateView() {
  // reuse existing hook from lib (kept minimal)
  const { usi, setUsi, submit, isPending, data, localError, error, downloadCsv } = useAnnotate();

  return (
    <Card className="mt-4 p-4 rounded-2xl shadow-soft max-w-3xl mx-auto">
      <div className="space-y-3">
        <Textarea value={usi} onChange={(e) => setUsi(e.target.value)} className="font-mono min-h-28" placeholder='USI棋譜を貼り付（Ctrl/⌘+Enter で実行）' />
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" className="rounded-2xl" onClick={() => setUsi("startpos moves 7g7f 3c3d 2g2f 8c8d")}>サンプル（USI）</Button>
          <Button onClick={submit} disabled={isPending} className="rounded-2xl">{isPending ? "注釈生成中…" : "注釈を生成"}</Button>
        </div>
        {localError && <p className="text-sm text-red-600 mt-2">エラー: {localError}</p>}
        {data && (
          <div className="mt-2">
            <p className="text-sm text-muted-foreground">{data.summary}</p>
            <div className="flex justify-end">
              {data?.notes?.length ? (
                <Button variant="outline" className="rounded-2xl" onClick={() => downloadCsv(data.notes)}>CSVとして保存</Button>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
