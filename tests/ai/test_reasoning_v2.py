"""
Test suite for reasoning v2 functionality

Tests phase detection, move classification, confidence computation,
and LLM integration with proper mocking.
"""

import pytest
import os
import sys
from unittest.mock import patch, MagicMock

# Add project root to path for imports
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
    "move": "8h2b+",
    "delta_cp": 120,
    "score_before_cp": -50,
    "score_after_cp": 70,
    "bestmove": "8h2b+",
    "mate": None,
    "pv": "8h2b+ 3a2b 4i3h",
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


class TestReasoningV2:
    """Test reasoning v2 features"""
    
    def setup_method(self):
        """Setup for each test method"""
        # Reset environment
        os.environ.pop("USE_LLM", None)
        os.environ.pop("LLM_PROVIDER", None)
    
    def test_detect_phase(self):
        """Test phase detection function"""
        from backend.ai.reasoning_features import detect_phase
        
        # Test opening detection
        opening_result = detect_phase(OPENING_QUIET_NOTE)
        assert opening_result["phase"] == "opening"
        assert opening_result["turn"] == "gote"  # ply 3 is gote
        
        # Test middlegame detection
        middlegame_result = detect_phase(TACTICAL_CHECK_NOTE)
        assert middlegame_result["phase"] == "middlegame"
        assert middlegame_result["turn"] == "sente"  # ply 25 is sente
        
        # Test endgame detection (mate)
        endgame_result = detect_phase(ENDGAME_MATE_NOTE)
        assert endgame_result["phase"] == "endgame"
        assert endgame_result["turn"] == "sente"  # ply 85 is sente
        
        # Test endgame detection (high eval)
        high_eval_note = LARGE_BLUNDER_NOTE.copy()
        high_eval_note["score_after_cp"] = 1600
        endgame_high_eval = detect_phase(high_eval_note)
        assert endgame_high_eval["phase"] == "endgame"
    
    def test_classify_plan(self):
        """Test plan classification function"""
        from backend.ai.reasoning_features import classify_plan
        
        # Test develop plan (opening)
        develop_result = classify_plan(OPENING_QUIET_NOTE)
        assert develop_result["plan"] == "develop"
        
        # Test attack plan (check + positive delta)
        attack_result = classify_plan(TACTICAL_CHECK_NOTE)
        assert attack_result["plan"] == "attack"
        
        # Test defend plan (negative delta)
        defend_result = classify_plan(LARGE_BLUNDER_NOTE)
        assert defend_result["plan"] == "defend"
        
        # Test endgame-technique plan (mate)
        endgame_result = classify_plan(ENDGAME_MATE_NOTE)
        assert endgame_result["plan"] == "endgame-technique"
    
    def test_classify_move_type(self):
        """Test move type classification function"""
        from backend.ai.reasoning_features import classify_move
        
        # Test normal move
        normal_result = classify_move(OPENING_QUIET_NOTE)
        assert normal_result["move_type"] == "normal"
        
        # Test check move
        check_result = classify_move(TACTICAL_CHECK_NOTE)
        assert check_result["move_type"] == "check"
        
        # Test blunder flag
        blunder_result = classify_move(LARGE_BLUNDER_NOTE)
        assert blunder_result["move_type"] == "blunder-flag"
        
        # Test promote move
        promote_note = TACTICAL_CHECK_NOTE.copy()
        promote_note["move"] = "8h2b+"
        promote_result = classify_move(promote_note)
        assert promote_result["move_type"] == "promote"
    
    def test_compute_confidence(self):
        """Test confidence computation"""
        from backend.ai.reasoning_features import compute_confidence
        
        # Test various confidence levels
        opening_confidence = compute_confidence(OPENING_QUIET_NOTE)
        tactical_confidence = compute_confidence(TACTICAL_CHECK_NOTE)
        blunder_confidence = compute_confidence(LARGE_BLUNDER_NOTE)
        
        # All should be in [0, 1] range
        assert 0 <= opening_confidence <= 1
        assert 0 <= tactical_confidence <= 1
        assert 0 <= blunder_confidence <= 1
        
        # Tactical move should have higher confidence than quiet opening
        assert tactical_confidence > opening_confidence
        
        # Blunder with clear eval should have high confidence
        assert blunder_confidence > opening_confidence
    
    def test_pv_comparison(self):
        """Test PV comparison analysis"""
        from backend.ai.reasoning_features import analyze_pv_comparison
        
        # Test best move (move matches bestmove)
        best_result = analyze_pv_comparison(OPENING_QUIET_NOTE)
        assert "最善手" in best_result["why_better"]
        
        # Test sub-optimal move
        suboptimal_result = analyze_pv_comparison(LARGE_BLUNDER_NOTE)
        assert len(suboptimal_result["why_better"]) > 0
        assert suboptimal_result["line"]  # Should have PV line
    
    def test_build_reasoning_v2_schema(self):
        """Test that build_reasoning returns v2 schema"""
        from backend.ai.reasoning import build_reasoning
        
        # Disable LLM for pure rule-based testing
        os.environ["USE_LLM"] = "0"
        
        reasoning = build_reasoning(TACTICAL_CHECK_NOTE)
        
        # Check v2 schema fields
        required_fields = ["summary", "tags", "confidence", "method", "context", "pv_summary"]
        for field in required_fields:
            assert field in reasoning, f"Missing field: {field}"
        
        # Check context subfields
        context = reasoning["context"]
        required_context_fields = ["phase", "plan", "move_type"]
        for field in required_context_fields:
            assert field in context, f"Missing context field: {field}"
        
        # Check pv_summary subfields
        pv_summary = reasoning["pv_summary"]
        assert "line" in pv_summary
        assert "why_better" in pv_summary
        
        # Check confidence bounds
        assert 0 <= reasoning["confidence"] <= 1
        
        # Check summary is non-empty
        assert reasoning["summary"]
        assert len(reasoning["summary"]) > 5
    
    def test_reasoning_consistency_across_fixtures(self):
        """Test reasoning consistency across different move types"""
        from backend.ai.reasoning import build_reasoning
        
        os.environ["USE_LLM"] = "0"
        
        fixtures = [OPENING_QUIET_NOTE, TACTICAL_CHECK_NOTE, LARGE_BLUNDER_NOTE, ENDGAME_MATE_NOTE]
        
        for note in fixtures:
            reasoning = build_reasoning(note)
            
            # All should have valid schema
            assert reasoning["summary"]
            assert isinstance(reasoning["tags"], list)
            assert 0 <= reasoning["confidence"] <= 1
            assert reasoning["method"] in ["rule_based", "llm_enhanced", "fallback"]
            
            # Phase should be appropriate
            phase = reasoning["context"]["phase"]
            assert phase in ["opening", "middlegame", "endgame"]
            
            # Move type should be appropriate
            move_type = reasoning["context"]["move_type"]
            assert move_type in ["normal", "check", "capture", "promote", "sacrifice", "quiet-improve", "blunder-flag"]
    
    def test_llm_prompt_enrichment(self):
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
        assert "opening" in gemini_prompt or "序盤" in gemini_prompt
        assert "develop" in gemini_prompt or "駒組み" in gemini_prompt
        assert "normal" in gemini_prompt
        
        # Test OpenAI prompt
        openai_prompt = _build_openai_prompt("テスト説明", features, context)
        assert "opening" in openai_prompt
        assert "develop" in openai_prompt
        assert "normal" in openai_prompt
    
    @patch('backend.ai.reasoning_llm._call_gemini')
    def test_llm_integration_mock(self, mock_gemini):
        """Test LLM integration with mocked calls"""
        from backend.ai.reasoning import build_reasoning
        
        # Setup mock
        mock_gemini.return_value = "改善されたテスト解説。"
        
        # Enable LLM
        os.environ["USE_LLM"] = "1"
        os.environ["LLM_PROVIDER"] = "gemini"
        
        reasoning = build_reasoning(TACTICAL_CHECK_NOTE)
        
        # Should use LLM-enhanced method
        assert reasoning["method"] == "llm_enhanced"
        assert "改善された" in reasoning["summary"]
        
        # Mock should have been called
        mock_gemini.assert_called_once()
        
        # Check call arguments include v2 context
        call_args = mock_gemini.call_args[0]
        assert len(call_args) == 3  # base_reasoning, features, context
        context_arg = call_args[2]
        assert "phase" in context_arg
        assert "plan" in context_arg
        assert "move_type" in context_arg
    
    def test_confidence_with_llm_bonus(self):
        """Test confidence computation includes LLM bonus"""
        from backend.ai.reasoning_features import compute_confidence
        
        # Test without LLM
        os.environ["USE_LLM"] = "0"
        confidence_no_llm = compute_confidence(TACTICAL_CHECK_NOTE)
        
        # Test with LLM
        os.environ["USE_LLM"] = "1"
        confidence_with_llm = compute_confidence(TACTICAL_CHECK_NOTE)
        
        # LLM should increase confidence
        assert confidence_with_llm > confidence_no_llm
        assert confidence_with_llm - confidence_no_llm == pytest.approx(0.1, abs=0.01)
    
    def test_validation_and_safety(self):
        """Test reasoning output validation and safety"""
        from backend.ai.reasoning_llm import _validate_llm_output
        
        context = {"move_type": "check"}
        
        # Valid output
        assert _validate_llm_output("王手により攻撃を継続しています。", context)
        
        # Invalid outputs
        assert not _validate_llm_output("", context)  # Empty
        assert not _validate_llm_output("短い", context)  # Too short
        assert not _validate_llm_output("わかりません", context)  # Uncertain
        assert not _validate_llm_output("たぶん良い手です", context)  # Speculative
        
        # Check requires shogi terms for tactical moves
        assert not _validate_llm_output("This is good.", context)  # No shogi terms
    
    def test_multiple_reasoning_processing(self):
        """Test processing multiple moves together"""
        from backend.ai.reasoning import build_multiple_reasoning
        
        os.environ["USE_LLM"] = "0"
        
        notes = [OPENING_QUIET_NOTE, TACTICAL_CHECK_NOTE, LARGE_BLUNDER_NOTE]
        reasonings = build_multiple_reasoning(notes, {"game_type": "test"})
        
        assert len(reasonings) == len(notes)
        
        # Each should have valid v2 schema
        for reasoning in reasonings:
            assert reasoning["summary"]
            assert reasoning["context"]["phase"] in ["opening", "middlegame", "endgame"]
            assert 0 <= reasoning["confidence"] <= 1


# Integration test for API endpoint
def test_annotate_endpoint_reasoning_populated():
    """Test that annotate endpoint properly populates reasoning"""
    try:
        from backend.api.routers.annotate import ensure_reasoning_populated, validate_reasoning_schema
        
        # Mock notes without reasoning
        notes = [note.copy() for note in [OPENING_QUIET_NOTE, TACTICAL_CHECK_NOTE]]
        
        # Process through router
        processed_notes = ensure_reasoning_populated(notes)
        
        # Each should have reasoning
        for note in processed_notes:
            assert "reasoning" in note
            assert validate_reasoning_schema(note["reasoning"])
            
    except ImportError:
        # Skip if FastAPI not available
        pytest.skip("FastAPI not available for integration test")


if __name__ == "__main__":
    # Run tests directly
    pytest.main([__file__, "-v"])