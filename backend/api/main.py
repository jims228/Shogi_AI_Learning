from __future__ import annotations
import asyncio, os, re, shlex, time, json, shutil
from typing import Optional, Dict, Any, List, AsyncGenerator
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv

from backend.api.services.ai_service import AIService
from backend.api.tsume_data import TSUME_PROBLEMS

load_dotenv()

# ====== 設定 ======
USI_CMD = "/usr/local/bin/yaneuraou"
ENGINE_WORK_DIR = "/usr/local/bin"
EVAL_DIR = "/usr/local/bin/eval"

# 評価値のマイルド係数
SCORE_SCALE = 0.7 

print(f"[Config] Engine Path: {USI_CMD}")
print(f"[Config] Work Dir:   {ENGINE_WORK_DIR}")
print(f"[Config] Eval Dir:   {EVAL_DIR}")

USI_BOOT_TIMEOUT = 10.0
USI_GO_TIMEOUT = 20.0

app = FastAPI(title="USI Engine Gateway")

_default_origins = ["http://localhost:3000", "http://localhost:3001"]
_env_origins = os.getenv("FRONTEND_ORIGINS", "")
_origins = [o.strip() for o in _env_origins.split(",") if o.strip()] or _default_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalyzeIn(BaseModel):
    position: str
    depth: int = 15
    multipv: int = 3 # デフォルト3

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

class TsumePlayRequest(BaseModel):
    sfen: str

# ====== エンジン基底クラス ======
class BaseEngine:
    def __init__(self, name="Engine"):
        self.proc: Optional[asyncio.subprocess.Process] = None
        self.name = name

    async def _send_line(self, s: str):
        if self.proc and self.proc.stdin:
            try:
                # print(f"[{self.name}] >>> {s}") # ログ抑制
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
            # ログは必要な時だけ
            if line and (line.startswith("bestmove") or line.startswith("checkmate")):
                 print(f"[{self.name}] <<< {line}")
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
                    print(f"[{self.name}] [STDERR] {msg}")
            except Exception:
                pass

    def parse_usi_info(self, line: str) -> Optional[Dict[str, Any]]:
        if "score" not in line or "pv" not in line: return None
        try:
            data = {"multipv": 1}
            mp = re.search(r'multipv\s+(\d+)', line)
            if mp: data["multipv"] = int(mp.group(1))

            sc = re.search(r'score\s+(cp|mate)\s+(?:lowerbound\s+|upperbound\s+)?([\+\-]?\d+)', line)
            if sc:
                kind = sc.group(1)
                val = int(sc.group(2))
                
                # 評価値のマイルド化 (ここで行う)
                if kind == "cp":
                    val = int(val * SCORE_SCALE)
                
                data["score"] = {"type": kind, "cp" if kind == "cp" else "mate": val}
            else:
                return None

            pv = re.search(r' pv\s+(.*)', line)
            if pv: data["pv"] = pv.group(1).strip()
            return data
        except:
            return None

# ====== ヘルパー関数: 手番判定 ======
def is_gote_turn(position_cmd: str) -> bool:
    """
    positionコマンドから、現在の手番が後手(w)かどうかを判定する
    """
    # パターン1: "position startpos moves ..."
    if "startpos" in position_cmd:
        if "moves" not in position_cmd:
            return False # movesがない＝初期局面＝先手
        moves_part = position_cmd.split("moves")[1].strip()
        if not moves_part: return False
        moves = moves_part.split()
        return len(moves) % 2 != 0 # 奇数手目なら後手番

    # パターン2: "position sfen ..."
    if "sfen" in position_cmd:
        parts = position_cmd.split()
        try:
            # sfen <board> <color> ...
            sfen_index = parts.index("sfen")
            turn = parts[sfen_index + 2] # +1は盤面、+2が手番
            return turn == 'w'
        except:
            return False
            
    return False

