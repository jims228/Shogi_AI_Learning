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


def test_pv_reason_horizon_levels(monkeypatch):
    PVItem = api_main.PVItem
    AnalyzeResponse = api_main.AnalyzeResponse

    # Provide long PV so horizon differences are visible
    long_pv = ["7g7f","3c3d","8h2b+","3a2b","2g2f","8c8d","2f2e","4c4d","3g3f","5c5d","7i6h","7a6b"]
    responses = [AnalyzeResponse(bestmove="7g7f", candidates=[PVItem(move="7g7f", score_cp=0, depth=1, pv=long_pv)])]

    calls = {"i": 0}
    def fake_analyze(req):
        i = calls["i"]
        calls["i"] += 1
        return responses[0]

    monkeypatch.setattr(api_main.engine, "analyze", fake_analyze)

    # beginner: used_horizon <= 5
    resp_b = client.post("/annotate", json={"usi": "startpos moves 7g7f", "options": {"explain_level": "beginner"}})
    assert resp_b.status_code == 200
    notes_b = resp_b.json()["notes"]
    assert notes_b
    pv_reason_b = notes_b[0]["evidence"].get("pv_reason")
    assert pv_reason_b
    assert pv_reason_b["used_horizon"] <= 5

    # advanced: used_horizon should be > beginner (and within upper bound)
    calls["i"] = 0
    resp_a = client.post("/annotate", json={"usi": "startpos moves 7g7f", "options": {"explain_level": "advanced"}})
    assert resp_a.status_code == 200
    notes_a = resp_a.json()["notes"]
    pv_reason_a = notes_a[0]["evidence"].get("pv_reason")
    assert pv_reason_a
    assert pv_reason_a["used_horizon"] >= pv_reason_b["used_horizon"]
    assert pv_reason_a["used_horizon"] <= 16


def test_pv_reason_capture_event(monkeypatch):
    PVItem = api_main.PVItem
    AnalyzeResponse = api_main.AnalyzeResponse

    # PV begins with a bishop capture sequence
    pv = ["8h2b+","3a2b","2g2f"]
    responses = [AnalyzeResponse(bestmove="8h2b+", candidates=[PVItem(move="8h2b+", score_cp=0, depth=1, pv=pv)])]

    calls = {"i": 0}
    def fake_analyze(req):
        i = calls["i"]
        calls["i"] += 1
        return responses[0]

    monkeypatch.setattr(api_main.engine, "analyze", fake_analyze)

    resp = client.post("/annotate", json={"usi": "startpos moves 7g7f", "options": {"explain_level": "advanced"}})
    assert resp.status_code == 200
    data = resp.json()
    pv_reason = data["notes"][0]["evidence"].get("pv_reason")
    assert pv_reason
    events = pv_reason.get("events") or []
    # At least one capture event present
    assert any(e.get("type") == "capture" for e in events)
