"""
test_batch.py

Tests for batch annotation functionality.
Tests the complete pipeline from file scanning to annotation output.
"""

import pytest
import tempfile
import os
import json
from pathlib import Path
from unittest.mock import patch, MagicMock

import sys
sys.path.insert(0, '/home/jimjace/Shogi_AI_Learning')

from backend.services.annotate_batch import (
    BatchAnnotationService,
    AnnotationRequest,
    AnnotationResult,
    BatchAnnotationSummary
)


class TestBatchAnnotationService:
    """Test cases for BatchAnnotationService"""

    @pytest.fixture
    def service(self):
        """Create a test batch annotation service"""
        with patch.dict(os.environ, {"KIFU_DIR": "test_kifu", "KIFU_OUT": "test_out"}):
            return BatchAnnotationService()

    @pytest.fixture
    def temp_structure(self):
        """Create temporary directory structure with test files"""
        temp_dir = tempfile.mkdtemp()
        kifu_dir = os.path.join(temp_dir, "kifu")
        out_dir = os.path.join(temp_dir, "out")
        
        os.makedirs(kifu_dir)
        os.makedirs(out_dir)
        
        # Create test files
        test_files = {
            "game1.usi": "startpos moves 7g7f 3c3d 2g2f 8c8d",
            "game2.kif": """先手：テスト太郎
後手：将棋花子
手数----指手---------消費時間--
   1 ７六歩(77)   ( 0:01/00:00:01)
   2 ３四歩(33)   ( 0:01/00:00:02)""",
            "broken.usi": "invalid usi content",
            "subdir/game3.csa": """V2.2
$TITLE:Test Game
$SENTE:Player1
$GOTE:Player2
+7776FU
-3334FU""",
        }
        
        for file_path, content in test_files.items():
            full_path = os.path.join(kifu_dir, file_path)
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            with open(full_path, 'w', encoding='utf-8') as f:
                f.write(content)
        
        return {
            "temp_dir": temp_dir,
            "kifu_dir": kifu_dir,
            "out_dir": out_dir,
            "files": test_files
        }

    def test_service_initialization(self, service):
        """Test service initialization with environment variables"""
        assert service.kifu_dir == "test_kifu"
        assert service.kifu_out == "test_out"
        assert service.default_byoyomi == 250

    def test_get_folder_stats_nonexistent(self, service):
        """Test folder stats for non-existent directory"""
        stats = service.get_folder_stats("/nonexistent/path")
        
        assert stats["exists"] is False
        assert stats["total_files"] == 0
        assert stats["by_extension"] == {}
        assert stats["total_size_mb"] == 0

    def test_get_folder_stats_existing(self, service, temp_structure):
        """Test folder stats for existing directory with files"""
        stats = service.get_folder_stats(temp_structure["kifu_dir"])
        
        assert stats["exists"] is True
        assert stats["total_files"] == 4
        assert ".usi" in stats["by_extension"]
        assert ".kif" in stats["by_extension"]
        assert ".csa" in stats["by_extension"]
        assert stats["total_size_mb"] > 0
        assert len(stats["sample_files"]) <= 5

    @patch('backend.services.annotate_batch.BatchAnnotationService._call_annotation_service')
    def test_annotate_single_file_success(self, mock_annotate, service, temp_structure):
        """Test successful single file annotation"""
        mock_annotate.return_value = {
            "summary": "Test annotation",
            "notes": [
                {"ply": 1, "move": "7g7f", "reasoning": {"summary": "Good move"}}
            ]
        }
        
        file_path = os.path.join(temp_structure["kifu_dir"], "game1.usi")
        output_path = os.path.join(temp_structure["out_dir"], "game1.json")
        
        request = AnnotationRequest(
            file_path=file_path,
            output_path=output_path,
            byoyomi_ms=100
        )
        
        result = service.annotate_single_file(request)
        
        assert result.success is True
        assert result.file_path == file_path
        assert result.output_path == output_path
        assert result.move_count == 4  # 7g7f 3c3d 2g2f 8c8d
        assert result.error_message is None
        assert os.path.exists(output_path)
        
        # Check output file content
        with open(output_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        assert "metadata" in data
        assert "annotation" in data
        assert data["source_file"] == file_path

    def test_annotate_single_file_invalid_moves(self, service, temp_structure):
        """Test single file annotation with invalid moves"""
        file_path = os.path.join(temp_structure["kifu_dir"], "broken.usi")
        
        request = AnnotationRequest(
            file_path=file_path,
            skip_validation=False
        )
        
        result = service.annotate_single_file(request)
        
        assert result.success is False
        assert "Invalid USI moves" in result.error_message

    def test_annotate_single_file_skip_validation(self, service, temp_structure):
        """Test single file annotation with validation skipped"""
        with patch('backend.services.annotate_batch.BatchAnnotationService._call_annotation_service') as mock_annotate:
            mock_annotate.return_value = {
                "summary": "Test annotation",
                "notes": []
            }
            
            file_path = os.path.join(temp_structure["kifu_dir"], "broken.usi")
            
            request = AnnotationRequest(
                file_path=file_path,
                skip_validation=True
            )
            
            result = service.annotate_single_file(request)
            
            # Should succeed when validation is skipped
            assert result.success is True

    def test_annotate_single_file_nonexistent(self, service):
        """Test annotation of non-existent file"""
        request = AnnotationRequest(file_path="/nonexistent/file.usi")
        result = service.annotate_single_file(request)
        
        assert result.success is False
        assert "not found" in result.error_message.lower() or "error" in result.error_message.lower()

    @patch('backend.services.annotate_batch.BatchAnnotationService._call_annotation_service')
    def test_annotate_folder_success(self, mock_annotate, service, temp_structure):
        """Test successful folder annotation"""
        mock_annotate.return_value = {
            "summary": "Test annotation",
            "notes": [{"ply": 1, "move": "7g7f", "reasoning": {"summary": "Good move"}}]
        }
        
        # Override service directories to use temp structure
        service.kifu_dir = temp_structure["kifu_dir"]
        service.kifu_out = temp_structure["out_dir"]
        
        summary = service.annotate_folder(
            folder_path=temp_structure["kifu_dir"],
            recursive=True,
            skip_validation=True  # Skip validation for test files
        )
        
        assert isinstance(summary, BatchAnnotationSummary)
        assert summary.total_files == 4
        assert summary.scanned == 4
        assert summary.annotated >= 1  # At least game1.usi should work
        assert summary.total_time_ms > 0
        assert len(summary.results) == 4

    def test_annotate_folder_nonexistent(self, service):
        """Test folder annotation with non-existent directory"""
        summary = service.annotate_folder("/nonexistent/path")
        
        assert summary.total_files == 0
        assert summary.scanned == 0
        assert summary.annotated == 0

    @patch('backend.services.annotate_batch.BatchAnnotationService._call_annotation_service')
    def test_annotate_folder_mixed_results(self, mock_annotate, service, temp_structure):
        """Test folder annotation with mixed success/failure results"""
        # Mock to succeed for some files and fail for others
        def mock_side_effect(*args, **kwargs):
            if "broken" in str(args):
                raise ValueError("Invalid file")
            return {
                "summary": "Test annotation", 
                "notes": [{"ply": 1, "move": "7g7f"}]
            }
        
        mock_annotate.side_effect = mock_side_effect
        
        service.kifu_dir = temp_structure["kifu_dir"]
        service.kifu_out = temp_structure["out_dir"]
        
        summary = service.annotate_folder(
            folder_path=temp_structure["kifu_dir"],
            recursive=True,
            skip_validation=True
        )
        
        assert summary.total_files == 4
        assert summary.errors > 0  # broken.usi should fail
        assert summary.annotated > 0  # Some files should succeed
        assert len(summary.error_details) > 0

    def test_annotation_request_creation(self):
        """Test AnnotationRequest creation and defaults"""
        request = AnnotationRequest(file_path="test.kif")
        
        assert request.file_path == "test.kif"
        assert request.output_path is None
        assert request.byoyomi_ms is None
        assert request.skip_validation is False

    def test_annotation_result_creation(self):
        """Test AnnotationResult creation"""
        result = AnnotationResult(
            file_path="test.kif",
            success=True,
            move_count=10,
            annotation_count=8
        )
        
        assert result.file_path == "test.kif"
        assert result.success is True
        assert result.move_count == 10
        assert result.annotation_count == 8

    def test_batch_summary_creation(self):
        """Test BatchAnnotationSummary creation with defaults"""
        results = [
            AnnotationResult("file1.kif", True, move_count=5),
            AnnotationResult("file2.kif", False, error_message="Error")
        ]
        
        summary = BatchAnnotationSummary(
            total_files=2,
            scanned=2,
            annotated=1,
            errors=1,
            skipped=0,
            total_time_ms=1000,
            results=results
        )
        
        assert summary.total_files == 2
        assert summary.annotated == 1
        assert summary.errors == 1
        assert len(summary.results) == 2
        assert summary.error_details == []  # Default empty list

    @patch('backend.api.main.annotate')
    def test_call_annotation_service_success(self, mock_annotate, service):
        """Test successful annotation service call"""
        # Mock the annotate function response
        mock_response = MagicMock()
        mock_response.dict.return_value = {
            "summary": "Test summary",
            "notes": [{"ply": 1, "move": "7g7f"}]
        }
        mock_annotate.return_value = mock_response
        
        result = service._call_annotation_service(
            usi_moves=["7g7f", "3c3d"],
            byoyomi_ms=250
        )
        
        assert "summary" in result
        assert "notes" in result
        assert result["summary"] == "Test summary"

    def test_call_annotation_service_fallback(self, service):
        """Test annotation service fallback on error"""
        # Test with import error scenario
        with patch('backend.services.annotate_batch.annotate', side_effect=ImportError):
            result = service._call_annotation_service(
                usi_moves=["7g7f", "3c3d"],
                byoyomi_ms=250
            )
        
        assert "summary" in result
        assert "notes" in result
        assert len(result["notes"]) == 2  # Should create basic notes for each move

    def test_environment_variable_override(self):
        """Test service configuration with different environment variables"""
        test_env = {
            "KIFU_DIR": "/custom/kifu",
            "KIFU_OUT": "/custom/out", 
            "ENGINE_PER_MOVE_MS": "500"
        }
        
        with patch.dict(os.environ, test_env):
            service = BatchAnnotationService()
            
            assert service.kifu_dir == "/custom/kifu"
            assert service.kifu_out == "/custom/out"
            assert service.default_byoyomi == 500


class TestIntegrationWorkflow:
    """Integration tests for complete workflows"""

    def test_complete_batch_workflow(self):
        """Test complete workflow from setup to output"""
        with tempfile.TemporaryDirectory() as temp_dir:
            kifu_dir = os.path.join(temp_dir, "kifu")
            out_dir = os.path.join(temp_dir, "out")
            os.makedirs(kifu_dir)
            
            # Create a valid USI file
            test_file = os.path.join(kifu_dir, "test_game.usi")
            with open(test_file, 'w') as f:
                f.write("startpos moves 7g7f 3c3d")
            
            # Override environment
            with patch.dict(os.environ, {"KIFU_DIR": kifu_dir, "KIFU_OUT": out_dir}):
                service = BatchAnnotationService()
                
                # Mock annotation to avoid engine dependency
                with patch.object(service, '_call_annotation_service') as mock_annotate:
                    mock_annotate.return_value = {
                        "summary": "Test game analysis",
                        "notes": [
                            {"ply": 1, "move": "7g7f", "reasoning": {"summary": "Opening"}},
                            {"ply": 2, "move": "3c3d", "reasoning": {"summary": "Response"}}
                        ]
                    }
                    
                    # Run annotation
                    summary = service.annotate_folder()
                    
                    # Verify results
                    assert summary.success
                    assert summary.annotated == 1
                    assert summary.errors == 0
                    
                    # Check output file exists
                    output_file = os.path.join(out_dir, "test_game.json")
                    assert os.path.exists(output_file)
                    
                    # Verify output content
                    with open(output_file, 'r') as f:
                        data = json.load(f)
                    
                    assert data["annotation"]["summary"] == "Test game analysis"
                    assert len(data["annotation"]["notes"]) == 2


if __name__ == "__main__":
    pytest.main([__file__, "-v"])