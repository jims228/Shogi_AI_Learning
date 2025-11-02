# backend/api/main.py
import subprocess
import threading
import queue
import time
import os
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel


# ====== 環境変数（デフォルト値あり）======
ENGINE_PATH = os.environ.get("ENGINE_PATH", "/usr/local/bin/yaneuraou")
DEFAULT_BYOYOMI_MS = int(os.environ.get("DEFAULT_BYOYOMI_MS", "1000"))
DEFAULT_THREADS = int(os.environ.get("ENGINE_THREADS", "4"))          # 今は未使用だが将来拡張用
DEFAULT_HASH_MB = int(os.environ.get("ENGINE_HASH_MB", "1024"))       # 今は未使用（起動時に別で設定）
USE_BOOK = os.environ.get("ENGINE_USE_BOOK", "false").lower() == "true"


# ====== リクエスト/レスポンス ======
class AnalyzeRequest(BaseModel):
    sfen: Optional[str] = None
    moves: Optional[List[str]] = None      # startpos 前提の指し手配列 ["7g7f", ...]
    byoyomi_ms: Optional[int] = None
    multipv: Optional[int] = 1             # 将来拡張（今はbestmoveだけ返す）


class AnalyzeResponse(BaseModel):
    bestmove: str
    info: Optional[str] = None             # 解析ログ（末尾数行）


# ====== USI エンジン管理 ======
class USIEngine:
    def __init__(self, path: str):
        self.path = path
        self.proc: Optional[subprocess.Popen] = None
        self.lock = threading.Lock()
        self.q: "queue.Queue[str]" = queue.Queue()
        self.reader_thread: Optional[threading.Thread] = None

    # 標準出力を読み取り、行ごとにキューへ
    def _reader(self):
        assert self.proc and self.proc.stdout
        for line in self.proc.stdout:
            self.q.put(line.rstrip("\n"))

    def start(self):
        # 既に生きていれば何もしない
        if self.proc and self.proc.poll() is None:
            return

        # Popen（テキストモード・行バッファ）
        self.proc = subprocess.Popen(
            [self.path],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )

        # 読み取りスレッド開始
        self.reader_thread = threading.Thread(target=self._reader, daemon=True)
        self.reader_thread.start()

        # 起動直後の初期化
        self.send("usi")

        # 起動を軽くするためのオプション（環境変数で上書き可）
        use_book = os.getenv("ENGINE_USE_BOOK", "false").lower() == "true"  # 既定: 定跡OFF
        hash_mb = int(os.getenv("ENGINE_HASH_MB", "16"))                    # 既定: 16MB（起動高速化用）
        self.send(f"setoption name USI_OwnBook value {'true' if use_book else 'false'}")
        self.send(f"setoption name USI_Hash value {hash_mb}")

        # usiok / readyok 待ち（タイムアウトは環境変数で延長可）
        timeout_s = int(os.getenv("ENGINE_READY_TIMEOUT", "60"))
        self._wait_for("usiok", timeout=timeout_s)
        self.send("isready")
        self._wait_for("readyok", timeout=timeout_s)

    def send(self, cmd: str):
        """USIエンジンへコマンドを送る（末尾に改行を付与）"""
        if not self.proc or not self.proc.stdin:
            raise RuntimeError("engine is not started")
        self.proc.stdin.write(cmd + "\n")
        self.proc.stdin.flush()

    def _drain(self):
        """未読行をすべて捨てて返す（デバッグ用途）"""
        lines: List[str] = []
        while True:
            try:
                lines.append(self.q.get_nowait())
            except queue.Empty:
                break
        return lines

    def _wait_for(self, token: str, timeout: float):
        """stdout から token が現れるまで待機"""
        end = time.time() + timeout
        while time.time() < end:
            try:
                line = self.q.get(timeout=0.1)
            except queue.Empty:
                continue
            if token in line:
                return True
        raise TimeoutError(f"timeout waiting for {token}")

    def analyze(self, sfen: Optional[str], moves: Optional[List[str]], byoyomi_ms: int) -> AnalyzeResponse:
        with self.lock:
            # エンジン起動確認
            if not self.proc or self.proc.poll() is not None:
                self.start()

            # 余分な出力を捨てる
            self._drain()

            # 局面セット
            if sfen:
                self.send(f"position sfen {sfen}")
            elif moves:
                seq = " ".join(moves)
                self.send(f"position startpos moves {seq}")
            else:
                self.send("position startpos")

            # 思考開始
            self.send(f"go byoyomi {byoyomi_ms}")

            bestmove: Optional[str] = None
            info_log: List[str] = []
            # byoyomi + バッファ時間（最低5秒）
            deadline = time.time() + max(5.0, byoyomi_ms / 1000.0 + 2.0)
            while time.time() < deadline:
                try:
                    line = self.q.get(timeout=0.1)
                    if line.startswith("info "):
                        info_log.append(line)
                    if line.startswith("bestmove "):
                        parts = line.split()
                        if len(parts) >= 2:
                            bestmove = parts[1]
                        break
                except queue.Empty:
                    continue

            if not bestmove:
                # 念のため stop -> bestmove をもう少し待つ
                self.send("stop")
                try:
                    while True:
                        line = self.q.get(timeout=0.2)
                        if line.startswith("bestmove "):
                            parts = line.split()
                            if len(parts) >= 2:
                                bestmove = parts[1]
                            break
                except queue.Empty:
                    pass

            if not bestmove:
                raise RuntimeError("bestmove を取得できませんでした。")

            return AnalyzeResponse(bestmove=bestmove, info="\n".join(info_log[-10:]))

    def quit(self):
        try:
            if self.proc and self.proc.poll() is None:
                self.send("quit")
                self.proc.wait(timeout=2)
        except Exception:
            pass


# ====== FastAPI アプリ ======
engine = USIEngine(ENGINE_PATH)
app = FastAPI(title="Shogi Analyze API", version="0.1.0")


@app.on_event("startup")
def _on_startup():
    # 起動時にエンジンを立ち上げるのを一旦スキップ
    print("🟡 Skip engine.start() at startup (lazy load mode)")
    # engine.start()


@app.on_event("shutdown")
def _on_shutdown():
    engine.quit()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest):
    byoyomi = req.byoyomi_ms if req.byoyomi_ms is not None else DEFAULT_BYOYOMI_MS
    try:
        if not engine.proc or engine.proc.poll() is not None:
            engine.start()  # ←ここを追加
        return engine.analyze(req.sfen, req.moves, byoyomi)
    except TimeoutError as e:
        raise HTTPException(status_code=504, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
