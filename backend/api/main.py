import subprocess, threading, queue, time, os
from statistics import mean
from typing import List, Optional, Dict, Any, Literal
import httpx
import logging
try:
    from . import principles as principles_mod
except ImportError:
    import principles as principles_mod

# === ダミーエンジン（本物が無い環境用） ===
class DummyUSIEngine:
    def __init__(self, *args, **kwargs):
        self.started = False
    def start(self):
        self.started = True
    def quit(self):
        self.started = False
    def set_options(self, *args, **kwargs):
        return None
    def analyze(self, req: "AnalyzeRequest"):
        # Return a minimal AnalyzeResponse-like object compatible with usage in this file
        class _R:
            def __init__(self):
                self.bestmove = "0000"
                self.candidates = []
        return _R()
# ============================================
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

# === ロガー ===
logger = logging.getLogger(__name__)

# ====== 環境変数 ======
ENGINE_PATH = os.environ.get("ENGINE_PATH", "/usr/local/bin/yaneuraou")
DEFAULT_BYOYOMI_MS = int(os.environ.get("DEFAULT_BYOYOMI_MS", "1000"))
DEFAULT_THREADS = int(os.environ.get("ENGINE_THREADS", "4"))
DEFAULT_HASH_MB = int(os.environ.get("ENGINE_HASH_MB", "1024"))
ENGINE_USE_BOOK = os.environ.get("ENGINE_USE_BOOK", "false").lower() == "true"
ENGINE_READY_TIMEOUT = int(os.environ.get("ENGINE_READY_TIMEOUT", "60"))
ENGINE_TIME_BUDGET_MS = int(os.environ.get("ENGINE_TIME_BUDGET_MS", "10000"))
ENGINE_PER_MOVE_MS_A = int(os.environ.get("ENGINE_PER_MOVE_MS_A", "20"))
ENGINE_PER_FOCUS_MS_B = int(os.environ.get("ENGINE_PER_FOCUS_MS_B", "500"))
ENGINE_HASH_MB = int(os.environ.get("ENGINE_HASH_MB", "256"))
ENGINE_THREADS = int(os.environ.get("THREADS", "2"))

# ====== リクエスト/レスポンス ======
class AnalyzeRequest(BaseModel):
    sfen: Optional[str] = None
    moves: Optional[List[str]] = None         # ["7g7f", ...]
    byoyomi_ms: Optional[int] = None          # go byoyomi
    btime: Optional[int] = None               # go btime
    wtime: Optional[int] = None               # go wtime
    binc: Optional[int] = None
    winc: Optional[int] = None
    multipv: Optional[int] = 1

class PVItem(BaseModel):
    move: str
    score_cp: Optional[int] = None
    score_mate: Optional[int] = None
    depth: Optional[int] = None
    pv: List[str] = []

class AnalyzeResponse(BaseModel):
    bestmove: str
    candidates: Optional[List[PVItem]] = None


class BatchAnalysisRequest(BaseModel):
    position: Optional[str] = None
    usi: Optional[str] = None
    max_ply: Optional[int] = None
    movetime_ms: Optional[int] = None
    multipv: Optional[int] = None
    time_budget_ms: Optional[int] = None


class BatchAnalysisResponse(BaseModel):
    analyses: Dict[int, Dict[str, Any]]
    elapsed_ms: int
    analyzed_plies: int


class QuickEvalItem(BaseModel):
    ply: int
    move: str
    score_cp: Optional[int] = None
    score_mate: Optional[int] = None
    pv: Optional[List[str]] = None


class DigestRequest(BaseModel):
    usi: Optional[str] = None
    moves: Optional[List[str]] = None
    sfen: Optional[str] = None
    time_budget_ms: Optional[int] = None


class KeyMoment(BaseModel):
    ply: int
    move: str
    bestmove: Optional[str] = None
    delta_cp: Optional[int] = None
    tags: Optional[List[str]] = None
    principles: Optional[List[str]] = None
    evidence: Optional[Dict[str, Any]] = None
    pv: Optional[str] = None


class DigestResponse(BaseModel):
    summary: List[str]
    stats: Dict[str, Any]
    key_moments: List[KeyMoment]
    notes: Optional[List[KeyMoment]] = None

class SettingsRequest(BaseModel):
    USI_OwnBook: Optional[bool] = None
    USI_Hash: Optional[int] = None
    Threads: Optional[int] = None

class SettingsResponse(BaseModel):
    ok: bool
    applied: Dict[str, Any]


# ====== Annotate 機能用モデル ======
class AnnotateRequest(BaseModel):
    # 1) どちらかを必須: (A) usi文字列, (B) moves配列 + sfen or startpos
    usi: Optional[str] = None
    moves: Optional[List[str]] = None
    sfen: Optional[str] = None           # 省略時は startpos 扱い
    byoyomi_ms: Optional[int] = None     # 省略時は ENGINE_PER_MOVE_MS


