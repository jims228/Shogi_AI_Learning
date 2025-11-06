"use client";
import { useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export type AnnotationNote = {
  ply?: number | string;
  move?: string;
  bestmove?: string;
  score_cp?: number | null;
  mate?: number | null;
  verdict?: string;
  pv?: string;
  comment?: string;
};
export type AnnotationResponse = {
  summary?: string;
  notes?: AnnotationNote[];
};

export function useAnnotate() {
  const [usi, setUsi] = useState<string>("startpos moves 7g7f 3c3d 2g2f 8c8d");
  const [isPending, setPending] = useState(false);
  const [data, setData] = useState<AnnotationResponse | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  async function submit() {
    setLocalError(null);
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`${API_BASE}/annotate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usi }),
      });
      if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        setData(json as AnnotationResponse);
    } catch (e: unknown) {
      if (e instanceof Error) setError(e);
      else setLocalError(String(e));
    } finally {
      setPending(false);
    }
  }

  function downloadCsv(notes: AnnotationNote[] | null | undefined) {
    if (!notes) return;
    const header = ["ply", "move", "bestmove", "score_cp", "mate", "verdict", "pv", "comment"];
    const rows = notes.map((n) => [
      String(n.ply ?? ""),
      n.move ?? "",
      n.bestmove ?? "",
      typeof n.score_cp === "number" ? String(n.score_cp) : "",
      typeof n.mate === "number" ? String(n.mate) : "",
      n.verdict ?? "",
      n.pv ?? "",
      n.comment ?? "",
    ]);
    const escape = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
    const csv = [header.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "annotation.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return { usi, setUsi, submit, isPending, data, localError, error, downloadCsv } as const;
}
