"""
shogi_wars.py

Shogi Wars provider (stub for future implementation).
Currently supports loading from pre-exported files only.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
import os
from pathlib import Path

from .base import KifuProvider, KifuInfo, KifuContent


class ShogiWarsProvider(KifuProvider):
    """
    Shogi Wars game provider.
    
    IMPORTANT: This provider does NOT perform web scraping or automated access.
    It only reads from pre-exported files that users manually place in a folder.
    
    Usage:
    1. Export games from Shogi Wars manually (using browser export features)
    2. Place exported files in data/kifu/wars/ folder
    3. Use this provider to access the exported files
    """
    
    def __init__(self, exported_folder: str = "data/kifu/wars"):
        super().__init__("shogi_wars")
        self.exported_folder = exported_folder
        self._rate_limits = {
            "requests_per_minute": 0,  # No network requests
            "concurrent_requests": 0,
            "daily_limit": 0
        }
    
    def search(self, query: Dict[str, Any]) -> List[KifuInfo]:
        """
        Search through exported Shogi Wars files.
        
        Args:
            query: Search parameters
                - player: str - Filter by player name in filename
                - date_from: datetime - Filter by file modification date
                - date_to: datetime - Filter by file modification date
                - limit: int - Maximum results (default: 50)
                
        Returns:
            List of KifuInfo objects from exported files
        """
        if not self.is_available():
            return []
        
        from ..kifu_loader import scan_kifu_directory
        
        files = scan_kifu_directory(self.exported_folder, recursive=True)
        results = []
        
        limit = query.get("limit", 50)
        player_filter = query.get("player", "").lower() if query.get("player") else None
        date_from = query.get("date_from")
        date_to = query.get("date_to")
        
        for file_path in files:
            file_info = Path(file_path)
            
            # Filter by player name in filename
            if player_filter and player_filter not in file_info.name.lower():
                continue
            
            # Filter by file modification date as proxy for game date
            if date_from or date_to:
                file_mtime = datetime.fromtimestamp(file_info.stat().st_mtime)
                if date_from and file_mtime < date_from:
                    continue
                if date_to and file_mtime > date_to:
                    continue
            
            # Extract metadata from filename if possible
            title, sente, gote = self._parse_filename_metadata(file_info.name)
            
            kifu_info = KifuInfo(
                id=file_path,
                source=self.name,
                title=title,
                sente=sente,
                gote=gote,
                metadata={
                    "file_path": file_path,
                    "file_size": file_info.stat().st_size,
                    "exported_file": True,
                    "original_source": "shogi_wars_export"
                }
            )
            results.append(kifu_info)
            
            if len(results) >= limit:
                break
        
        return results
    
    def fetch(self, game_id: str) -> Optional[KifuContent]:
        """
        Load exported Shogi Wars file.
        
        Args:
            game_id: File path of exported game
            
        Returns:
            Complete KifuContent or None if file not found
        """
        from ..kifu_loader import load_kifu_file
        
        try:
            if not os.path.exists(game_id):
                return None
            
            kifu_data = load_kifu_file(game_id)
            
            # Enhance metadata with Shogi Wars specific info
            filename = os.path.basename(game_id)
            title, sente, gote = self._parse_filename_metadata(filename)
            
            kifu_info = KifuInfo(
                id=game_id,
                source=self.name,
                title=title or kifu_data.metadata.title,
                sente=sente or kifu_data.metadata.sente,
                gote=gote or kifu_data.metadata.gote,
                result=kifu_data.metadata.result,
                time_rules=kifu_data.metadata.time_rules,
                metadata={
                    "file_path": game_id,
                    "exported_file": True,
                    "original_source": "shogi_wars_export",
                    "source_format": kifu_data.metadata.source_format
                }
            )
            
            return KifuContent(
                info=kifu_info,
                usi_moves=kifu_data.usi_moves,
                start_sfen=kifu_data.start_sfen,
                raw_content=None  # Could add file content if needed
            )
            
        except Exception as e:
            print(f"Error loading Shogi Wars export {game_id}: {e}")
            return None
    
    def is_available(self) -> bool:
        """Check if exported folder exists"""
        return os.path.exists(self.exported_folder)
    
    def get_supported_query_params(self) -> List[str]:
        """Parameters supported by this provider"""
        return ["player", "date_from", "date_to", "limit"]
    
    def get_rate_limits(self) -> Dict[str, Any]:
        """No rate limits for local file access"""
        return self._rate_limits
    
    def _parse_filename_metadata(self, filename: str) -> tuple[Optional[str], Optional[str], Optional[str]]:
        """
        Extract game metadata from filename patterns.
        
        Common Shogi Wars export filename patterns:
        - "player1_vs_player2_YYYY-MM-DD.kif"
        - "shogi_wars_game_12345.csa" 
        - "YYYY-MM-DD_player1_player2.kifu"
        
        Returns:
            tuple: (title, sente, gote)
        """
        try:
            # Remove extension
            name = Path(filename).stem
            
            # Try to detect vs pattern
            if "_vs_" in name:
                parts = name.split("_vs_")
                if len(parts) >= 2:
                    sente = parts[0].strip()
                    gote_part = parts[1].strip()
                    # Remove date suffix if present
                    gote = gote_part.split("_")[0] if "_" in gote_part else gote_part
                    return f"{sente} vs {gote}", sente, gote
            
            # Try other patterns
            if "shogi_wars" in name.lower():
                return f"Shogi Wars Game ({filename})", None, None
            
            # Default: use filename as title
            return filename, None, None
            
        except Exception:
            return filename, None, None
    
    @classmethod
    def create_export_folder(cls, base_path: str = "data/kifu/wars") -> str:
        """
        Create folder structure for Shogi Wars exports.
        
        Args:
            base_path: Base path for exports
            
        Returns:
            Path to created folder
        """
        import os
        os.makedirs(base_path, exist_ok=True)
        
        # Create README for user guidance
        readme_path = os.path.join(base_path, "README.txt")
        if not os.path.exists(readme_path):
            with open(readme_path, "w", encoding="utf-8") as f:
                f.write("""Shogi Wars Export Folder

This folder is for manually exported Shogi Wars games.

How to use:
1. Go to Shogi Wars website
2. Access your game history
3. Export individual games (usually KIF/CSA format)
4. Place exported files in this folder
5. Run kifu batch annotation

Note: This system does NOT automatically scrape or download games.
You must manually export and place files here.

Supported formats: .kif, .kifu, .csa, .usi
""")
        
        return base_path


# TODO: Future web scraping implementation (NOT included for legal/ethical reasons)
"""
Future implementation notes for web integration:

1. Authentication:
   - Would require user's own Shogi Wars account credentials
   - Need to respect terms of service
   - Consider rate limiting and polite access

2. API Integration:
   - Check if Shogi Wars provides official API
   - Use official endpoints if available
   - Avoid screen scraping

3. Legal Considerations:
   - Ensure compliance with website terms of service
   - Respect robots.txt
   - Only access user's own games
   - Implement proper rate limiting

4. Technical Implementation:
   - Use session-based authentication
   - Parse game history pages
   - Extract game URLs and metadata
   - Download KIF/CSA files through official export features

For now, this provider only supports manually exported files.
"""


def from_exported_folder(folder_path: str = "data/kifu/wars") -> ShogiWarsProvider:
    """
    Convenience function to create provider from exported folder.
    
    Args:
        folder_path: Path to folder containing exported files
        
    Returns:
        Configured ShogiWarsProvider instance
    """
    return ShogiWarsProvider(folder_path)