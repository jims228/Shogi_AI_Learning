"""
Annotate router - ensures reasoning field is properly populated
"""

import os
from typing import List, Dict, Any, Optional
from fastapi import HTTPException

# Import from main API module for now - in a real refactor, we'd move shared models
# For this implementation, we'll ensure reasoning is populated in the existing endpoint


def ensure_reasoning_populated(notes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Ensure all notes have properly populated reasoning fields
    
    Args:
        notes: List of MoveNote dictionaries
        
    Returns:
        List[Dict]: Notes with guaranteed reasoning fields
    """
    try:
        from ...ai.reasoning import build_multiple_reasoning
        
        # Check if reasoning is already populated
        if notes and all(note.get("reasoning") for note in notes):
            return notes
        
        # Generate reasoning for all notes
        reasonings = build_multiple_reasoning(notes, {"game_type": "normal"})
        
        # Populate reasoning fields
        for i, note in enumerate(notes):
            if i < len(reasonings):
                note["reasoning"] = reasonings[i]
            else:
                # Fallback empty reasoning
                note["reasoning"] = {
                    "summary": "分析情報が不十分です。",
                    "tags": [],
                    "confidence": 0.3,
                    "method": "fallback",
                    "context": {
                        "phase": "middlegame",
                        "plan": "develop",
                        "move_type": "normal"
                    },
                    "pv_summary": {
                        "line": "",
                        "why_better": []
                    }
                }
        
        return notes
        
    except Exception as e:
        print(f"Error ensuring reasoning populated: {e}")
        # Return notes with minimal reasoning
        for note in notes:
            if not note.get("reasoning"):
                note["reasoning"] = {
                    "summary": "推論生成中にエラーが発生しました。",
                    "tags": [],
                    "confidence": 0.2,
                    "method": "error",
                    "context": {
                        "phase": "middlegame", 
                        "plan": "develop",
                        "move_type": "normal"
                    },
                    "pv_summary": {
                        "line": "",
                        "why_better": []
                    }
                }
        
        return notes


def validate_reasoning_schema(reasoning: Dict[str, Any]) -> bool:
    """
    Validate that reasoning follows the v2 schema
    
    Args:
        reasoning: Reasoning dictionary to validate
        
    Returns:
        bool: True if valid schema
    """
    required_fields = ["summary", "tags", "confidence", "method", "context", "pv_summary"]
    
    if not all(field in reasoning for field in required_fields):
        return False
    
    # Validate context subfields
    context = reasoning.get("context", {})
    required_context_fields = ["phase", "plan", "move_type"]
    if not all(field in context for field in required_context_fields):
        return False
    
    # Validate pv_summary subfields
    pv_summary = reasoning.get("pv_summary", {})
    required_pv_fields = ["line", "why_better"]
    if not all(field in pv_summary for field in required_pv_fields):
        return False
    
    # Validate confidence range
    confidence = reasoning.get("confidence", 0)
    if not isinstance(confidence, (int, float)) or not (0 <= confidence <= 1):
        return False
    
    return True


def post_process_reasoning(notes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Post-process reasoning fields to ensure consistency
    
    Args:
        notes: List of notes with reasoning
        
    Returns:
        List[Dict]: Post-processed notes
    """
    for note in notes:
        reasoning = note.get("reasoning", {})
        
        if not validate_reasoning_schema(reasoning):
            # Fix invalid reasoning
            reasoning.setdefault("summary", "標準的な手です。")
            reasoning.setdefault("tags", [])
            reasoning.setdefault("confidence", 0.5)
            reasoning.setdefault("method", "rule_based")
            
            context = reasoning.setdefault("context", {})
            context.setdefault("phase", "middlegame")
            context.setdefault("plan", "develop") 
            context.setdefault("move_type", "normal")
            
            pv_summary = reasoning.setdefault("pv_summary", {})
            pv_summary.setdefault("line", "")
            pv_summary.setdefault("why_better", [])
        
        # Ensure confidence is in valid range
        confidence = reasoning.get("confidence", 0.5)
        reasoning["confidence"] = max(0.0, min(1.0, float(confidence)))
        
        # Ensure tags is a list
        if not isinstance(reasoning.get("tags"), list):
            reasoning["tags"] = []
    
    return notes