from fastapi.testclient import TestClient
from backend.api import main as api_main

client = TestClient(api_main.app)


def test_evidence_tags_and_delta(monkeypatch):
    # monkeypatch engine.analyze to return incremental scores so delta can be computed
    PVItem = api_main.PVItem
    AnalyzeResponse = api_main.AnalyzeResponse

    responses = [
        AnalyzeResponse(bestmove="7g7f", candidates=[PVItem(move="7g7f", score_cp=50, score_mate=None, depth=1, pv=["7g7f"]) ]),
        AnalyzeResponse(bestmove="3c3d", candidates=[PVItem(move="3c3d", score_cp=-120, score_mate=None, depth=1, pv=["3c3d"]) ]),
    ]

    calls = {"i": 0}

    def fake_analyze(req):
        i = calls["i"]
        calls["i"] += 1
        return responses[i]

    monkeypatch.setattr(api_main.engine, "analyze", fake_analyze)

    resp = client.post("/annotate", json={"usi": "startpos moves 7g7f 3c3d"})
    assert resp.status_code == 200
    data = resp.json()
    assert "notes" in data
    notes = data["notes"]
    assert len(notes) == 2

    # first move has no before score, so delta may be 0 or null
    assert "score_after_cp" in notes[0]
    assert notes[0]["score_after_cp"] == 50

    # second move should have delta computed: after(-120) - before(50) = -170 -> tag should include 悪手
    assert notes[1]["score_after_cp"] == -120
    assert notes[1]["delta_cp"] == -170
    assert "悪手" in notes[1]["tags"]
    # evidence tactical present
    assert "evidence" in notes[1]
    assert notes[1]["evidence"]["tactical"]["is_capture"] in (True, False)
