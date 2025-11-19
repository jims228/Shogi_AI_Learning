// Engine URL policy: NEXT_PUBLIC_ENGINE_URL -> ENGINE_URL -> default
const API_BASE: string =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_ENGINE_URL ||
  process.env.ENGINE_URL ||
  "http://localhost:8787";

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
  usi?: string;
  byoyomi_ms?: number;
  multipv?: number;
}): Promise<AnalyzeResponse> {
  const r = await fetch(`${API_BASE}/annotate`, {
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
