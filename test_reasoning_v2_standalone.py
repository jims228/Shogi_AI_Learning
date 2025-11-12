"""
Standalone test runner for reasoning v2 functionality
"""

import os
import sys
import traceback

# Add project root to path
sys.path.insert(0, '/home/jimjace/Shogi_AI_Learning')

# Test fixtures
OPENING_QUIET_NOTE = {
    "ply": 3,
    "move": "7g7f",
    "delta_cp": 5,
    "score_before_cp": 0,
    "score_after_cp": 5,
    "bestmove": "7g7f",
    "mate": None,
    "pv": "7g7f 3c3d 2g2f",
    "evidence": {
        "tactical": {"is_check": False, "is_capture": False},
        "depth": 12
    },
    "tags": []
}

TACTICAL_CHECK_NOTE = {
    "ply": 25,
    "move": "8f8e",
    "delta_cp": 120,
    "score_before_cp": -50,
    "score_after_cp": 70,
    "bestmove": "8f8e",
    "mate": None,
    "pv": "8f8e 3a2b 4i3h",
    "evidence": {
        "tactical": {"is_check": True, "is_capture": False},
        "depth": 14
    },
    "tags": ["王手"]
}

LARGE_BLUNDER_NOTE = {
    "ply": 40,
    "move": "5i4h",
    "delta_cp": -250,
    "score_before_cp": 100,
    "score_after_cp": -150,
    "bestmove": "6g6f",
    "mate": None,
    "pv": "6g6f 2b8h+ 7g7h",
    "evidence": {
        "tactical": {"is_check": False, "is_capture": False},
        "depth": 16
    },
    "tags": ["悪手"]
}

ENDGAME_MATE_NOTE = {
    "ply": 85,
    "move": "3a2a",
    "delta_cp": None,
    "score_before_cp": 800,
    "score_after_cp": None,
    "bestmove": "3a2a",
    "mate": 5,
    "pv": "3a2a 1b2a 2b2a+ 1a2a",
    "evidence": {
        "tactical": {"is_check": False, "is_capture": False},
        "depth": 20
    },
    "tags": ["終盤"]
}


class TestRunner:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []
    
    def run_test(self, test_name, test_func):
        """Run a single test function"""
        try:
            print(f"Running {test_name}...", end=" ")
            test_func()
            print("✓ PASSED")
            self.passed += 1
        except Exception as e:
            print(f"✗ FAILED: {e}")
            self.failed += 1
            self.errors.append((test_name, e))
    
    def assert_equal(self, actual, expected, msg=""):
        """Assert equality with helpful error message"""
        if actual != expected:
            raise AssertionError(f"Expected {expected}, got {actual}. {msg}")
    
    def assert_true(self, condition, msg=""):
        """Assert condition is true"""
        if not condition:
            raise AssertionError(f"Condition failed. {msg}")
    
    def assert_in(self, item, container, msg=""):
        """Assert item is in container"""
        if item not in container:
            raise AssertionError(f"{item} not found in {container}. {msg}")
    
    def assert_range(self, value, min_val, max_val, msg=""):
        """Assert value is in range"""
        if not (min_val <= value <= max_val):
            raise AssertionError(f"{value} not in range [{min_val}, {max_val}]. {msg}")


def test_detect_phase(runner):
    """Test phase detection function"""
    from backend.ai.reasoning_features import detect_phase
    
    # Test opening detection
    opening_result = detect_phase(OPENING_QUIET_NOTE)
    runner.assert_equal(opening_result["phase"], "opening")
    runner.assert_equal(opening_result["turn"], "sente")  # ply 3 is sente (odd)
    
    # Test middlegame detection
    middlegame_result = detect_phase(TACTICAL_CHECK_NOTE)
    runner.assert_equal(middlegame_result["phase"], "middlegame")
    runner.assert_equal(middlegame_result["turn"], "sente")  # ply 25 is sente (odd)
    
    # Test endgame detection (mate)
    endgame_result = detect_phase(ENDGAME_MATE_NOTE)
    runner.assert_equal(endgame_result["phase"], "endgame")
    runner.assert_equal(endgame_result["turn"], "sente")  # ply 85 is sente (odd)


