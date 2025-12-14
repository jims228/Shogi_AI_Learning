"""
kifu_loader.py

Parse KIF/CSA/USI files into standardized USI format.
Supports multiple file formats with lightweight pure-Python parsing.
"""

import os
import re
from typing import List, Optional, Dict, Any, Tuple
from dataclasses import dataclass
from pathlib import Path


@dataclass 
class KifuMetadata:
    """Metadata extracted from Kifu files"""
    title: Optional[str] = None
    date: Optional[str] = None
    sente: Optional[str] = None  # 先手
    gote: Optional[str] = None   # 後手
    result: Optional[str] = None
    time_rules: Optional[str] = None
    source_format: Optional[str] = None
    source_path: Optional[str] = None


@dataclass
class KifuData:
    """Standardized Kifu representation"""
    usi_moves: List[str]
    metadata: KifuMetadata
    start_sfen: Optional[str] = None  # None means startpos


class KifuLoader:
    """Parse various Kifu formats into standardized USI"""
    
    # KIF notation mappings
    KIF_PIECE_MAP = {
        "歩": "P", "香": "L", "桂": "N", "銀": "S", "金": "G", "角": "B", "飛": "R", "玉": "K", "王": "K",
        "と": "+P", "成香": "+L", "成桂": "+N", "成銀": "+S", "馬": "+B", "龍": "+R", "竜": "+R"
    }
    
    KIF_FILE_MAP = {"１": "1", "２": "2", "３": "3", "４": "4", "５": "5", "６": "6", "７": "7", "８": "8", "９": "9"}
    KIF_RANK_MAP = {"一": "a", "二": "b", "三": "c", "四": "d", "五": "e", "六": "f", "七": "g", "八": "h", "九": "i"}
    
    @classmethod
    def detect_format(cls, file_path: str) -> str:
        """Detect format based on file extension"""
        ext = Path(file_path).suffix.lower()
        if ext in ['.kif', '.kifu']:
            return 'kif'
        elif ext == '.csa':
            return 'csa'
        elif ext == '.usi':
            return 'usi'
        else:
            # Try to detect by content
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    first_lines = f.read(1000)
                    if 'V2.2' in first_lines or "'" in first_lines:
                        return 'csa'
                    elif 'startpos' in first_lines or 'position' in first_lines:
                        return 'usi'
                    else:
                        return 'kif'  # default
            except Exception:
                return 'unknown'
    
    @classmethod
    def load_file(cls, file_path: str) -> KifuData:
        """Load and parse a Kifu file"""
        format_type = cls.detect_format(file_path)
        
        if format_type == 'usi':
            return cls._parse_usi_file(file_path)
        elif format_type == 'csa':
            return cls._parse_csa_file(file_path)
        elif format_type == 'kif':
            return cls._parse_kif_file(file_path)
        else:
            raise ValueError(f"Unsupported format: {format_type}")
    
    @classmethod
    def _parse_usi_file(cls, file_path: str) -> KifuData:
        """Parse USI format file (passthrough)"""
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read().strip()
        
        metadata = KifuMetadata(
            source_format='usi',
            source_path=file_path,
            title=os.path.basename(file_path)
        )
        
        # Extract moves from USI string
        usi_moves = cls._extract_usi_moves(content)
        start_sfen = cls._extract_start_sfen(content)
        
        return KifuData(
            usi_moves=usi_moves,
            metadata=metadata,
            start_sfen=start_sfen
        )
    
    @classmethod
    def _extract_usi_moves(cls, usi_content: str) -> List[str]:
        """Extract move list from USI content"""
        content = usi_content.strip()
        
        if content.startswith("startpos"):
            # "startpos moves 7g7f 3c3d ..."
            parts = content.split()
            if "moves" in parts:
                moves_idx = parts.index("moves")
                return parts[moves_idx + 1:]
            return []
        
        elif content.startswith("position"):
            # "position sfen <sfen> moves ..." or "position startpos moves ..."
            parts = content.split()
            if "moves" in parts:
                moves_idx = parts.index("moves")
                return parts[moves_idx + 1:]
            return []
        
        else:
            # Simple space-separated moves
            parts = content.split()
            # Filter out obviously non-move tokens
            moves = []
            for part in parts:
                if re.match(r'^[1-9][a-i][1-9][a-i][+]?$', part):  # USI move pattern
                    moves.append(part)
                elif re.match(r'^[PLNSGBRKP]\*[1-9][a-i]$', part):  # Drop pattern
                    moves.append(part)
            return moves
    
    @classmethod
    def _extract_start_sfen(cls, usi_content: str) -> Optional[str]:
        """Extract starting SFEN if not startpos"""
        content = usi_content.strip()
        
        if content.startswith("position sfen"):
            parts = content.split()
            sfen_idx = parts.index("sfen")
            if sfen_idx + 4 < len(parts):  # SFEN has 4 parts minimum
                if "moves" in parts:
                    moves_idx = parts.index("moves")
                    sfen_parts = parts[sfen_idx + 1:moves_idx]
                else:
                    sfen_parts = parts[sfen_idx + 1:]
                
                # Reconstruct SFEN (up to 4 parts)
                return " ".join(sfen_parts[:4])
        
        return None
    
    @classmethod 
    def _parse_csa_file(cls, file_path: str) -> KifuData:
        """Parse CSA format file (simplified)"""
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = [line.strip() for line in f.readlines()]
        
        metadata = KifuMetadata(
            source_format='csa',
            source_path=file_path
        )
        
        usi_moves = []
        in_moves = False
        
        for line in lines:
            # Extract metadata
            if line.startswith("$TITLE:"):
                metadata.title = line[7:].strip()
            elif line.startswith("$DATE:"):
                metadata.date = line[6:].strip()
            elif line.startswith("$SENTE:"):
                metadata.sente = line[7:].strip()
            elif line.startswith("$GOTE:"):
                metadata.gote = line[6:].strip()
            elif line.startswith("$TIME_LIMIT:"):
                metadata.time_rules = line[12:].strip()
            
            # Parse moves (simplified CSA->USI conversion)
            elif line.startswith("+") or line.startswith("-"):
                if len(line) >= 7:  # Minimum CSA move length
                    try:
                        usi_move = cls._csa_to_usi(line)
                        if usi_move:
                            usi_moves.append(usi_move)
                    except Exception:
                        # Skip invalid moves
                        continue
        
        return KifuData(
            usi_moves=usi_moves,
            metadata=metadata
        )
    
    @classmethod
    def _csa_to_usi(cls, csa_move: str) -> Optional[str]:
        """Convert CSA move to USI (simplified)"""
        # CSA format: +7776FU (from 77 to 76, FU piece)
        # USI format: 7g7f
        
        if len(csa_move) < 7:
            return None
        
        try:
            player = csa_move[0]  # + or -
            from_file = int(csa_move[1])
            from_rank = int(csa_move[2])
            to_file = int(csa_move[3])
            to_rank = int(csa_move[4])
            piece = csa_move[5:7]
        except (ValueError, IndexError):
            return None
        
        # Handle drops
        if from_file == 0 and from_rank == 0:
            # Drop: piece*to_square
            piece_usi = cls._csa_piece_to_usi(piece)
            to_square = f"{to_file}{chr(ord('a') + to_rank - 1)}"
            return f"{piece_usi}*{to_square}"
        
        # Normal move
        from_square = f"{from_file}{chr(ord('a') + from_rank - 1)}"
        to_square = f"{to_file}{chr(ord('a') + to_rank - 1)}"
        
        # Check for promotion
        promote = ""
        if len(csa_move) > 7 and csa_move[7:9] in ["TO", "NY", "NK", "NG", "UM", "RY"]:
            promote = "+"
        
        return f"{from_square}{to_square}{promote}"
    
    @classmethod
    def _csa_piece_to_usi(cls, csa_piece: str) -> str:
        """Convert CSA piece notation to USI"""
        piece_map = {
            "FU": "P", "KY": "L", "KE": "N", "GI": "S", "KI": "G",
            "KA": "B", "HI": "R", "OU": "K", "GY": "K"
        }
        return piece_map.get(csa_piece, "P")
    
    @classmethod
    def _parse_kif_file(cls, file_path: str) -> KifuData:
        """Parse KIF format file (simplified Japanese notation)"""
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = [line.strip() for line in f.readlines()]
        
        metadata = KifuMetadata(
            source_format='kif',
            source_path=file_path
        )
        
        usi_moves = []
        in_header = True
        
        for line in lines:
            # Parse header information
            if in_header:
                if line.startswith("先手：") or line.startswith("下手："):
                    metadata.sente = line.split("：", 1)[1] if "：" in line else None
                elif line.startswith("後手：") or line.startswith("上手："):
                    metadata.gote = line.split("：", 1)[1] if "：" in line else None
                elif line.startswith("開始日時："):
                    metadata.date = line.split("：", 1)[1] if "：" in line else None
                elif line.startswith("表題："):
                    metadata.title = line.split("：", 1)[1] if "：" in line else None
                elif line.startswith("手数----指手"):
                    in_header = False
                continue
            
            # Parse moves
            if re.match(r'^\s*\d+', line):  # Line starts with move number
                try:
                    usi_move = cls._kif_line_to_usi(line)
                    if usi_move:
                        usi_moves.append(usi_move)
                except Exception:
                    # Skip invalid moves
                    continue
        
        return KifuData(
            usi_moves=usi_moves,
            metadata=metadata
        )
    
    @classmethod
    def _kif_line_to_usi(cls, line: str) -> Optional[str]:
        """Convert KIF move line to USI (very simplified)"""
        # KIF format example: "   1 ７六歩(77)   ( 0:01/00:00:01)"
        # This is a simplified parser - a full implementation would need
        # much more complex Japanese notation parsing
        
        # Extract basic move pattern
        match = re.search(r'([１-９])([一-九])([歩香桂銀金角飛王玉と全圭])(\([0-9][0-9]\))?', line)
        if not match:
            return None
        
        file_jp = match.group(1)
        rank_jp = match.group(2)
        piece_jp = match.group(3)
        from_square = match.group(4)
        
        # Convert Japanese numbers to USI
        file_num = cls.KIF_FILE_MAP.get(file_jp)
        rank_char = cls.KIF_RANK_MAP.get(rank_jp)
        
        if not file_num or not rank_char:
            return None
        
        to_square = f"{file_num}{rank_char}"
        
        # This is a very basic conversion - real KIF parsing would need:
        # - Proper from-square detection
        # - Disambiguation (同 notation)
        # - Drop notation
        # - Promotion detection
        # For now, return a placeholder that indicates parsing limitation
        
        return f"0000"  # Placeholder - indicates KIF parsing needs improvement


