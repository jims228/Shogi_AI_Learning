from fastapi.testclient import TestClient
from backend.api import main as api_main

client = TestClient(api_main.app)


def test_digest_basic(monkeypatch):
    # prepare fake analyze responses sequentially
    PVItem = api_main.PVItem
    AnalyzeResponse = api_main.AnalyzeResponse

    # We'll simulate 4 plies with scores: 0, 50, -140, -160 -> swings around ply3
    responses = [
        AnalyzeResponse(bestmove="7g7f", candidates=[PVItem(move="7g7f", score_cp=0, score_mate=None, depth=1, pv=["7g7f"]) ]),
        AnalyzeResponse(bestmove="3c3d", candidates=[PVItem(move="3c3d", score_cp=50, score_mate=None, depth=1, pv=["3c3d"]) ]),
        AnalyzeResponse(bestmove="2g2f", candidates=[PVItem(move="2g2f", score_cp=-140, score_mate=None, depth=1, pv=["2g2f"]) ]),
        AnalyzeResponse(bestmove="8c8d", candidates=[PVItem(move="8c8d", score_cp=-160, score_mate=None, depth=1, pv=["8c8d"]) ]),
    ]

    calls = {"i": 0}

    def fake_analyze(req):
        i = calls["i"]
        if i >= len(responses):
            # return the last
            return responses[-1]
        calls["i"] += 1
        return responses[i]

    monkeypatch.setattr(api_main.engine, "analyze", fake_analyze)

    resp = client.post("/digest", json={"usi": "startpos moves 7g7f 3c3d 2g2f 8c8d", "time_budget_ms": 2000})
    assert resp.status_code == 200
    data = resp.json()
    assert "summary" in data and isinstance(data["summary"], list)
    assert len(data["summary"]) >= 1
    assert "key_moments" in data and isinstance(data["key_moments"], list)
    # expect at least one key moment detected
    assert len(data["key_moments"]) >= 1
    # check structure of a key moment
    km = data["key_moments"][0]
    assert "ply" in km and "move" in km
    # ensure stats present
    assert "stats" in data and "plies" in data["stats"]
