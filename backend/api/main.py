from __future__ import annotations
import asyncio, os, re, shlex, time, json, shutil
from typing import Optional, Dict, Any, List
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv

# AIサービスをインポート
from backend.api.services.ai_service import AIService

load_dotenv()

# ====== 設定 ======
# エンジンのパス (固定)
USI_CMD = "/usr/local/bin/yaneuraou"
# 作業ディレクトリ (固定: 評価関数がある場所)
ENGINE_WORK_DIR = "/usr/local/bin"

print(f"[Config] Engine Path: {USI_CMD}")
print(f"[Config] Work Dir:   {ENGINE_WORK_DIR}")

USI_BOOT_TIMEOUT = 10.0
USI_GO_TIMEOUT = 20.0

app = FastAPI(title="USI Engine Gateway")

# CORS設定: フロントエンドからのアクセスを許可
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 開発用に全許可
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ====== データモデル ======
class AnalyzeIn(BaseModel):
    position: str
    depth: int = 15
    multipv: int = 3

class ExplainRequest(BaseModel):
    sfen: str
    ply: int
    bestmove: str
    score_cp: Optional[int] = None
    score_mate: Optional[int] = None
    pv: str
    turn: str
    history: List[str] = []
    user_move: Optional[str] = None

class GameDigestInput(BaseModel):
    total_moves: int
    eval_history: List[int]
    winner: Optional[str] = None

class BatchAnalysisRequest(BaseModel):
    position: Optional[str] = None
    usi: Optional[str] = None
    moves: Optional[List[str]] = None
    max_ply: Optional[int] = None
    movetime_ms: Optional[int] = None
    multipv: Optional[int] = None
    time_budget_ms: Optional[int] = None

class MateRequest(BaseModel):
    sfen: str
    timeout: int = 1000

# ====== エンジン基底クラス (デバッグ機能付き) ======
class BaseEngine:
    def __init__(self, name="Engine"):
        self.proc: Optional[asyncio.subprocess.Process] = None
        self.name = name

    async def _send_line(self, s: str):
        if self.proc and self.proc.stdin:
            try:
                print(f"[{self.name}] >>> {s}") # Debug Log
                self.proc.stdin.write((s + "\n").encode())
                await self.proc.stdin.drain()
            except Exception as e:
                print(f"[{self.name}] Send Error: {e}")

    async def _read_line(self, timeout: float = 0.5) -> Optional[str]:
        if not self.proc or not self.proc.stdout: return None
        try:
            line_bytes = await asyncio.wait_for(self.proc.stdout.readline(), timeout=timeout)
            if not line_bytes: return None
            line = line_bytes.decode(errors="ignore").strip()
            if line:
                print(f"[{self.name}] <<< {line}") # Debug Log
            return line
        except asyncio.TimeoutError:
            return None

    async def _wait_until(self, pred, timeout: float):
        end = time.time() + timeout
        while time.time() < end:
            line = await self._read_line(timeout=0.5)
            if line and pred(line): break

    async def _log_stderr(self):
        if self.proc and self.proc.stderr:
            try:
                data = await self.proc.stderr.read()
                if data:
                    msg = data.decode(errors='ignore').strip()
                    print(f"[{self.name}] [CRASH LOG] {msg}")
            except Exception:
                pass

    def parse_usi_info(self, line: str) -> Optional[Dict[str, Any]]:
        if "score" not in line or "pv" not in line: return None
        try:
            data = {"multipv": 1}
            # multipv
            mp = re.search(r'multipv\s+(\d+)', line)
            if mp: data["multipv"] = int(mp.group(1))

            # score (cp or mate)
            sc = re.search(r'score\s+(cp|mate)\s+(?:lowerbound\s+|upperbound\s+)?([\+\-]?\d+)', line)
            if sc:
                kind = sc.group(1)
                val = int(sc.group(2))
                data["score"] = {"type": kind, "cp" if kind == "cp" else "mate": val}
            else:
                return None

            # pv
            pv = re.search(r' pv\s+(.*)', line)
            if pv: data["pv"] = pv.group(1).strip()
            
            return data
        except:
            return None