class MoveNote(BaseModel):
    ply: int
    move: str
    bestmove: Optional[str] = None
    # before/after scores and delta (cp, from engine,先手視点)
    score_before_cp: Optional[int] = None
    score_after_cp: Optional[int] = None
    delta_cp: Optional[int] = None
    # timing (ms) spent for this move (if available)
    time_ms: Optional[int] = None
    # raw engine evaluation fields
    score_cp: Optional[int] = None       # 現状は score_after_cp と重複しうる
    mate: Optional[int] = None
    pv: Optional[str] = None
    # tagging / principles / evidence
    tags: List[str] = []
    principles: List[str] = []
    evidence: Dict[str, Any] = {}
    verdict: Optional[str] = None        # "好手/疑問手/悪手"など（旧フィールド）
    comment: Optional[str] = None        # LLM or ルール生成コメント
    reasoning: Optional[Dict[str, Any]] = None  # v2 reasoning structure


class AnnotateResponse(BaseModel):
    summary: str
    notes: List[MoveNote]


# ====== Annotate ヘルパー ======
def _is_valid_usi_move(move: str) -> bool:
    """Check if a move string is a valid USI move"""
    import re
    if not move or len(move) < 4:
        return False
    # Valid USI move patterns:
    # - Normal move: 7g7f, 7g7f+
    # - Drop: P*5e, G*6f
    return bool(
        re.match(r'^[1-9][a-i][1-9][a-i]\+?$', move) or  # Normal move
        re.match(r'^[PLNSGBRK]\*[1-9][a-i]$', move)      # Drop
    )


def _parse_usi_to_moves(usi: str) -> List[str]:
    """
    'startpos moves 7g7f 3c3d ...' / 'position sfen <...> moves ...' / 純粋なUSI配列 への軽対応。
    厳密対応は今後拡張。
    不正な指し手（時間情報など）を除外。
    """
    usi = usi.strip()
    if usi.startswith("startpos"):
        # "startpos moves ..." から moves 部分だけ抜く
        toks = usi.split()
        if "moves" in toks:
            i = toks.index("moves")
            return [t for t in toks[i+1:] if _is_valid_usi_move(t)]
        return []
    if " position " in usi or usi.startswith("position"):
        toks = usi.split()
        if "moves" in toks:
            i = toks.index("moves")
            return [t for t in toks[i+1:] if _is_valid_usi_move(t)]
        return []
    # スペース区切りのUSI列とみなす
    return [t for t in usi.split() if _is_valid_usi_move(t)]


def _extract_position_components(position: str) -> Dict[str, Any]:
    body = position.strip()
    if body.startswith("position"):
        body = body[len("position"):].strip()

    base = body
    moves: List[str] = []
    if " moves " in body:
        head, _, tail = body.partition(" moves ")
        base = head.strip()
        moves = [t for t in tail.split() if _is_valid_usi_move(t)]
    else:
        moves = _parse_usi_to_moves(body)

    sfen = None
    if base.startswith("sfen"):
        sfen = base[len("sfen"):].strip()

    return {"base": base, "moves": moves, "sfen": sfen}


def _format_score_object(item: PVItem) -> Dict[str, Any]:
    if item.score_mate is not None:
        return {"type": "mate", "mate": item.score_mate}
    if item.score_cp is not None:
        return {"type": "cp", "cp": item.score_cp}
    return {"type": "cp", "cp": 0}


def _analyze_response_to_payload(res: AnalyzeResponse, default_multipv: int) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "ok": True,
        "bestmove": getattr(res, "bestmove", None),
        "multipv": [],
    }

    candidates = res.candidates or []
    for idx, cand in enumerate(candidates, start=1):
        score_obj = _format_score_object(cand)
        pv_text = " ".join(cand.pv) if cand.pv else (cand.move or "")
        payload["multipv"].append(
            {
                "multipv": idx,
                "score": score_obj,
                "pv": pv_text,
                "depth": cand.depth,
            }
        )
        if idx >= default_multipv:
            break

    return payload


def _classify_by_delta(delta_cp: int) -> str:
    """評価差でざっくり判定"""
    if delta_cp <= -150:
        return "悪手"
    if delta_cp <= -80:
        return "疑問手"
    if delta_cp >= 120:
        return "好手"
    return "通常手"


def _format_for_llm(moves: List[str], notes: List[MoveNote]) -> str:
    """LLMプロンプト用の簡易整形（日本語解説を期待）"""
    lines = [
        "あなたは将棋の指導者です。以下の各手について、人間にわかる短い講評を与えてください。",
        "各行は「手数: 指し手 | 評価値cp | 推奨手 | PV」の形式です。評価値は先手視点です。",
        "専門用語を使いすぎず、改善案も1つ具体的に提案してください。"
    ]
    for n in notes:
        sc = f"{(n.score_after_cp if n.score_after_cp is not None else n.score_cp):+d}" if (n.score_after_cp is not None or n.score_cp is not None) else ("M"+str(n.mate) if n.mate else "?")
        pv = n.pv or "-"
        bm = n.bestmove or "-"
        tags = ",".join(n.tags) if n.tags else "-"
        pr = ",".join([principles_mod.PRINCIPLES.get(pid, pid) for pid in n.principles]) if n.principles else "-"
        lines.append(f"{n.ply}: {n.move} | {sc} | Δcp {n.delta_cp if n.delta_cp is not None else '?'} | best {bm} | pv {pv} | tags {tags} | principles {pr}")
    return "\n".join(lines)


