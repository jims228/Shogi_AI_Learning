const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export type PVItem = {
  move: string;
  score_cp?: number;
  score_mate?: number;
  depth?: number;
  pv: string[];
};

export type AnalyzeResponse = {
  bestmove: string;
  candidates?: PVItem[];
};

export async function postAnalyze(body: {
  sfen?: string;
  moves?: string[];
  byoyomi_ms?: number;
  btime?: number; wtime?: number; binc?: number; winc?: number;
  multipv?: number;
}): Promise<AnalyzeResponse> {
  const r = await fetch(`${API_BASE}/analyze`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function postSettings(body: {
  USI_OwnBook?: boolean;
  USI_Hash?: number;
  Threads?: number;
}) {
  const r = await fetch(`${API_BASE}/settings`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