# ====== ストリーミング用エンジン (常駐・シングルトン) ======
class EngineState(BaseEngine):
    def __init__(self):
        super().__init__(name="StreamEngine")
        self.lock = asyncio.Lock()

    async def ensure_alive(self):
        if self.proc and self.proc.returncode is None:
            return
        
        print(f"[{self.name}] Starting: {USI_CMD}")
        try:
            self.proc = await asyncio.create_subprocess_exec(
                *shlex.split(USI_CMD),
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE, # Captured for debug
                cwd=ENGINE_WORK_DIR
            )
            
            await self._send_line("usi")
            await self._wait_until(lambda l: "usiok" in l, USI_BOOT_TIMEOUT)
            
            # ★修正: MultiPVを3に固定
            await self._send_line("setoption name MultiPV value 3")
            
            await self._send_line("setoption name Threads value 1")
            await self._send_line("setoption name USI_Hash value 128")
            await self._send_line("setoption name OwnBook value false")
            
            await self._send_line("isready")
            await self._wait_until(lambda l: "readyok" in l, USI_BOOT_TIMEOUT)
            await self._send_line("usinewgame")
            
            print(f"[{self.name}] Ready")
        except Exception as e:
            print(f"[{self.name}] Start Failed: {e}")
            await self._log_stderr()
            if self.proc:
                try: self.proc.kill()
                except: pass
            self.proc = None

    async def stop_and_flush(self):
        """
        stopコマンドを送り、bestmoveが来るかタイムアウト(1.0s)するまで出力を読み捨てる。
        """
        if not self.proc: return
        
        print(f"[{self.name}] Stop & Flush Start")
        await self._send_line("stop")
        
        end_time = time.time() + 1.0
        while time.time() < end_time:
            line = await self._read_line(timeout=0.2)
            if not line:
                continue
            if line.startswith("bestmove"):
                print(f"[{self.name}] Stop & Flush: Found bestmove")
                return
        print(f"[{self.name}] Stop & Flush: Timeout (No bestmove found)")

    async def stream_analyze(self, req: AnalyzeIn):
        async with self.lock:
            await self.ensure_alive()
            if not self.proc:
                print(f"[{self.name}] Engine not available")
                yield f"data: {json.dumps({'error': 'Engine not available'})}\n\n"
                return
            
            # 解析前に必ず停止＆フラッシュ
            await self.stop_and_flush()
            
            # 準備確認
            await self._send_line("isready")
            await self._wait_until(lambda l: "readyok" in l, 2.0)
            
            # コマンド送信
            print(f"[{self.name}] Analyzing: {req.position}")
            
            # ★修正: positionコマンドの二重付与を防止
            pos_cmd = req.position if req.position.startswith("position") else f"position {req.position}"
            await self._send_line(pos_cmd)
            
            await self._send_line(f"go depth {req.depth} multipv {req.multipv}")
            
            while True:
                line = await self._read_line(timeout=2.0)
                
                if line is None:
                    yield ": keepalive\n\n"
                    if self.proc and self.proc.returncode is not None:
                        print(f"[{self.name}] Process Died! ReturnCode: {self.proc.returncode}")
                        await self._log_stderr()
                        break
                    continue

                if not line: break

                if line.startswith("bestmove"):
                    parts = line.split()
                    if len(parts) > 1:
                        yield f"data: {json.dumps({'bestmove': parts[1]})}\n\n"
                    break
                
                info = self.parse_usi_info(line)
                if info:
                    yield f"data: {json.dumps({'multipv_update': info})}\n\n"

    async def solve_mate(self, sfen: str, timeout_ms: int = 1000) -> Dict[str, Any]:
        async with self.lock:
            await self.ensure_alive()
            if not self.proc:
                return {"is_mate": False, "error": "Engine not available"}
            
            # 状態クリア
            await self.stop_and_flush()
            
            # 準備
            await self._send_line("isready")
            await self._wait_until(lambda l: "readyok" in l, 2.0)
            
            # 局面設定
            pos_cmd = sfen if sfen.startswith("position") else f"position sfen {sfen}"
            await self._send_line(pos_cmd)
            
            # 詰み探索コマンド
            print(f"[{self.name}] Solving Mate: {timeout_ms}ms")
            await self._send_line(f"go mate {timeout_ms}")
            
            start_time = time.time()
            # エンジンのタイムアウト + バッファ
            wait_limit = (timeout_ms / 1000.0) + 2.0
            
            while time.time() - start_time < wait_limit:
                line = await self._read_line(timeout=1.0)
                if not line: continue
                
                if line.startswith("checkmate nomate"):
                    return {"is_mate": False}
                elif line.startswith("checkmate timeout"):
                    return {"is_mate": False, "reason": "timeout"}
                elif line.startswith("checkmate"):
                    # checkmate <move1> <move2> ...
                    parts = line.split()
                    if len(parts) > 1:
                        return {"is_mate": True, "moves": parts[1:]}
                    else:
                        # checkmateだけで手が来ないケースは稀だがnomate扱いかエラー
                        return {"is_mate": True, "moves": []}
                elif line.startswith("bestmove"):
                    # 通常探索に落ちた場合など
                    return {"is_mate": False, "reason": "bestmove_received"}
            
            return {"is_mate": False, "reason": "no_response"}