def test_classify_plan(runner):
    """Test plan classification function"""
    from backend.ai.reasoning_features import classify_plan
    
    # Test develop plan (opening)
    develop_result = classify_plan(OPENING_QUIET_NOTE)
    runner.assert_equal(develop_result["plan"], "develop")
    
    # Test attack plan (check + positive delta)
    attack_result = classify_plan(TACTICAL_CHECK_NOTE)
    runner.assert_equal(attack_result["plan"], "attack")
    
    # Test defend plan (negative delta)
    defend_result = classify_plan(LARGE_BLUNDER_NOTE)
    runner.assert_equal(defend_result["plan"], "defend")
    
    # Test endgame-technique plan (mate)
    endgame_result = classify_plan(ENDGAME_MATE_NOTE)
    runner.assert_equal(endgame_result["plan"], "endgame-technique")


def test_classify_move_type(runner):
    """Test move type classification function"""
    from backend.ai.reasoning_features import classify_move
    
    # Test normal move
    normal_result = classify_move(OPENING_QUIET_NOTE)
    runner.assert_equal(normal_result["move_type"], "normal")
    
    # Test check move
    check_result = classify_move(TACTICAL_CHECK_NOTE)
    runner.assert_equal(check_result["move_type"], "check")
    
    # Test blunder flag
    blunder_result = classify_move(LARGE_BLUNDER_NOTE)
    runner.assert_equal(blunder_result["move_type"], "blunder-flag")


def test_compute_confidence(runner):
    """Test confidence computation"""
    from backend.ai.reasoning_features import compute_confidence
    
    # Test various confidence levels
    opening_confidence = compute_confidence(OPENING_QUIET_NOTE)
    tactical_confidence = compute_confidence(TACTICAL_CHECK_NOTE)
    blunder_confidence = compute_confidence(LARGE_BLUNDER_NOTE)
    
    # All should be in [0, 1] range
    runner.assert_range(opening_confidence, 0, 1)
    runner.assert_range(tactical_confidence, 0, 1)
    runner.assert_range(blunder_confidence, 0, 1)
    
    # Tactical move should have higher confidence than quiet opening
    runner.assert_true(tactical_confidence > opening_confidence)


def test_pv_comparison(runner):
    """Test PV comparison analysis"""
    from backend.ai.reasoning_features import analyze_pv_comparison
    
    # Test best move (move matches bestmove)
    best_result = analyze_pv_comparison(OPENING_QUIET_NOTE)
    runner.assert_in("最善手", str(best_result["why_better"]))
    
    # Test sub-optimal move
    suboptimal_result = analyze_pv_comparison(LARGE_BLUNDER_NOTE)
    runner.assert_true(len(suboptimal_result["why_better"]) > 0)
    runner.assert_true(bool(suboptimal_result["line"]))  # Should have PV line


def test_build_reasoning_v2_schema(runner):
    """Test that build_reasoning returns v2 schema"""
    from backend.ai.reasoning import build_reasoning
    
    # Disable LLM for pure rule-based testing
    os.environ["USE_LLM"] = "0"
    
    reasoning = build_reasoning(TACTICAL_CHECK_NOTE)
    
    # Check v2 schema fields
    required_fields = ["summary", "tags", "confidence", "method", "context", "pv_summary"]
    for field in required_fields:
        runner.assert_in(field, reasoning, f"Missing field: {field}")
    
    # Check context subfields
    context = reasoning["context"]
    required_context_fields = ["phase", "plan", "move_type"]
    for field in required_context_fields:
        runner.assert_in(field, context, f"Missing context field: {field}")
    
    # Check pv_summary subfields
    pv_summary = reasoning["pv_summary"]
    runner.assert_in("line", pv_summary)
    runner.assert_in("why_better", pv_summary)
    
    # Check confidence bounds
    runner.assert_range(reasoning["confidence"], 0, 1)
    
    # Check summary is non-empty
    runner.assert_true(bool(reasoning["summary"]))
    runner.assert_true(len(reasoning["summary"]) > 5)


def test_reasoning_consistency(runner):
    """Test reasoning consistency across different move types"""
    from backend.ai.reasoning import build_reasoning
    
    os.environ["USE_LLM"] = "0"
    
    fixtures = [OPENING_QUIET_NOTE, TACTICAL_CHECK_NOTE, LARGE_BLUNDER_NOTE, ENDGAME_MATE_NOTE]
    
    for i, note in enumerate(fixtures):
        reasoning = build_reasoning(note)
        
        # All should have valid schema
        runner.assert_true(bool(reasoning["summary"]), f"Empty summary for fixture {i}")
        runner.assert_true(isinstance(reasoning["tags"], list), f"Tags not list for fixture {i}")
        runner.assert_range(reasoning["confidence"], 0, 1, f"Confidence out of range for fixture {i}")
        runner.assert_in(reasoning["method"], ["rule_based", "llm_enhanced", "fallback"], f"Invalid method for fixture {i}")
        
        # Phase should be appropriate
        phase = reasoning["context"]["phase"]
        runner.assert_in(phase, ["opening", "middlegame", "endgame"], f"Invalid phase for fixture {i}")
        
        # Move type should be appropriate
        move_type = reasoning["context"]["move_type"]
        valid_move_types = ["normal", "check", "capture", "promote", "sacrifice", "quiet-improve", "blunder-flag"]
        runner.assert_in(move_type, valid_move_types, f"Invalid move_type for fixture {i}")