# ====== ストリーミング用エンジン (検討モード用・常駐) ======
class EngineState(BaseEngine):
    def __init__(self, name="StreamEngine"):
        super().__init__(name=name)
        self.lock = asyncio.Lock()

    async def ensure_alive(self):
        if self.proc and self.proc.returncode is None: return
        print(f"[{self.name}] Starting: {USI_CMD}")
        try:
            self.proc = await asyncio.create_subprocess_exec(
                USI_CMD, 
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=ENGINE_WORK_DIR 
            )
            await self._send_line("usi")
            await self._wait_until(lambda l: "usiok" in l, USI_BOOT_TIMEOUT)
            
            await self._send_line("setoption name Threads value 1")
            await self._send_line("setoption name USI_Hash value 64")
            if os.path.exists(EVAL_DIR):
                await self._send_line(f"setoption name EvalDir value {EVAL_DIR}")
            await self._send_line("setoption name OwnBook value false")
            
            # ★修正: 検討モード用に MultiPV 3 をデフォルト設定
            await self._send_line("setoption name MultiPV value 3")
            
            await self._send_line("isready")
            await self._wait_until(lambda l: "readyok" in l, USI_BOOT_TIMEOUT)
            
            await self._send_line("usinewgame")
            await self._send_line("isready")
            await self._wait_until(lambda l: "readyok" in l, 5.0)
            
            print(f"[{self.name}] Ready")
        except Exception as e:
            print(f"[{self.name}] Start Failed: {e}")
            await self._log_stderr()
            self.proc = None

    async def stop_and_flush(self):
        if not self.proc: return
        await self._send_line("stop")
        end_time = time.time() + 0.5
        while time.time() < end_time:
            line = await self._read_line(timeout=0.1)
            if not line: continue
            if line.startswith("bestmove"):
                return

    async def stream_analyze(self, req: AnalyzeIn):
        async with self.lock:
            await self.ensure_alive()
            if not self.proc:
                yield f"data: {json.dumps({'error': 'Engine not available'})}\n\n"
                return
            
            await self.stop_and_flush()
            
            await self._send_line("isready")
            await self._wait_until(lambda l: "readyok" in l, 2.0)
            
            pos_cmd = req.position if req.position.startswith("position") else f"position {req.position}"
            await self._send_line(pos_cmd)
            
            # ★手番判定: ギザギザ防止のため、後手番かどうかを判定
            is_gote = is_gote_turn(pos_cmd)
            
            # multipv 3 (リクエストに従う)
            await self._send_line(f"go depth {req.depth} multipv {req.multipv}")
            
            while True:
                line = await self._read_line(timeout=2.0)
                if line is None:
                    yield ": keepalive\n\n"
                    if self.proc and self.proc.returncode is not None: break
                    continue
                if not line: break
                if line.startswith("bestmove"):
                    parts = line.split()
                    if len(parts) > 1:
                        yield f"data: {json.dumps({'bestmove': parts[1]})}\n\n"
                    break
                
                info = self.parse_usi_info(line)
                if info:
                    # ★修正: 検討モードでも評価値を反転させる（ギザギザ防止）
                    if is_gote and "score" in info:
                        s = info["score"]
                        if s["type"] == "cp":
                            s["cp"] = -s["cp"]
                        elif s["type"] == "mate":
                            s["mate"] = -s["mate"]

                    yield f"data: {json.dumps({'multipv_update': info})}\n\n"

    async def solve_tsume_hand(self, sfen: str) -> Dict[str, Any]:
        async with self.lock:
            await self.ensure_alive()
            if not self.proc: return {"status": "error", "message": "Engine not started"}
            
            is_idle = False
            try:
                await self._send_line("isready")
                await self._wait_until(lambda l: "readyok" in l, 0.1)
                is_idle = True
            except asyncio.TimeoutError:
                is_idle = False
            
            if not is_idle:
                await self.stop_and_flush()
                await self._send_line("isready")
                await self._wait_until(lambda l: "readyok" in l, 2.0)
            
            sfen_cmd = sfen if sfen.startswith("sfen") else f"sfen {sfen}"
            cmd = f"position {sfen_cmd}"
            await self._send_line(cmd)
            
            await self._send_line("go nodes 2000")
            
            bestmove = None
            mate_found = False
            start_time = time.time()
            
            while time.time() - start_time < 5.0:
                line = await self._read_line(timeout=1.0)
                if not line:
                    if self.proc.returncode is not None:
                        self.proc = None
                        return {"status": "error", "message": "Engine crashed"}
                    continue
                
                line_str = line 
                
                if "score mate -" in line_str:
                    mate_found = True
                elif "score mate +" in line_str:
                    mate_found = False

                if line_str.startswith("bestmove"):
                    parts = line_str.split()
                    if len(parts) > 1:
                        bestmove = parts[1]
                    break
            
            if not bestmove:
                await self.stop_and_flush()
                return {"status": "error", "message": "Timeout"}
            
            print(f"[{self.name}] Escape: {bestmove}, Mate: {mate_found}")
            
            if bestmove == "resign":
                return {"status": "win", "bestmove": "resign", "message": "正解！詰みました！"}
            elif bestmove == "win":
                return {"status": "lose", "bestmove": "win", "message": "不正解：入玉されてしまいました"}
            else:
                if mate_found:
                    return {"status": "continue", "bestmove": bestmove, "message": "正解！"}
                else:
                    return {"status": "incorrect", "bestmove": bestmove, "message": "その手では詰みません"}

