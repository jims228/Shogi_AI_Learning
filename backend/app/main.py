import os
ENGINE_URL = os.getenv("ENGINE_URL", "http://localhost:8081/analyze")

from fastapi import FastAPI, Body, HTTPException
import httpx

app = FastAPI(title="Shogi Teacher API")
# ENGINE_URL = "http://localhost:8081/analyze"

@app.get("/")
def root():
    return {"message": "Shogi API is running!"}

@app.post("/analyze")
async def analyze(position: str = Body(..., embed=True)):
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(ENGINE_URL, json={"sfen": position})
            r.raise_for_status()
            return r.json()
    except httpx.ConnectError:
        # エンジンが起動していない/接続できない
        raise HTTPException(status_code=502, detail="Engine is not reachable on :8081")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Engine error: {e.response.text}")