def test_llm_prompt_enrichment(runner):
    """Test LLM prompt includes v2 context"""
    from backend.ai.reasoning_llm import _build_gemini_prompt, _build_openai_prompt
    
    features = {"move": "7g7f", "ply": 1, "delta_cp": 10}
    context = {
        "phase": "opening",
        "plan": "develop", 
        "move_type": "normal",
        "pv_summary": {"line": "7g7f 3c3d", "why_better": ["テスト"]}
    }
    
    # Test Gemini prompt
    gemini_prompt = _build_gemini_prompt("テスト説明", features, context)
    has_opening = "opening" in gemini_prompt or "序盤" in gemini_prompt
    has_develop = "develop" in gemini_prompt or "駒組み" in gemini_prompt
    runner.assert_true(has_opening, "Gemini prompt missing opening context")
    runner.assert_true(has_develop, "Gemini prompt missing develop context")
    runner.assert_in("normal", gemini_prompt, "Gemini prompt missing move_type")
    
    # Test OpenAI prompt
    openai_prompt = _build_openai_prompt("テスト説明", features, context)
    runner.assert_in("opening", openai_prompt, "OpenAI prompt missing phase")
    runner.assert_in("develop", openai_prompt, "OpenAI prompt missing plan")
    runner.assert_in("normal", openai_prompt, "OpenAI prompt missing move_type")


def test_multiple_reasoning_processing(runner):
    """Test processing multiple moves together"""
    from backend.ai.reasoning import build_multiple_reasoning
    
    os.environ["USE_LLM"] = "0"
    
    notes = [OPENING_QUIET_NOTE, TACTICAL_CHECK_NOTE, LARGE_BLUNDER_NOTE]
    reasonings = build_multiple_reasoning(notes, {"game_type": "test"})
    
    runner.assert_equal(len(reasonings), len(notes), "Reasoning count mismatch")
    
    # Each should have valid v2 schema
    for i, reasoning in enumerate(reasonings):
        runner.assert_true(bool(reasoning["summary"]), f"Empty summary for reasoning {i}")
        phase = reasoning["context"]["phase"]
        runner.assert_in(phase, ["opening", "middlegame", "endgame"], f"Invalid phase for reasoning {i}")
        runner.assert_range(reasoning["confidence"], 0, 1, f"Confidence out of range for reasoning {i}")


def main():
    """Run all tests"""
    print("=== Reasoning v2 Test Suite ===")
    
    runner = TestRunner()
    
    # Setup environment
    os.environ.pop("USE_LLM", None)
    os.environ.pop("LLM_PROVIDER", None)
    
    # Run all tests
    tests = [
        ("Phase Detection", test_detect_phase),
        ("Plan Classification", test_classify_plan),
        ("Move Type Classification", test_classify_move_type),
        ("Confidence Computation", test_compute_confidence),
        ("PV Comparison", test_pv_comparison),
        ("Build Reasoning v2 Schema", test_build_reasoning_v2_schema),
        ("Reasoning Consistency", test_reasoning_consistency),
        ("LLM Prompt Enrichment", test_llm_prompt_enrichment),
        ("Multiple Reasoning Processing", test_multiple_reasoning_processing),
    ]
    
    for test_name, test_func in tests:
        runner.run_test(test_name, lambda t=test_func: t(runner))
    
    print(f"\n=== Test Results ===")
    print(f"Passed: {runner.passed}")
    print(f"Failed: {runner.failed}")
    
    if runner.errors:
        print(f"\nErrors:")
        for test_name, error in runner.errors:
            print(f"  {test_name}: {error}")
    
    if runner.failed == 0:
        print("🎉 All tests passed! Reasoning v2 is working correctly.")
        return True
    else:
        print("❌ Some tests failed. Check implementation.")
        return False


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)