from __future__ import annotations
import asyncio, os, re, shlex, time, json
from typing import Optional, Dict, Any, List, Literal
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import google.generativeai as genai

# ====== 設定 ======
USI_CMD = os.getenv("USI_CMD", "/usr/local/bin/yaneuraou")
USI_BOOT_TIMEOUT = float(os.getenv("USI_BOOT_TIMEOUT", "10"))
USI_GO_TIMEOUT = float(os.getenv("USI_GO_TIMEOUT", "20"))

# Gemini API設定
GENAI_API_KEY = os.environ.get("GEMINI_API_KEY")
if GENAI_API_KEY:
    genai.configure(api_key=GENAI_API_KEY)

# ====== FastAPI アプリケーション定義 ======
app = FastAPI(title="USI Engine Gateway")

# CORS設定
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

# ====== 他のルーターの読み込み（以前の機能を復活） ======
# ingest.py (棋譜読み込み) があれば読み込む
try:
    from routers import ingest
    app.include_router(ingest.router)
    print("[System] Ingest router loaded.")
except ImportError:
    pass

# learning (学習機能) があれば読み込む
try:
    from routers import learning
    app.include_router(learning.router)
    print("[System] Learning router loaded.")
except ImportError:
    pass


# ====== AI解説ロジック ======
class ExplanationInput(BaseModel):
    sfen: str
    ply: int
    bestmove: str
    score_cp: Optional[int] = None
    score_mate: Optional[int] = None
    pv: str
    turn: str

async def generate_shogi_explanation(data: ExplanationInput) -> str:
    if not GENAI_API_KEY:
        return "エラー: Gemini APIキーが設定されていません。backend/api/.env を確認してください。"

    phase = "中盤"
    if data.ply < 24: phase = "序盤"
    elif data.ply > 100: phase = "終盤"

    situation_desc = "互角"
    score_str = f"{data.score_cp}" if data.score_cp is not None else "不明"
    
    if data.score_mate:
        situation_desc = f"{abs(data.score_mate)}手以内の詰み（勝勢）"
    elif data.score_cp is not None:
        sc = data.score_cp
        if abs(sc) < 300: situation_desc = "ほぼ互角"
        elif sc > 2000: situation_desc = "勝勢"
        elif sc > 800: situation_desc = "優勢"
        elif sc < -2000: situation_desc = "敗勢"
        elif sc < -800: situation_desc = "苦戦"

    prompt = f"""
あなたはプロ棋士であり、親しみやすい将棋の解説者です。
以下の局面について、初心者～中級者に向けて「人間らしい言葉」で解説してください。
数値の羅列ではなく、「なぜその手が良いのか」「どういう狙いがあるのか」という**根拠とストーリー**を語ってください。

## 局面データ
- 手数: {data.ply}手目 ({phase})
- 手番: {"先手" if data.turn == "b" else "後手"}
- 現在の盤面(SFEN): {data.sfen}
- AI推奨手: {data.bestmove}
- AI読み筋(PV): {data.pv}
- 状況: {situation_desc} (評価値: {score_str})

## 解説のガイドライン
1. **{phase}のポイント**:
   - **序盤**: 「矢倉」「角換わり」「振り飛車」などの戦型や定跡について言及してください。
   - **中盤**: 駒の損得だけでなく、玉の堅さ、攻めの拠点、手厚さなど大局観を語ってください。
   - **終盤**: 詰みがある場合は「即詰みがあります！」と明言し、詰みの手筋を解説してください。

2. **構成**:
   - 【状況】現在の局面の要約
   - 【推奨手】AIが示す手についての解説と根拠
   - 【展望】この後の展開予想

解説をお願いします。
"""
    try:
        # ★修正: モデル名をより確実なものに変更
        # gemini-1.5-flash-latest は安定板へのエイリアスです
        model = genai.GenerativeModel('gemini-2.0-flash')
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        # フォールバック: Flashがダメなら Pro を試す
        try:
            print(f"Flash model failed, trying Pro: {e}")
            model = genai.GenerativeModel('gemini-pro')
            response = model.generate_content(prompt)
            return response.text
        except Exception as e2:
            return f"解説生成エラー: {str(e2)}"

