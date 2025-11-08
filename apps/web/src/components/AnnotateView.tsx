"use client";
import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useAnnotate, type AnnotationNote } from "@/lib/annotateHook";
import { Copy, Zap } from "lucide-react";

// This file extracts the AnnotateView UI so the root page can be a homepage.
export default function AnnotateView() {
  // reuse existing hook from lib (kept minimal)
  const { usi, setUsi, submit, isPending, data, localError, downloadCsv } = useAnnotate();

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
            <div className="mt-4 space-y-2">
              {data.notes?.map((n) => (
                <MoveRow key={String(n.ply)} note={n} onCopy={(text) => navigator.clipboard?.writeText(text)} />
              ))}
            </div>
            <div className="flex justify-end mt-3">
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

function principleClass(_id?: string) {
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
              <span key={p} className={`px-2 py-0.5 rounded text-xs ${principleClass(p)}`}>{p}</span>
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
