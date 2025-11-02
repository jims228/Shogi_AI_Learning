from fastapi.testclient import TestClient
from backend.api import main as api_main

client = TestClient(api_main.app)


def test_annotate_minimal(monkeypatch):
    # モックエンジンの返り値を用意して、/annotate が notes を返すことを確認
    def fake_analyze(req):
        # Build a minimal AnalyzeResponse-like object
        PVItem = api_main.PVItem
        AnalyzeResponse = api_main.AnalyzeResponse
        pv = PVItem(move="7g7f", score_cp=10, score_mate=None, depth=1, pv=["7g7f"]) 
        return AnalyzeResponse(bestmove="7g7f", candidates=[pv])

    monkeypatch.setattr(api_main.engine, "analyze", fake_analyze)

    resp = client.post("/annotate", json={"usi": "startpos moves 7g7f 3c3d 2g2f 8c8d"})
    assert resp.status_code == 200
    data = resp.json()
    assert "notes" in data
    assert len(data["notes"]) > 0