def load_kifu_file(file_path: str) -> KifuData:
    """Convenience function to load a single Kifu file"""
    return KifuLoader.load_file(file_path)


def scan_kifu_directory(directory: str, recursive: bool = True) -> List[str]:
    """Scan directory for Kifu files"""
    kifu_extensions = ['.kif', '.kifu', '.csa', '.usi']
    kifu_files = []
    
    path_obj = Path(directory)
    if not path_obj.exists():
        return []
    
    pattern = "**/*" if recursive else "*"
    for file_path in path_obj.glob(pattern):
        if file_path.is_file() and file_path.suffix.lower() in kifu_extensions:
            kifu_files.append(str(file_path))
    
    return sorted(kifu_files)


def validate_usi_moves(moves: List[str]) -> Tuple[bool, List[str]]:
    """Validate USI move format and return errors"""
    errors = []
    
    for i, move in enumerate(moves):
        if not move:
            errors.append(f"Move {i+1}: Empty move")
            continue
        
        # Basic USI move pattern validation
        if not (re.match(r'^[1-9][a-i][1-9][a-i][+]?$', move) or  # Normal move
                re.match(r'^[PLNSGBRKP]\*[1-9][a-i]$', move)):      # Drop move
            errors.append(f"Move {i+1}: Invalid USI format '{move}'")
    
    return len(errors) == 0, errors