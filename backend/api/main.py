import subprocess, threading, queue, time, os
from typing import List, Optional, Dict, Any
from . import principles as principles_mod
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ====== 環境変数 ======
ENGINE_PATH = os.environ.get("ENGINE_PATH", "/usr/local/bin/yaneuraou")
DEFAULT_BYOYOMI_MS = int(os.environ.get("DEFAULT_BYOYOMI_MS", "1000"))
DEFAULT_THREADS = int(os.environ.get("ENGINE_THREADS", "4"))
DEFAULT_HASH_MB = int(os.environ.get("ENGINE_HASH_MB", "1024"))
ENGINE_USE_BOOK = os.environ.get("ENGINE_USE_BOOK", "false").lower() == "true"
ENGINE_READY_TIMEOUT = int(os.environ.get("ENGINE_READY_TIMEOUT", "60"))

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
    verdict: Optional[str] = None        # “好手/疑問手/悪手”など（旧フィールド）
    comment: Optional[str] = None        # LLM or ルール生成コメント


class AnnotateResponse(BaseModel):
    summary: str
    notes: List[MoveNote]


# ====== Annotate ヘルパー ======
def _parse_usi_to_moves(usi: str) -> List[str]:
    """
    'startpos moves 7g7f 3c3d ...' / 'position sfen <...> moves ...' / 純粋なUSI配列 への軽対応。
    厳密対応は今後拡張。
    """
    usi = usi.strip()
    if usi.startswith("startpos"):
        # "startpos moves ..." から moves 部分だけ抜く
        toks = usi.split()
        if "moves" in toks:
            i = toks.index("moves")
            return toks[i+1:]
        return []
    if " position " in usi or usi.startswith("position"):
        toks = usi.split()
        if "moves" in toks:
            i = toks.index("moves")
            return toks[i+1:]
        return []
    # スペース区切りのUSI列とみなす
    return [t for t in usi.split() if len(t) >= 4]


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
            if req.sfen:
                self._send(f"position sfen {req.sfen}")
            elif req.moves:
                seq = " ".join(req.moves)
                self._send(f"position startpos moves {seq}")
            else:
                self._send("position startpos")

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

# ====== FastAPI ======
engine = USIEngine(ENGINE_PATH)
app = FastAPI(title="Shogi Analyze API", version="0.2.0")

# CORS ミドルウェアを追加
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
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

    # 3) LLM 呼び出し（任意）
    summary = "エンジン短時間解析に基づく自動講評です。評価値は先手視点です。"
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

    return AnnotateResponse(summary=summary, notes=notes)