# ====== バッチ用エンジン (都度起動・使い捨て) ======
class BatchEngine(BaseEngine):
    def __init__(self):
        super().__init__(name="BatchEngine")

    async def start(self):
        print(f"[{self.name}] Starting: {USI_CMD}")
        try:
            self.proc = await asyncio.create_subprocess_exec(
                *shlex.split(USI_CMD),
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=ENGINE_WORK_DIR
            )
            
            await self._send_line("usi")
            await self._wait_until(lambda l: "usiok" in l, USI_BOOT_TIMEOUT)
            
            await self._send_line("setoption name Threads value 1")
            await self._send_line("setoption name USI_Hash value 128")
            await self._send_line("setoption name OwnBook value false")
            
            await self._send_line("isready")
            await self._wait_until(lambda l: "readyok" in l, USI_BOOT_TIMEOUT)
            await self._send_line("usinewgame")
            
            print(f"[{self.name}] Ready")
        except Exception as e:
            print(f"[{self.name}] Start Failed: {e}")
            if self.proc:
                try: self.proc.kill()
                except: pass
            self.proc = None
            raise e

    async def close(self):
        if self.proc:
            print(f"[{self.name}] Closing...")
            await self._send_line("quit")
            try:
                # 少し待ってからkill
                try:
                    await asyncio.wait_for(self.proc.wait(), timeout=1.0)
                except asyncio.TimeoutError:
                    self.proc.kill()
            except:
                pass
            self.proc = None

    async def analyze_one(self, position: str, depth: int, multipv: int) -> Dict[str, Any]:
        if not self.proc: return {"ok": False}

        # バッチ処理では前の手が終わっている前提なのでstop_and_flushは不要だが
        # 念のためisreadyで同期をとる
        await self._send_line("isready")
        await self._wait_until(lambda l: "readyok" in l, 2.0)

        # ★修正: positionコマンドの二重付与を防止
        pos_cmd = position if position.startswith("position") else f"position {position}"
        await self._send_line(pos_cmd)
        
        await self._send_line(f"go depth {depth} multipv {multipv}")
        
        bestmove = None
        cands = []
        end_time = time.time() + USI_GO_TIMEOUT

        while time.time() < end_time:
            line = await self._read_line(timeout=0.5)
            if not line: continue
            
            if line.startswith("bestmove"):
                parts = line.split()
                if len(parts) > 1: bestmove = parts[1]
                break
            
            info = self.parse_usi_info(line)
            if info:
                exists = False
                for i, c in enumerate(cands):
                    if c["multipv"] == info["multipv"]:
                        cands[i] = info
                        exists = True
                        break
                if not exists: cands.append(info)

        return {
            "ok": bestmove is not None,
            "bestmove": bestmove,
            "multipv": sorted(cands, key=lambda x: x["multipv"]),
        }

    async def analyze_sequence_stream(self, moves: List[str], time_budget_ms: Optional[int] = None):
        if not self.proc: return
        
        start_time = time.time()
        
        for i in range(len(moves) + 1):
            # タイムアウトガード
            if time_budget_ms and (time.time() - start_time > time_budget_ms / 1000):
                break 

            pos = "startpos moves " + " ".join(moves[:i]) if i > 0 else "startpos"
            
            # 浅めの探索で高速化
            res = await self.analyze_one(pos, depth=10, multipv=1)
            if res["ok"]:
                yield json.dumps({"ply": i, "result": res}) + "\n"

# シングルトンインスタンス (Stream用)
stream_engine = EngineState()

# ====== エンドポイント ======
@app.get("/")
def root(): return {"message": "engine ok"}

@app.get("/health")
def health(): return {"status": "ok"}

@app.post("/analyze")
async def analyze_endpoint(body: AnalyzeIn):
    # 単発解析はStream用エンジンを借用する（ロック制御あり）
    # ただしanalyzeメソッドはEngineStateに実装していないため、
    # ここでは簡易的にBatchEngineを都度起動するか、EngineStateにanalyzeを追加する必要がある。
    # 今回の要件ではStreamとBatchの分離が主眼なので、単発解析もBatchEngineを使うのが安全。
    engine = BatchEngine()
    try:
        await engine.start()
        return await engine.analyze_one(body.position, body.depth, body.multipv)
    finally:
        await engine.close()

@app.post("/api/explain")
async def explain_endpoint(req: ExplainRequest):
    # サービス層に委譲
    return {"explanation": await AIService.generate_shogi_explanation(req.dict())}

@app.post("/api/explain/digest")
async def digest_endpoint(req: GameDigestInput):
    # サービス層に委譲
    return {"explanation": await AIService.generate_game_digest(req.dict())}

@app.post("/api/analysis/batch")
async def batch_endpoint(req: BatchAnalysisRequest):
    moves = req.moves or []
    if req.usi and "moves" in req.usi:
         moves = req.usi.split("moves")[1].split()
    
    async def generator():
        engine = BatchEngine()
        try:
            await engine.start()
            async for line in engine.analyze_sequence_stream(moves, req.time_budget_ms):
                yield line
        except Exception as e:
            print(f"Batch error: {e}")
            yield json.dumps({"error": str(e)}) + "\n"
        finally:
            await engine.close()

    return StreamingResponse(generator(), media_type="application/x-ndjson")

@app.get("/api/analysis/stream")
def stream_endpoint(position: str):
    return StreamingResponse(
        stream_engine.stream_analyze(AnalyzeIn(position=position, depth=15, multipv=3)),
        media_type="text/event-stream"
    )

@app.post("/api/solve/mate")
async def solve_mate_endpoint(req: MateRequest):
    """
    詰み探索を実行するエンドポイント
    """
    return await stream_engine.solve_mate(req.sfen, req.timeout)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
