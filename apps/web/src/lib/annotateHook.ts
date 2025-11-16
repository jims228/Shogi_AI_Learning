"use client";
import { useState } from "react";

// Prefer explicit engine URL, fallback to legacy API base, finally default localhost:8001
const API_BASE =
  process.env.NEXT_PUBLIC_ENGINE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  (typeof window !== "undefined" && window.__ENGINE_URL__) ||
  "http://localhost:8001";

export type AnnotationNote = {
  ply?: number | string;
  move?: string;
  bestmove?: string;
  score_before_cp?: number | null;
  score_after_cp?: number | null;
  delta_cp?: number | null;
  time_ms?: number | null;
  score_cp?: number | null; // legacy / convenience (after)
  mate?: number | null;
  pv?: string;
  verdict?: string;
  tags?: string[];
  principles?: string[];
  evidence?: Record<string, unknown>;
  comment?: string;
};
export type AnnotationResponse = {
  summary?: string;
  notes?: AnnotationNote[];
};

export type KeyMoment = {
  ply: number;
  move: string;
  bestmove?: string;
  delta_cp?: number | null;
  tags?: string[];
  principles?: string[];
  evidence?: Record<string, unknown>;
  pv?: string;
};

export type DigestResponse = {
  summary?: string[];
  stats?: Record<string, unknown>;
  key_moments?: KeyMoment[];
  notes?: KeyMoment[];
  error?: string;
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
      // minimal client-side logging for debugging
      // eslint-disable-next-line no-console
      console.log("[web] sending annotate to", API_BASE + "/annotate");
      const res = await fetch(`${API_BASE}/annotate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usi }),
      });
      // eslint-disable-next-line no-console
      console.log("[web] annotate response status:", res.status);
      if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        // eslint-disable-next-line no-console
        console.log("[web] annotate response body:", json && Object.keys(json));
        setData(json as AnnotationResponse);
    } catch (e: unknown) {
      if (e instanceof Error) setError(e);
      else setLocalError(String(e));
    } finally {
      setPending(false);
    }
  }

  // simple health check helper (optional for UI)
  async function checkHealth(): Promise<string> {
    try {
      const r = await fetch(`${API_BASE}/health`, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      // eslint-disable-next-line no-console
      console.log("[web] engine health:", r.status, j);
      return r.ok ? "ok" : `bad(${r.status})`;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[web] engine health error:", err);
      return "error";
    }
  }

  function downloadCsv(notes: AnnotationNote[] | null | undefined) {
    if (!notes) return;
    const header = [
      "ply",
      "move",
      "bestmove",
      "score_before_cp",
      "score_after_cp",
      "delta_cp",
      "mate",
      "verdict",
      "tags",
      "principles",
      "evidence_tactical",
      "pv",
      "comment",
    ];
    const rows = notes.map((n) => [
      String(n.ply ?? ""),
      n.move ?? "",
      n.bestmove ?? "",
      typeof n.score_before_cp === "number" ? String(n.score_before_cp) : "",
      typeof n.score_after_cp === "number" ? String(n.score_after_cp) : "",
      typeof n.delta_cp === "number" ? String(n.delta_cp) : "",
      typeof n.mate === "number" ? String(n.mate) : "",
      n.verdict ?? "",
      (n.tags || []).join(";") || "",
      (n.principles || []).join(";") || "",
      JSON.stringify(n.evidence?.tactical ?? {}),
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

  return { usi, setUsi, submit, isPending, data, localError, error, downloadCsv, checkHealth } as const;
}