# ====== USIエンジン管理クラス ======
class EngineState:
    def __init__(self):
        self.proc: Optional[asyncio.subprocess.Process] = None
        self.lock = asyncio.Lock()

    async def ensure_alive(self):
        if self.proc and self.proc.returncode is None:
            return
        self.proc = await asyncio.create_subprocess_exec(
            *shlex.split(USI_CMD),
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        await self._send_line("usi")
        await self._wait_until(lambda l: "usiok" in l, USI_BOOT_TIMEOUT)
        await self._send_line("isready")
        await self._wait_until(lambda l: "readyok" in l, USI_BOOT_TIMEOUT)
        
        # 定跡利用の設定
        if os.environ.get("ENGINE_USE_BOOK") == "true":
            await self._send_line("setoption name USI_OwnBook value true")
            
        await self._send_line("usinewgame")

    async def _send_line(self, s: str):
        assert self.proc and self.proc.stdin
        self.proc.stdin.write((s + "\n").encode())
        await self.proc.stdin.drain()

    async def _read_line(self, timeout: float | None = None) -> Optional[str]:
        assert self.proc and self.proc.stdout
        try:
            line = await asyncio.wait_for(self.proc.stdout.readline(), timeout=timeout)
        except asyncio.TimeoutError:
            return None
        if not line:
            return None
        return line.decode(errors="ignore").strip()

    async def _wait_until(self, pred, timeout: float) -> List[str]:
        buf: List[str] = []
        end = asyncio.get_event_loop().time() + timeout
        while asyncio.get_event_loop().time() < end:
            line = await self._read_line(timeout=timeout)
            if line is None:
                break
            buf.append(line)
            if pred(line):
                return buf
        return buf

    async def analyze(self, position: str, depth: int, multipv: int) -> Dict[str, Any]:
        async with self.lock:
            await self.ensure_alive()
            await self._send_line(f"position {position}")
            await self._send_line(f"go depth {depth} multipv {multipv}")
            
            logs: List[str] = []
            bestmove: Optional[str] = None
            multipv_items: List[Dict[str, Any]] = []

            bestmove_re = re.compile(r"bestmove\s+(\S+)")
            info_re = re.compile(r"info .*?score (cp|mate) ([\-0-9]+).*?pv (.+)")
            mpv_re = re.compile(r"multipv\s+(\d+)")
            end_time = asyncio.get_event_loop().time() + USI_GO_TIMEOUT

            while asyncio.get_event_loop().time() < end_time:
                line = await self._read_line(timeout=0.5)
                if not line:
                    continue
                logs.append(line)
                m = bestmove_re.search(line)
                if m:
                    bestmove = m.group(1)
                    break
                mi = info_re.search(line)
                if mi:
                    kind, val, pv = mi.group(1), mi.group(2), mi.group(3)
                    mpv = 1
                    mm = mpv_re.search(line)
                    if mm:
                        mpv = int(mm.group(1))
                    score: Dict[str, Any] = {"type": kind}
                    if kind == "cp":
                        score["cp"] = int(val)
                    else:
                        score["mate"] = int(val)
                    multipv_items.append({"multipv": mpv, "score": score, "pv": pv})

            raw = "\n".join(logs)
            return {
                "ok": bestmove is not None,
                "bestmove": bestmove,
                "multipv": sorted(multipv_items, key=lambda x: x.get("multipv", 99)) or None,
                "raw": raw,
            }
            
    async def stream_analyze(self, req: AnalyzeIn):
        async with self.lock:
            await self.ensure_alive()
            await self._send_line(f"position {req.position}")
            await self._send_line(f"go depth {req.depth} multipv {req.multipv}")
            
            while True:
                line = await self._read_line(timeout=0.5)
                if not line:
                    yield ": keepalive\n\n"
                    continue
                if line.startswith("bestmove"):
                    yield f"data: {json.dumps({'bestmove': line.split()[1]})}\n\n"
                    break
                if line.startswith("info") and "score" in line:
                    # Parse info and yield (simplified)
                    # In a real app, you'd parse the score/pv here too
                    yield f"data: {json.dumps({'raw': line})}\n\n"


# リクエストモデル
class AnalyzeIn(BaseModel):
    position: str
    depth: int = 16
    multipv: int = 3

class ExplainRequest(BaseModel):
    sfen: str
    ply: int
    bestmove: str
    score_cp: Optional[int] = None
    score_mate: Optional[int] = None
    pv: str
    turn: str

class BatchAnalysisRequest(BaseModel):
    position: Optional[str] = None
    usi: Optional[str] = None
    moves: Optional[List[str]] = None
    max_ply: Optional[int] = None
    movetime_ms: Optional[int] = None
    multipv: Optional[int] = None
    time_budget_ms: Optional[int] = None

# エンジンインスタンス
engine = EngineState()

# ====== エンドポイント ======

@app.get("/")
def root(): return {"message": "engine ok (usi)"}

@app.get("/health")
def health(): return {"status": "ok"}

@app.post("/analyze")
async def analyze(body: AnalyzeIn, request: Request):
    try:
        result = await engine.analyze(body.position, body.depth, body.multipv)
        return result
    except Exception as e:
        return {"ok": False, "error": str(e)}, 500

# ★新機能: AI解説生成
@app.post("/api/explain")
async def explain_position(req: ExplainRequest):
    try:
        input_data = ExplanationInput(
            sfen=req.sfen,
            ply=req.ply,
            bestmove=req.bestmove,
            score_cp=req.score_cp,
            score_mate=req.score_mate,
            pv=req.pv,
            turn=req.turn
        )
        explanation = await generate_shogi_explanation(input_data)
        return {"explanation": explanation}
    except Exception as e:
        print(f"Explain Error: {e}") # ログ出力
        raise HTTPException(status_code=500, detail=str(e))

# ★復活: 全体解析 (Batch Analysis)
@app.post("/api/analysis/batch")
async def analysis_batch(req: BatchAnalysisRequest):
    # USIヘルパー関数 (インライン定義)
    def _is_valid_usi_move(move: str) -> bool:
        if not move or len(move) < 4: return False
        return bool(re.match(r'^[1-9PLNSGBRK]', move))

    def _extract_position_components(position: str):
        body = position.strip()
        if body.startswith("position"): body = body[len("position"):].strip()
        if " moves " in body:
            head, _, tail = body.partition(" moves ")
            return {"sfen": head if "sfen" in head else None, "moves": tail.split()}
        return {"sfen": None, "moves": []}

    # リクエスト処理
    position_literal = req.position or req.usi
    moves: List[str] = []
    if req.moves:
        moves = [mv for mv in req.moves if _is_valid_usi_move(mv)]
    
    if not moves and position_literal:
        comps = _extract_position_components(position_literal)
        moves = comps["moves"]
    
    if not moves:
        return {"analyses": {}, "error": "No moves found"}

    total_available = len(moves)
    target_moves = min(req.max_ply or total_available, total_available)
    movetime_ms = req.movetime_ms or 200
    multipv = req.multipv or 3
    
    start_time = time.monotonic()
    analyses: Dict[int, Dict[str, Any]] = {}

    # 1手ずつ解析ループ
    for ply in range(target_moves + 1):
        if (time.monotonic() - start_time) * 1000 > (req.time_budget_ms or 30000):
            break
            
        current_moves = " ".join(moves[:ply])
        position_cmd = f"startpos moves {current_moves}" if current_moves else "startpos"
        
        try:
            res = await engine.analyze(position_cmd, depth=10, multipv=multipv)
            
            cands = []
            if res.get("multipv"):
                for item in res["multipv"]:
                    cands.append({
                        "multipv": item["multipv"],
                        "score": item["score"],
                        "pv": item["pv"],
                        "depth": 10
                    })
            
            analyses[ply] = {
                "ok": True,
                "bestmove": res.get("bestmove"),
                "multipv": cands
            }
        except Exception as e:
            analyses[ply] = {"ok": False, "error": str(e)}

    elapsed = int((time.monotonic() - start_time) * 1000)
    return {
        "analyses": analyses,
        "elapsed_ms": elapsed,
        "analyzed_plies": len(analyses)
    }

# ★追加: ストリーム解析のエンドポイント
@app.get("/api/analysis/stream")
def analysis_stream(position: str):
    return StreamingResponse(
        engine.stream_analyze(AnalyzeIn(position=position, depth=18, multipv=3)),
        media_type="text/event-stream"
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)