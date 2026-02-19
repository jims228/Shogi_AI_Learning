import asyncio
import json
import os
import re
from typing import Any, AsyncGenerator, Dict, List, Optional
from fastapi import FastAPI, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
import httpx

ENGINE_URL = os.getenv("ENGINE_URL", "http://localhost:8082")
app = FastAPI(title="Shogi Teacher API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000","http://127.0.0.1:3000"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "Shogi API is running!"}

def _best(d: Dict[str, Any]) -> Optional[str]:
    if isinstance(d.get("bestmove"), str): return d["bestmove"]
    blob = (d.get("raw") or d.get("output") or "") if isinstance(d.get("raw") or d.get("output"), str) else ""
    m = re.search(r"bestmove\s+([1-9][a-i][1-9][a-i])", blob, re.I)
    return m.group(1) if m else None

@app.post("/analyze")
async def analyze(position: str = Body(embed=True)) -> JSONResponse:
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(f"{ENGINE_URL}/analyze", json={"position": position})
        try:
            data = r.json()
        except Exception:
            data = {"raw": r.text}
        return JSONResponse({
            "ok": r.status_code == 200,
            "engine_status": r.status_code,
            "bestmove": _best(data),
            "multipv": data.get("multipv"),
            "raw": data.get("raw") or data.get("output"),
        }, status_code=200 if r.status_code == 200 else 502)
    except httpx.ConnectError as e:
        return JSONResponse({"ok": False, "error":"engine_connect_error","detail": str(e)}, status_code=502)
    except httpx.TimeoutException as e:
        return JSONResponse({"ok": False, "error":"engine_timeout","detail": str(e)}, status_code=504)
    except Exception as e:
        return JSONResponse({"ok": False, "error":"backend_exception","detail": str(e)}, status_code=500)

class BatchStreamIn(BaseModel):
    usi: str
    moves: List[str]
    time_budget_ms: int = 60000

async def _analyze_position(client: httpx.AsyncClient, position: str, timeout: float = 15.0) -> Dict[str, Any]:
    try:
        r = await client.post(f"{ENGINE_URL}/analyze", json={"position": position}, timeout=timeout)
        try:
            data = r.json()
        except Exception:
            data = {"raw": r.text}
        return {
            "ok": r.status_code == 200,
            "bestmove": _best(data),
            "multipv": data.get("multipv"),
            "score": data.get("score"),
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}

def _build_position_at_ply(usi: str, ply: int) -> str:
    """USI文字列からply手目までの局面文字列を生成する"""
    # "startpos moves m1 m2 ..." or "sfen ... moves m1 m2 ..."
    if "moves" in usi:
        base, moves_part = usi.split("moves", 1)
        moves = moves_part.strip().split()
        subset = moves[:ply]
        if subset:
            return base.rstrip() + " moves " + " ".join(subset)
        return base.rstrip()
    return usi

@app.post("/api/analysis/batch-stream")
async def batch_stream(inp: BatchStreamIn):
    """全手順を順次解析してNDJSON形式でストリーミング返却する"""
    total = len(inp.moves) + 1  # 初期局面 + 各手

    async def generate() -> AsyncGenerator[str, None]:
        async with httpx.AsyncClient() as client:
            for ply in range(total):
                position = _build_position_at_ply(inp.usi, ply)
                result = await _analyze_position(client, position)
                payload = json.dumps({"ply": ply, "result": result}, ensure_ascii=False)
                yield payload + "\n"
                # 過負荷防止のため少し待機
                await asyncio.sleep(0.05)

    return StreamingResponse(generate(), media_type="application/x-ndjson")


class ExplainIn(BaseModel):
    position: str
    bestmove: str
    multipv: Optional[List[Dict[str, Any]]] = None

@app.post("/explain")
async def explain(inp: ExplainIn):
    """
    LLMでの解説生成スケルトン。
    環境に OPENAI_API_KEY が無い場合はプレースホルダ文を返す。
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return {
            "ok": True,
            "explanation": f"Best move {inp.bestmove} の意図を段級位別に解説（ダミー）。"
        }

    # ここに実LLM呼び出し（例：OpenAI Responses API）を実装する
    # 安全のため今はダミー返却
    return {
        "ok": True,
        "explanation": f"Best move {inp.bestmove} の意図（LLM生成）。"
    }