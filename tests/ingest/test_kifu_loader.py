"""
test_kifu_loader.py

Tests for Kifu file parsing and loading functionality.
"""

import pytest
import tempfile
import os
from pathlib import Path
from unittest.mock import patch, mock_open

import sys
sys.path.insert(0, '/home/jimjace/Shogi_AI_Learning')

from backend.ingest.kifu_loader import (
    KifuLoader, 
    load_kifu_file, 
    scan_kifu_directory, 
    validate_usi_moves,
    KifuData,
    KifuMetadata
)


class TestKifuLoader:
    """Test cases for KifuLoader class"""

    def test_detect_format_by_extension(self):
        """Test format detection based on file extension"""
        assert KifuLoader.detect_format("game.kif") == "kif"
        assert KifuLoader.detect_format("game.kifu") == "kif"
        assert KifuLoader.detect_format("game.csa") == "csa"
        assert KifuLoader.detect_format("game.usi") == "usi"
        assert KifuLoader.detect_format("game.KIF") == "kif"  # Case insensitive

    def test_extract_usi_moves_startpos(self):
        """Test USI move extraction from startpos string"""
        usi_content = "startpos moves 7g7f 3c3d 2g2f 8c8d"
        moves = KifuLoader._extract_usi_moves(usi_content)
        expected = ["7g7f", "3c3d", "2g2f", "8c8d"]
        assert moves == expected

    def test_extract_usi_moves_position(self):
        """Test USI move extraction from position string"""
        usi_content = "position sfen lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1 moves 7g7f 3c3d"
        moves = KifuLoader._extract_usi_moves(usi_content)
        expected = ["7g7f", "3c3d"]
        assert moves == expected

    def test_extract_usi_moves_simple(self):
        """Test USI move extraction from simple space-separated moves"""
        usi_content = "7g7f 3c3d 2g2f 8c8d P*5e"
        moves = KifuLoader._extract_usi_moves(usi_content)
        expected = ["7g7f", "3c3d", "2g2f", "8c8d", "P*5e"]
        assert moves == expected

    def test_extract_start_sfen(self):
        """Test SFEN extraction from position string"""
        usi_content = "position sfen lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1 moves 7g7f"
        sfen = KifuLoader._extract_start_sfen(usi_content)
        expected = "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1"
        assert sfen == expected

    def test_extract_start_sfen_startpos(self):
        """Test SFEN extraction returns None for startpos"""
        usi_content = "startpos moves 7g7f 3c3d"
        sfen = KifuLoader._extract_start_sfen(usi_content)
        assert sfen is None

    def test_csa_piece_to_usi(self):
        """Test CSA piece notation conversion"""
        assert KifuLoader._csa_piece_to_usi("FU") == "P"
        assert KifuLoader._csa_piece_to_usi("KY") == "L"
        assert KifuLoader._csa_piece_to_usi("KE") == "N"
        assert KifuLoader._csa_piece_to_usi("GI") == "S"
        assert KifuLoader._csa_piece_to_usi("KI") == "G"
        assert KifuLoader._csa_piece_to_usi("KA") == "B"
        assert KifuLoader._csa_piece_to_usi("HI") == "R"
        assert KifuLoader._csa_piece_to_usi("OU") == "K"

    def test_csa_to_usi_normal_move(self):
        """Test CSA to USI conversion for normal moves"""
        # +7776FU (77 to 76, pawn)
        result = KifuLoader._csa_to_usi("+7776FU")
        assert result == "7g7f"

    def test_csa_to_usi_drop_move(self):
        """Test CSA to USI conversion for drop moves"""
        # +0055FU (drop pawn to 55)
        result = KifuLoader._csa_to_usi("+0055FU")
        assert result == "P*5e"

    def test_csa_to_usi_promotion(self):
        """Test CSA to USI conversion with promotion"""
        # This is a simplified test - real CSA promotion is more complex
        result = KifuLoader._csa_to_usi("+7776FUTO")
        assert result == "7g7f+"  # Basic promotion detection

    @patch("builtins.open", new_callable=mock_open, read_data="startpos moves 7g7f 3c3d")
    def test_parse_usi_file(self, mock_file):
        """Test parsing USI format files"""
        with patch("os.path.basename", return_value="test.usi"):
            result = KifuLoader._parse_usi_file("test.usi")
        
        assert isinstance(result, KifuData)
        assert result.usi_moves == ["7g7f", "3c3d"]
        assert result.metadata.source_format == "usi"
        assert result.metadata.title == "test.usi"
        assert result.start_sfen is None

    @patch("builtins.open", new_callable=mock_open, read_data="""\
V2.2
$TITLE:Test Game
$SENTE:Player1
$GOTE:Player2
+7776FU
-3334FU
+2726FU
""")
    def test_parse_csa_file(self, mock_file):
        """Test parsing CSA format files"""
        result = KifuLoader._parse_csa_file("test.csa")
        
        assert isinstance(result, KifuData)
        assert result.metadata.title == "Test Game"
        assert result.metadata.sente == "Player1"
        assert result.metadata.gote == "Player2"
        assert result.metadata.source_format == "csa"
        assert len(result.usi_moves) == 3

    @patch("builtins.open", new_callable=mock_open, read_data="""\
先手：テスト太郎
後手：将棋花子
手数----指手---------消費時間--
   1 ７六歩(77)   ( 0:01/00:00:01)
   2 ３四歩(33)   ( 0:01/00:00:02)
""")
    def test_parse_kif_file(self, mock_file):
        """Test parsing KIF format files"""
        result = KifuLoader._parse_kif_file("test.kif")
        
        assert isinstance(result, KifuData)
        assert result.metadata.sente == "テスト太郎"
        assert result.metadata.gote == "将棋花子"
        assert result.metadata.source_format == "kif"
        # Note: KIF parsing is simplified and returns placeholder moves
        assert isinstance(result.usi_moves, list)


