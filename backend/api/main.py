import subprocess, threading, queue, time, os
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException
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