# ====== バッチ用エンジン (常駐化対応) ======
class BatchEngineState(EngineState):
    def __init__(self):
        super().__init__(name="BatchEngine")

    # 高速解析コマンド (全体解析専用)
    async def fast_analyze_one(self, position_cmd: str) -> Dict[str, Any]:
        if not self.proc: return {"ok": False}
        
        await self._send_line(position_cmd)
        
        # 全体解析は multipv 1 で高速化
        await self._send_line(f"go nodes 150000 multipv 1")
        
        bestmove = None
        cands_map = {}
        end_time = time.time() + 10.0 

        while time.time() < end_time:
            line = await self._read_line(timeout=0.5)
            if not line: continue
            
            if "score" in line and "pv" in line:
                info = self.parse_usi_info(line)
                if info and "multipv" in info:
                    cands_map[info["multipv"]] = info

            if line.startswith("bestmove"):
                parts = line.split()
                if len(parts) > 1: bestmove = parts[1]
                break
        
        sorted_cands = sorted(cands_map.values(), key=lambda x: x["multipv"])

        return {
            "ok": bestmove is not None,
            "bestmove": bestmove,
            "multipv": sorted_cands,
        }
    
    async def stream_batch_analyze(self, moves: List[str], time_budget_ms: int = None) -> AsyncGenerator[str, None]:
        async with self.lock:
            await self.ensure_alive()
            await self.stop_and_flush()

            yield json.dumps({"status": "start"}) + (" " * 4096) + "\n"
            
            start_time = time.time()
            
            for i in range(len(moves) + 1):
                if time_budget_ms and (time.time() - start_time > time_budget_ms / 1000):
                    print(f"[{self.name}] Time budget exceeded at ply {i}")
                    break 
                
                pos_str = "startpos moves " + " ".join(moves[:i]) if i > 0 else "startpos"
                pos_cmd = f"position {pos_str}"
                
                res = await self.fast_analyze_one(pos_cmd)
                
                if res["ok"]:
                    # 反転ロジック (全体解析用)
                    if i % 2 != 0:
                        for item in res["multipv"]:
                            if "score" in item:
                                s = item["score"]
                                if s["type"] == "cp":
                                    s["cp"] = -s["cp"]
                                elif s["type"] == "mate":
                                    s["mate"] = -s["mate"]

                    json_str = json.dumps({"ply": i, "result": res})
                    yield json_str + (" " * 4096) + "\n"
                    
                    await asyncio.sleep(0)
                else:
                    print(f"[{self.name}] Analysis failed at ply {i}")

# ★インスタンス作成
stream_engine = EngineState(name="StreamEngine")
batch_engine = BatchEngineState() 

@app.on_event("startup")
async def startup_event():
    print("[App] Startup: Launching engines...")
    await asyncio.gather(
        stream_engine.ensure_alive(),
        batch_engine.ensure_alive()
    )
    print("[App] Startup: Engines ready!")

@app.get("/")
def root(): return {"message": "engine ok"}

@app.get("/health")
def health(): return {"status": "ok"}

@app.post("/api/explain")
async def explain_endpoint(req: ExplainRequest):
    return {"explanation": await AIService.generate_shogi_explanation(req.dict())}

@app.post("/api/explain/digest")
async def digest_endpoint(req: GameDigestInput):
    return {"explanation": await AIService.generate_game_digest(req.dict())}

@app.get("/api/tsume/list")
def get_tsume_list():
    """全問題のリストを返す"""
    return [{"id": p["id"], "title": p["title"], "steps": p["steps"]} for p in TSUME_PROBLEMS]

@app.get("/api/tsume/{problem_id}")
def get_tsume_detail(problem_id: int):
    """指定IDの問題詳細を返す"""
    problem = next((p for p in TSUME_PROBLEMS if p["id"] == problem_id), None)
    if not problem:
        return {"error": "Problem not found"}
    return problem

@app.post("/api/tsume/play")
async def tsume_play_endpoint(req: TsumePlayRequest):
    return await stream_engine.solve_tsume_hand(req.sfen)

@app.post("/api/analysis/batch")
async def batch_endpoint(req: BatchAnalysisRequest):
    moves = req.moves or []
    if req.usi and "moves" in req.usi:
         moves = req.usi.split("moves")[1].split()
    
    async def generator():
        try:
            async for line in batch_engine.stream_batch_analyze(moves, req.time_budget_ms):
                yield line
        except Exception as e:
            print(f"Batch error: {e}")
            yield json.dumps({"error": str(e)}) + "\n"

    return StreamingResponse(generator(), media_type="application/x-ndjson")

@app.post("/api/analysis/batch-stream")
async def batch_stream_endpoint(req: BatchAnalysisRequest):
    return await batch_endpoint(req)

@app.get("/api/analysis/stream")
def stream_endpoint(position: str):
    return StreamingResponse(
        stream_engine.stream_analyze(AnalyzeIn(position=position, depth=15, multipv=3)),
        media_type="text/event-stream"
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8787)