def _call_openai(prompt: str) -> Optional[List[str]]:
    """
    LLM接続（簡易）。OPENAI_API_KEY が無ければ None。
    返り値は行配列（各手の短評）を想定。
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None
    try:
        import json, urllib.request
        req = urllib.request.Request(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            data=json.dumps({
                "model": "gpt-4o-mini",
                "messages": [
                    {"role":"system","content":"You are a helpful Japanese shogi coach."},
                    {"role":"user","content": prompt}
                ],
                "temperature": 0.4,
            }).encode("utf-8")
        )
        with urllib.request.urlopen(req, timeout=30) as r:
            obj = json.loads(r.read().decode("utf-8"))
        text = obj["choices"][0]["message"]["content"]
        # 行ごとに割る（ざっくり）
        return [ln.strip("・- ") for ln in text.split("\n") if ln.strip()]
    except Exception:
        return None


# ====== USIエンジン ======
class USIEngine:
    def __init__(self, path: str):
        self.path = path
        self.proc = None
        self.lock = threading.Lock()
        self.q = queue.Queue()       # stdout
        self.reader_thread = None
        self.task_q = queue.Queue()  # 分析 FIFO
        self.worker = threading.Thread(target=self._worker, daemon=True)
        self.worker_started = False

    def start(self):
        if self.proc and self.proc.poll() is None:
            return
        self.proc = subprocess.Popen(
            [self.path],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
        self.reader_thread = threading.Thread(target=self._reader, daemon=True)
        self.reader_thread.start()

        # USI初期化
        self._send("usi")
        # 軽量起動オプション
        self._send(f"setoption name USI_OwnBook value {'true' if ENGINE_USE_BOOK else 'false'}")
        self._send(f"setoption name USI_Hash value {DEFAULT_HASH_MB}")
        self._send(f"setoption name Threads value {DEFAULT_THREADS}")

        self._wait_for("usiok", timeout=ENGINE_READY_TIMEOUT)
        self._send("isready")
        self._wait_for("readyok", timeout=ENGINE_READY_TIMEOUT)

        if not self.worker_started:
            self.worker.start()
            self.worker_started = True

    def _reader(self):
        for line in self.proc.stdout:
            self.q.put(line.rstrip("\n"))

    def _drain(self):
        lines = []
        while True:
            try:
                lines.append(self.q.get_nowait())
            except queue.Empty:
                break
        return lines

    def _send(self, cmd: str):
        assert self.proc and self.proc.stdin
        self.proc.stdin.write(cmd + "\n")
        self.proc.stdin.flush()

    def _apply_position(self, req: AnalyzeRequest):
        if req.sfen:
            cmd = f"position sfen {req.sfen.strip()}"
            if req.moves:
                cmd += " moves " + " ".join(req.moves)
            self._send(cmd)
            return

        if req.moves:
            seq = " ".join(req.moves)
            self._send(f"position startpos moves {seq}")
        else:
            self._send("position startpos")

    def _wait_for(self, token: str, timeout: float):
        end = time.time() + timeout
        while time.time() < end:
            try:
                line = self.q.get(timeout=0.1)
            except queue.Empty:
                continue
            if token in line:
                return
        raise TimeoutError(f"timeout waiting for {token}")

    # ====== Public ======
    def analyze(self, req: AnalyzeRequest) -> AnalyzeResponse:
        # タスクとして投入し、同期で結果を待つ
        result_q: "queue.Queue[Any]" = queue.Queue()
        self.task_q.put((req, result_q))
        ok, payload = result_q.get()  # (bool, data or Exception)
        if ok:
            return payload
        raise payload

    def set_options(self, opts: SettingsRequest) -> SettingsResponse:
        with self.lock:
            if not self.proc or self.proc.poll() is not None:
                self.start()
            applied: Dict[str, Any] = {}
            if opts.USI_OwnBook is not None:
                self._send(f"setoption name USI_OwnBook value {'true' if opts.USI_OwnBook else 'false'}")
                applied["USI_OwnBook"] = opts.USI_OwnBook
            if opts.USI_Hash is not None:
                self._send(f"setoption name USI_Hash value {opts.USI_Hash}")
                applied["USI_Hash"] = opts.USI_Hash
            if opts.Threads is not None:
                self._send(f"setoption name Threads value {opts.Threads}")
                applied["Threads"] = opts.Threads
            self._send("isready")
            self._wait_for("readyok", timeout=ENGINE_READY_TIMEOUT)
            return SettingsResponse(ok=True, applied=applied)

    def stream_analyze(self, req: AnalyzeRequest):
        import json
        with self.lock:
            if not self.proc or self.proc.poll() is not None:
                self.start()

            self._drain()

            mpv = max(1, int(req.multipv or 3))
            self._send(f"setoption name MultiPV value {mpv}")

            self._apply_position(req)

            self._send("go infinite")

            pv_map = {}
            
            try:
                while True:
                    try:
                        line = self.q.get(timeout=0.5)
                    except queue.Empty:
                        yield f": keepalive\n\n"
                        continue

                    if line.startswith("info ") and "multipv" in line:
                        item = self._parse_info(line)
                        if item and "multipv" in item:
                            m_idx = item["multipv"]
                            
                            score_obj = {"type": "cp", "cp": 0}
                            if "score_mate" in item:
                                score_obj = {"type": "mate", "mate": item["score_mate"]}
                            elif "score_cp" in item:
                                score_obj = {"type": "cp", "cp": item["score_cp"]}
                            
                            pv_str = " ".join(item.get("pv", []))
                            
                            pv_map[m_idx] = {
                                "multipv": m_idx,
                                "score": score_obj,
                                "pv": pv_str,
                                "depth": item.get("depth")
                            }
                            
                            candidates = [pv_map[k] for k in sorted(pv_map.keys())]
                            bestmove = candidates[0]["pv"].split()[0] if candidates else None
                            
                            resp = {
                                "ok": True,
                                "bestmove": bestmove,
                                "multipv": candidates
                            }
                            yield f"data: {json.dumps(resp)}\n\n"
                            
            except GeneratorExit:
                self._send("stop")
                self._drain()
            except Exception as e:
                print(f"Stream error: {e}")
                self._send("stop")
                self._drain()

    def quit(self):
        try:
            if self.proc and self.proc.poll() is None:
                self._send("quit")
                self.proc.wait(timeout=2)
        except Exception:
            pass

    # ====== ワーカ ======
    def _worker(self):
        while True:
            req, result_q = self.task_q.get()
            try:
                res = self._do_analyze(req)
                result_q.put((True, res))
            except Exception as e:
                result_q.put((False, e))

    def _do_analyze(self, req: AnalyzeRequest) -> AnalyzeResponse:
        with self.lock:
            if not self.proc or self.proc.poll() is not None:
                self.start()

            self._drain()

            # MultiPV設定
            mpv = max(1, int(req.multipv or 1))
            self._send(f"setoption name MultiPV value {mpv}")

            # 局面セット
            self._apply_position(req)

            # go コマンド
            if req.btime is not None and req.wtime is not None:
                go = f"go btime {req.btime} wtime {req.wtime} byoyomi {int(req.byoyomi_ms or 0)}"
                if req.binc is not None: go += f" binc {req.binc}"
                if req.winc is not None: go += f" winc {req.winc}"
            else:
                go = f"go byoyomi {int(req.byoyomi_ms or DEFAULT_BYOYOMI_MS)}"
            self._send(go)

            bestmove = None
            # multipv集計
            pvmap: Dict[int, PVItem] = {}
            deadline = time.time() + 8.0  # セーフティ（適宜調整）
            while time.time() < deadline:
                try:
                    line = self.q.get(timeout=0.1)
                except queue.Empty:
                    continue

                if line.startswith("info "):
                    item = self._parse_info(line)
                    if item and item.get("multipv"):
                        m = int(item["multipv"])
                        pvmap[m] = PVItem(
                            move=item.get("pv", [""])[0] if item.get("pv") else None,
                            score_cp=item.get("score_cp"),
                            score_mate=item.get("score_mate"),
                            depth=item.get("depth"),
                            pv=item.get("pv", []),
                        )

                if line.startswith("bestmove "):
                    bestmove = line.split()[1]
                    break

            if not bestmove:
                self._send("stop")
                try:
                    while True:
                        line = self.q.get(timeout=0.2)
                        if line.startswith("bestmove "):
                            bestmove = line.split()[1]
                            break
                except queue.Empty:
                    pass

            if not bestmove:
                raise RuntimeError("bestmove を取得できませんでした。")

            candidates: List[PVItem] = []
            for i in range(1, mpv + 1):
                if i in pvmap:
                    candidates.append(pvmap[i])

            return AnalyzeResponse(bestmove=bestmove, candidates=candidates or None)

    def _parse_info(self, line: str) -> Dict[str, Any]:
        # 例: "info depth 16 seldepth 19 multipv 1 score cp -76 pv 7g7f 3c3d ..."
        toks = line.split()
        out: Dict[str, Any] = {}
        try:
            if "depth" in toks:
                out["depth"] = int(toks[toks.index("depth")+1])
            if "multipv" in toks:
                out["multipv"] = int(toks[toks.index("multipv")+1])
            if "score" in toks:
                i = toks.index("score")
                kind = toks[i+1]
                if kind == "cp":
                    out["score_cp"] = int(toks[i+2])
                elif kind == "mate":
                    out["score_mate"] = int(toks[i+2])
            if "pv" in toks:
                pvi = toks.index("pv")
                out["pv"] = toks[pvi+1:]
        except Exception:
            pass
        return out


def quick_eval_all(moves: List[str], time_per_move_ms: int = ENGINE_PER_MOVE_MS_A) -> List[QuickEvalItem]:
    """Quick shallow eval for each ply. Returns list of QuickEvalItem in ply order."""
    seq: List[str] = []
    out: List[QuickEvalItem] = []
    prev = None
    for i, mv in enumerate(moves, start=1):
        seq.append(mv)
        try:
            areq = AnalyzeRequest(moves=list(seq), byoyomi_ms=time_per_move_ms, multipv=1)
            res = engine.analyze(areq)
        except Exception:
            # fallback empty
            out.append(QuickEvalItem(ply=i, move=mv, score_cp=None, score_mate=None, pv=None))
            continue
        score = None
        pv = None
        if res.candidates and len(res.candidates) > 0:
            c = res.candidates[0]
            score = c.score_cp
            pv = c.pv
        out.append(QuickEvalItem(ply=i, move=mv, score_cp=score, score_mate=None, pv=pv))
    return out


def deep_eval_focus(moves: List[str], focus_plies: List[int], per_ms: int = ENGINE_PER_FOCUS_MS_B, multipv: int = 2) -> List[Dict[str, Any]]:
    """Do deeper eval on selected plies. Returns list of dicts with ply, bestmove, score_cp, pv."""
    seq: List[str] = []
    results: List[Dict[str, Any]] = []
    for i, mv in enumerate(moves, start=1):
        seq.append(mv)
        if i in focus_plies:
            try:
                areq = AnalyzeRequest(moves=list(seq), byoyomi_ms=per_ms, multipv=multipv)
                res = engine.analyze(areq)
            except Exception:
                results.append({"ply": i, "move": mv, "bestmove": None, "score_cp": None, "pv": None})
                continue
            score = None
            pv = None
            if res.candidates and len(res.candidates) > 0:
                c = res.candidates[0]
                score = c.score_cp
                pv = " ".join(c.pv) if c.pv else None
            results.append({"ply": i, "move": mv, "bestmove": getattr(res, "bestmove", None), "score_cp": score, "pv": pv})
    return results

# ====== FastAPI ======
# engine selection: allow using a dummy engine in dev/test environments
USE_DUMMY_ENGINE = os.getenv("USE_DUMMY_ENGINE", "1")
if USE_DUMMY_ENGINE == "1":
    engine = DummyUSIEngine()
else:
    engine = USIEngine(ENGINE_PATH)
app = FastAPI(title="Shogi Analyze API", version="0.2.0")

# Include routers
try:
    from .routers.ingest import router as ingest_router
    app.include_router(ingest_router)
except ImportError as e:
    print(f"Warning: Could not import ingest router: {e}")

# Learning module integration
try:
    from ..learning.router import router as learning_router
    app.include_router(learning_router)
    print("Learning module integrated successfully")
except ImportError as e:
    print(f"Warning: Could not import learning router: {e}")

# CORS ミドルウェアを追加
# allow origins can be configured via CORS_ORIGINS env (comma-separated). Default to localhost dev origins.
raw_cors = os.environ.get("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
cors_list = [s.strip() for s in raw_cors.split(",") if s.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def _on_startup():
    # 起動時の常駐は維持（lazyにしたければコメントアウト）
    engine.start()

@app.on_event("shutdown")
def _on_shutdown():
    engine.quit()

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/ready")
def ready():
    # エンジンに軽くping
    try:
        engine._send("isready")
        engine._wait_for("readyok", timeout=3)
        return {"ready": True}
    except Exception:
        return {"ready": False}

@app.post("/settings", response_model=SettingsResponse)
def settings(req: SettingsRequest):
    try:
        return engine.set_options(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest):
    try:
        return engine.analyze(req)
    except TimeoutError as e:
        raise HTTPException(status_code=504, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/annotate", response_model=AnnotateResponse)
def annotate(req: AnnotateRequest):
    # AI推論モジュールのインポート
    try:
        from ..ai.reasoning import build_multiple_reasoning, build_summary_reasoning
    except ImportError:
        # AI機能が無効の場合のフォールバック
        build_multiple_reasoning = None
        build_summary_reasoning = None

    # 1) moves 取り出し
    if req.usi:
        moves = _parse_usi_to_moves(req.usi)
        start_sfen = None
    else:
        moves = req.moves or []
        start_sfen = req.sfen  # None なら startpos
    if not moves:
        raise HTTPException(status_code=400, detail="棋譜（USIまたはmoves）が空です。")

    per_ms = int(os.getenv("ENGINE_PER_MOVE_MS", "250"))
    byoyomi = req.byoyomi_ms if req.byoyomi_ms is not None else per_ms

    # 2) 手前までの局面を順次作って解析
    notes: List[MoveNote] = []
    prev_cp: Optional[int] = None
    seq_so_far: List[str] = []

    for i, mv in enumerate(moves, start=1):
        seq_so_far.append(mv)
        # 現状は startpos 前提（usi の startpos moves ... を想定）。sfen + moves の混在は未対応。
        if start_sfen:
            raise HTTPException(status_code=400, detail="sfen + moves の組み合わせは未対応です。startpos (usi) を使用してください。")

        try:
            areq = AnalyzeRequest(moves=list(seq_so_far), byoyomi_ms=byoyomi, multipv=1)
            res = engine.analyze(areq)
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

        # candidates の先頭を評価として扱う
        score_after = None
        mate = None
        pv = None
        bestmove = getattr(res, "bestmove", None)
        if res.candidates and len(res.candidates) > 0:
            c = res.candidates[0]
            score_after = c.score_cp
            mate = c.score_mate
            pv = " ".join(c.pv) if c.pv else None

        score_before = prev_cp
        delta = (score_after - score_before) if (score_after is not None and score_before is not None) else None
        verdict = _classify_by_delta(delta) if (score_before is not None and score_after is not None and delta is not None) else None
        # update prev
        prev_cp = score_after if score_after is not None else prev_cp

        # minimal tactical inference (stub/heuristic)
        tags: List[str] = []
        evidence: Dict[str, Any] = {"tactical": {}, "king_safety": {}, "material_swing": {}}
        # tags from delta
        if delta is not None:
            if delta <= -150:
                tags.append("悪手")
            elif delta <= -80:
                tags.append("疑問手")
            elif delta >= 120:
                tags.append("好手")

        # tactical heuristics: check '+' in move or pv, capture if 'x' in move (KIF style) or 'x' in pv
        is_check = False
        is_capture = False
        try:
            if mv and "+" in mv:
                is_check = True
            if pv and "+" in pv:
                is_check = True
            if "x" in mv:
                is_capture = True
            if pv and any("x" in p for p in pv.split()):
                is_capture = True
        except Exception:
            pass

        if is_check:
            tags.append("王手")
        if is_capture:
            tags.append("駒取り")

        evidence["tactical"] = {"is_check": is_check, "is_capture": is_capture}
        evidence["material_swing"] = {"delta_cp": delta}

        # map tags to principles
        principles: List[str] = []
        for t in tags:
            mapped = principles_mod.TAG_TO_PRINCIPLES.get(t, [])
            for pid in mapped:
                if pid not in principles:
                    principles.append(pid)

        notes.append(MoveNote(
            ply=i,
            move=mv,
            bestmove=bestmove,
            score_before_cp=score_before,
            score_after_cp=score_after,
            delta_cp=delta,
            time_ms=None,
            score_cp=score_after,
            mate=mate,
            pv=pv,
            tags=tags,
            principles=principles,
            evidence=evidence,
            verdict=verdict,
        ))

    # 3) Convert to dict for reasoning processing
    notes_dict = [note.model_dump() for note in notes]

    # 4) Generate reasoning using AI module
    if build_multiple_reasoning:
        try:
            reasonings = build_multiple_reasoning(notes_dict, {"game_type": "normal"})
            for i, reasoning in enumerate(reasonings):
                if i < len(notes_dict):
                    notes_dict[i]["reasoning"] = reasoning
        except Exception as e:
            print(f"Reasoning generation error: {e}")

    # 5) Update MoveNote objects with reasoning
    for i, note_dict in enumerate(notes_dict):
        if i < len(notes):
            notes[i].reasoning = note_dict.get("reasoning")

    # 6) 棋譜全体の要約を生成
    if build_summary_reasoning:
        try:
            reasonings = [note.reasoning for note in notes if note.reasoning]
            ai_summary = build_summary_reasoning(notes_dict, reasonings)
            if ai_summary:
                summary = ai_summary
            else:
                summary = "エンジン短時間解析に基づく自動講評です。評価値は先手視点です。"
        except Exception as e:
            print(f"要約生成エラー: {e}")
            summary = "エンジン短時間解析に基づく自動講評です。評価値は先手視点です。"
    else:
        summary = "エンジン短時間解析に基づく自動講評です。評価値は先手視点です。"

    # 7) 従来のLLM呼び出し（フォールバック）
    if not any(note.reasoning for note in notes):
        comments = _call_openai(_format_for_llm(moves, notes))
        if comments:
            # 行数に合わせて割当（ズレたらスキップ）
            for i, n in enumerate(notes):
                if i < len(comments):
                    n.comment = comments[i]
        else:
            # No LLM available: generate short rule-based comments per move
            for n in notes:
                delta = n.delta_cp if n.delta_cp is not None else 0
                # pick first principle label in readable text
                first_pr = principles_mod.PRINCIPLES.get(n.principles[0], "方針") if n.principles else "方針"
                bm = n.bestmove or "方針転換"
                n.comment = f"Δcp{delta:+d}。{first_pr}。改善案: {bm}"

    # 4) Ensure reasoning fields are populated (for v2 compatibility)
    try:
        from .routers.annotate import ensure_reasoning_populated
        
        # Convert notes to dict format for processing
        notes_dicts = [note.model_dump() for note in notes]
        
        # Ensure reasoning is populated
        processed_notes = ensure_reasoning_populated(notes_dicts)
        
        # Update notes with reasoning
        for i, note_dict in enumerate(processed_notes):
            if i < len(notes) and "reasoning" in note_dict:
                notes[i].reasoning = note_dict["reasoning"]
                
    except ImportError:
        # annotate router not available - add fallback reasoning
        for note in notes:
            if not hasattr(note, 'reasoning') or note.reasoning is None:
                note.reasoning = {
                    "summary": "基本的な分析です。",
                    "tags": note.tags,
                    "confidence": 0.5,
                    "method": "fallback",
                    "context": {
                        "phase": "middlegame",
                        "plan": "develop",
                        "move_type": "normal"
                    },
                    "pv_summary": {
                        "line": note.pv or "",
                        "why_better": []
                    }
                }
    except Exception as e:
        print(f"Warning: Could not populate reasoning: {e}")
        # Fallback reasoning for error case
        for note in notes:
            if not hasattr(note, 'reasoning') or note.reasoning is None:
                note.reasoning = {
                    "summary": "推論生成中にエラーが発生しました。",
                    "tags": [],
                    "confidence": 0.2,
                    "method": "error",
                    "context": {
                        "phase": "middlegame", 
                        "plan": "develop",
                        "move_type": "normal"
                    },
                    "pv_summary": {
                        "line": "",
                        "why_better": []
                    }
                }

    return AnnotateResponse(summary=summary, notes=notes)


@app.post("/digest", response_model=DigestResponse)
def digest(req: DigestRequest):
    # Normalize moves
    if req.usi:
        moves = _parse_usi_to_moves(req.usi)
    else:
        moves = req.moves or []
    if not moves:
        raise HTTPException(status_code=400, detail="棋譜が空です。")

    time_budget = req.time_budget_ms if req.time_budget_ms is not None else ENGINE_TIME_BUDGET_MS
    # allocate budgets
    quick_budget = int(time_budget * 0.3)
    deep_budget = int(time_budget * 0.6)

    # Quick pass
    quick = quick_eval_all(moves, time_per_move_ms=ENGINE_PER_MOVE_MS_A)
    # build score series
    scores = [q.score_cp for q in quick]
    deltas: List[Dict[str, Any]] = []
    prev = None
    for i, s in enumerate(scores, start=1):
        if prev is not None and s is not None:
            delta = s - prev
            deltas.append({"ply": i, "move": moves[i-1], "delta": delta, "before": prev, "after": s})
        prev = s if s is not None else prev

    # detect swings
    swings = [d for d in deltas if d.get("delta") is not None and abs(d["delta"]) >= 120]
    # rank by abs delta
    swings_sorted = sorted(swings, key=lambda x: abs(x["delta"]), reverse=True)
    # pick top K
    K = min(6, max(3, len(swings_sorted)))
    picks = [s["ply"] for s in swings_sorted[:K]]

    # dedupe nearby plies (within 1)
    picks_sorted = sorted(set(picks))
    dedup: List[int] = []
    for p in picks_sorted:
        if not any(abs(p - q) <= 1 for q in dedup):
            dedup.append(p)

    # Deep pass on dedup (convert to list)
    deep_results = deep_eval_focus(moves, dedup, per_ms=ENGINE_PER_FOCUS_MS_B, multipv=2)

    key_moments: List[KeyMoment] = []
    max_swing = 0
    for r in deep_results:
        ply = r.get("ply")
        mv = r.get("move")
        score = r.get("score_cp")
        # find quick before
        before = None
        if ply > 1 and len(quick) >= ply-1:
            before = quick[ply-2].score_cp
        delta = None
        if score is not None and before is not None:
            delta = score - before
        if delta is not None and abs(delta) > max_swing:
            max_swing = abs(delta)
        # tags/principles
        tags: List[str] = []
        if delta is not None:
            if delta <= -150:
                tags.append("悪手")
            elif delta <= -80:
                tags.append("疑問手")
            elif delta >= 120:
                tags.append("好手")
        # heuristics for tactical
        tactical = {"is_check": False, "is_capture": False}
        # map to principles
        principles: List[str] = []
        for t in tags:
            for pid in principles_mod.TAG_TO_PRINCIPLES.get(t, []):
                if pid not in principles:
                    principles.append(pid)

        key_moments.append(KeyMoment(ply=ply, move=mv, bestmove=r.get("bestmove"), delta_cp=delta, tags=tags, principles=principles, evidence={"tactical": tactical, "pv": r.get("pv")}, pv=r.get("pv")))

    # stats
    avg_cp = None
    numeric_scores = [s for s in scores if s is not None]
    if numeric_scores:
        avg_cp = int(mean(numeric_scores))
    lead_changes = 0
    # simple lead change count: sign changes in numeric_scores
    signs = [1 if s>0 else (-1 if s<0 else 0) for s in numeric_scores]
    for a, b in zip(signs, signs[1:]):
        if a != 0 and b != 0 and a != b:
            lead_changes += 1

    stats = {"plies": len(moves), "avg_cp": avg_cp, "max_swing_cp": max_swing, "lead_changes": lead_changes}

    # simple rule-based summary
    summary: List[str] = []
    summary.append(f"解析時間予算 {time_budget}ms、手数 {len(moves)} の概略ダイジェストです。")
    if max_swing:
        summary.append(f"最大の局面変化は Δcp {max_swing:+d} です。")
    if lead_changes:
        summary.append(f"リードチェンジが {lead_changes} 回発生しました。")
    # add top 3 key moments
    for km in key_moments[:3]:
        summary.append(f"{km.ply}手目 {km.move}: Δcp {km.delta_cp if km.delta_cp is not None else '？'}、タグ: {', '.join(km.tags or [])}")

    # try LLM refinement (short timeout)
    refined = _call_openai("\n".join(summary))
    if refined:
        # replace summary with LLM lines (bounded)
        summary = refined[:7]

    return DigestResponse(summary=summary, stats=stats, key_moments=key_moments, notes=None)


# ====== /analyze-game: 全手の評価推移と悪手検出 ======
class AnalyzeGameRequest(BaseModel):
    usi: str  # "startpos moves 7g7f 3c3d ..."
    pov: Literal["sente", "gote"] = "sente"
    depth: int = 10

class AnalyzeGameMove(BaseModel):
    ply: int
    move: str
    side: Literal["sente", "gote"]
    eval: Optional[int] = None  # sente視点 cp (mateは±10000等)
    povEval: Optional[int] = None  # pov視点の評価値
    delta: Optional[int] = None  # 直前手からの評価変化(pov視点)
    label: Literal["brilliant", "good", "inaccuracy", "mistake", "blunder", "normal"] = "normal"

class AnalyzeGameResponse(BaseModel):
    moves: List[AnalyzeGameMove]

def _score_to_cp(score_obj: Dict[str, Any]) -> Optional[int]:
    """エンジンのスコアオブジェクト {type: 'cp'|'mate', cp?: int, mate?: int} を cp 値に変換。mate は ±10000 にマップ。"""
    if not score_obj:
        return None
    stype = score_obj.get("type")
    if stype == "cp":
        return score_obj.get("cp")
    elif stype == "mate":
        mate_val = score_obj.get("mate")
        if mate_val is None:
            return None
        return 10000 if mate_val > 0 else -10000
    return None

@app.post("/analyze-game", response_model=AnalyzeGameResponse)
async def analyze_game(req: AnalyzeGameRequest):
    """
    棋譜全体の評価推移を取得し、各手に brilliant/good/inaccuracy/mistake/blunder/normal のラベルを付与する。
    engine_server (localhost:8001) の /analyze を順次呼び出して各局面の評価値を取得する。
    """
    # usi から手順を抽出
    parts = req.usi.strip().split()
    if len(parts) < 2 or parts[0] != "startpos" or parts[1] != "moves":
        raise HTTPException(status_code=400, detail="Invalid USI format. Expected 'startpos moves ...'")
    moves_list = parts[2:] if len(parts) > 2 else []
    
    if not moves_list:
        return AnalyzeGameResponse(moves=[])
    
    ENGINE_URL = os.environ.get("ENGINE_URL", "http://localhost:8001")
    result_moves: List[AnalyzeGameMove] = []
    prev_pov_eval: Optional[int] = None
    
    async with httpx.AsyncClient(timeout=5.0) as client:
        for i, mv in enumerate(moves_list):
            ply = i + 1
            side: Literal["sente", "gote"] = "sente" if ply % 2 == 1 else "gote"
            
            # この手を指した「後」の局面を作る
            position = "startpos moves " + " ".join(moves_list[: i+1])

            # engine に解析依頼
            eval_cp: Optional[int] = None
            try:
                resp = await client.post(
                    f"{ENGINE_URL}/analyze",
                    json={"position": position, "depth": req.depth, "multipv": 1}
                )
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("ok") and data.get("multipv"):
                        # multipv[0] の score を取得
                        first = data["multipv"][0]
                        score_obj = first.get("score")
                        eval_cp = _score_to_cp(score_obj)
            except Exception:
                pass  # タイムアウトや接続エラーの場合は eval_cp=None のまま
            
            # pov 視点の評価値を計算
            pov_eval: Optional[int] = None
            if eval_cp is not None:
                if req.pov == "sente":
                    # sente視点はそのまま or 反転
                    pov_eval = eval_cp if side == "sente" else -eval_cp
                else:  # pov == "gote"
                    pov_eval = -eval_cp if side == "sente" else eval_cp
            
            # delta 計算
            delta: Optional[int] = None
            if ply > 1 and pov_eval is not None and prev_pov_eval is not None:
                delta = pov_eval - prev_pov_eval
            
            # label 付け
            label: Literal["brilliant", "good", "inaccuracy", "mistake", "blunder", "normal"] = "normal"
            if delta is not None:
                if delta <= -300:
                    label = "blunder"
                elif delta <= -150:
                    label = "mistake"
                elif delta <= -80:
                    label = "inaccuracy"
                elif delta >= 200:
                    label = "brilliant"
                elif delta >= 80:
                    label = "good"
            
            result_moves.append(
                AnalyzeGameMove(
                    ply=ply,
                    move=mv,
                    side=side,
                    eval=eval_cp,
                    povEval=pov_eval,
                    delta=delta,
                    label=label
                )
            )
            prev_pov_eval = pov_eval
    
    return AnalyzeGameResponse(moves=result_moves)

@app.get("/api/analysis/stream")
def analysis_stream(position: str):
    components = _extract_position_components(position)
    moves = components.get("moves") or []
    sfen = components.get("sfen")
    areq = AnalyzeRequest(
        sfen=sfen or None,
        moves=moves or None,
        multipv=3,
    )
    return StreamingResponse(engine.stream_analyze(areq), media_type="text/event-stream")


@app.post("/api/analysis/batch", response_model=BatchAnalysisResponse)
def analysis_batch(req: BatchAnalysisRequest):
    position_literal = req.position or req.usi
    if not position_literal:
        raise HTTPException(status_code=400, detail="position or usi is required")

    components = _extract_position_components(position_literal)
    moves = components.get("moves") or []
    sfen = components.get("sfen") or None
    if not moves and not req.max_ply:
        # still analyze starting position (ply 0)
        target_moves = 0
    else:
        max_ply = req.max_ply if req.max_ply is not None else len(moves)
        target_moves = min(max_ply, len(moves))

    movetime_ms = req.movetime_ms or 200
    time_budget_ms = req.time_budget_ms or 25000
    multipv = max(1, req.multipv or 3)

    start_time = time.monotonic()
    analyses: Dict[int, Dict[str, Any]] = {}

    for ply in range(0, target_moves + 1):
        elapsed_ms = (time.monotonic() - start_time) * 1000
        if elapsed_ms >= time_budget_ms:
            break

        partial_moves = moves[:ply]
        analyze_req = AnalyzeRequest(
            sfen=sfen,
            moves=partial_moves or None,
            byoyomi_ms=movetime_ms,
            multipv=multipv,
        )

        try:
            res = engine.analyze(analyze_req)
        except Exception as exc:
            analyses[ply] = {"ok": False, "error": str(exc)}
            continue

        payload = _analyze_response_to_payload(res, multipv)
        analyses[ply] = payload

    total_elapsed_ms = int((time.monotonic() - start_time) * 1000)
    response = BatchAnalysisResponse(
        analyses=analyses,
        elapsed_ms=total_elapsed_ms,
        analyzed_plies=len(analyses),
    )
    return response