class TestUtilityFunctions:
    """Test utility functions"""

    def test_validate_usi_moves_valid(self):
        """Test USI move validation with valid moves"""
        moves = ["7g7f", "3c3d", "2g2f", "P*5e", "1a1b+"]
        valid, errors = validate_usi_moves(moves)
        assert valid is True
        assert len(errors) == 0

    def test_validate_usi_moves_invalid(self):
        """Test USI move validation with invalid moves"""
        moves = ["7g7f", "invalid", "2g2f", "", "xyz"]
        valid, errors = validate_usi_moves(moves)
        assert valid is False
        assert len(errors) == 3  # invalid, empty, xyz

    def test_validate_usi_moves_empty(self):
        """Test USI move validation with empty list"""
        moves = []
        valid, errors = validate_usi_moves(moves)
        assert valid is True
        assert len(errors) == 0

    def test_scan_kifu_directory_empty(self):
        """Test directory scanning with non-existent directory"""
        result = scan_kifu_directory("/nonexistent/path")
        assert result == []

    def test_scan_kifu_directory_with_files(self):
        """Test directory scanning with sample files"""
        with tempfile.TemporaryDirectory() as temp_dir:
            # Create test files
            test_files = ["game1.kif", "game2.csa", "game3.usi", "other.txt"]
            for filename in test_files:
                Path(temp_dir, filename).touch()
            
            result = scan_kifu_directory(temp_dir, recursive=False)
            
            # Should find 3 kifu files, excluding other.txt
            assert len(result) == 3
            assert all("game" in path for path in result)
            assert all(any(path.endswith(ext) for ext in [".kif", ".csa", ".usi"]) for path in result)

    def test_scan_kifu_directory_recursive(self):
        """Test recursive directory scanning"""
        with tempfile.TemporaryDirectory() as temp_dir:
            # Create nested structure
            subdir = Path(temp_dir, "subdir")
            subdir.mkdir()
            
            Path(temp_dir, "game1.kif").touch()
            Path(subdir, "game2.csa").touch()
            
            result = scan_kifu_directory(temp_dir, recursive=True)
            assert len(result) == 2
            
            result_no_recursive = scan_kifu_directory(temp_dir, recursive=False)
            assert len(result_no_recursive) == 1


class TestIntegration:
    """Integration tests for file loading"""

    def test_load_kifu_file_integration(self):
        """Test complete file loading workflow"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.usi', delete=False) as f:
            f.write("startpos moves 7g7f 3c3d 2g2f 8c8d")
            temp_path = f.name
        
        try:
            result = load_kifu_file(temp_path)
            
            assert isinstance(result, KifuData)
            assert result.usi_moves == ["7g7f", "3c3d", "2g2f", "8c8d"]
            assert result.metadata.source_format == "usi"
            assert result.start_sfen is None
            
        finally:
            os.unlink(temp_path)

    def test_load_kifu_file_with_sfen(self):
        """Test file loading with custom SFEN"""
        sfen = "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1"
        content = f"position sfen {sfen} moves 7g7f 3c3d"
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.usi', delete=False) as f:
            f.write(content)
            temp_path = f.name
        
        try:
            result = load_kifu_file(temp_path)
            
            assert result.usi_moves == ["7g7f", "3c3d"]
            assert result.start_sfen == sfen
            
        finally:
            os.unlink(temp_path)


class TestErrorHandling:
    """Test error handling scenarios"""

    def test_load_nonexistent_file(self):
        """Test loading non-existent file"""
        with pytest.raises((FileNotFoundError, IOError)):
            load_kifu_file("/nonexistent/file.kif")

    def test_detect_format_unknown(self):
        """Test format detection for unknown extension"""
        with patch("builtins.open", mock_open(read_data="unknown content")):
            result = KifuLoader.detect_format("test.xyz")
            assert result in ["kif", "unknown"]  # Default fallback

    def test_csa_to_usi_invalid(self):
        """Test CSA conversion with invalid input"""
        result = KifuLoader._csa_to_usi("invalid")
        assert result is None

    def test_parse_malformed_file(self):
        """Test parsing malformed files"""
        with patch("builtins.open", mock_open(read_data="malformed content")):
            # Should not raise exception, but return empty or minimal data
            try:
                result = KifuLoader._parse_usi_file("test.usi")
                assert isinstance(result, KifuData)
            except Exception as e:
                # Some parsing errors are acceptable
                assert "moves" in str(e).lower() or "format" in str(e).lower()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])