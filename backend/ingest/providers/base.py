"""
base.py

Abstract base class for Kifu providers.
Defines interface for fetching game data from various sources.
"""

from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
from dataclasses import dataclass
from datetime import datetime


@dataclass
class KifuInfo:
    """Standardized game information from providers"""
    id: str                           # Unique identifier within provider
    source: str                      # Provider name (e.g., "shogi_wars", "local")
    title: Optional[str] = None
    date: Optional[datetime] = None
    sente: Optional[str] = None      # 先手 player name
    gote: Optional[str] = None       # 後手 player name
    result: Optional[str] = None     # Game result
    time_rules: Optional[str] = None
    url: Optional[str] = None        # Original URL if available
    metadata: Dict[str, Any] = None  # Additional provider-specific data
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


@dataclass
class KifuContent:
    """Complete game data including moves"""
    info: KifuInfo
    usi_moves: List[str]             # USI format moves
    start_sfen: Optional[str] = None # None means startpos
    raw_content: Optional[str] = None # Original file content if available


class KifuProvider(ABC):
    """Abstract base class for Kifu providers"""
    
    def __init__(self, name: str):
        self.name = name
    
    @abstractmethod
    def search(self, query: Dict[str, Any]) -> List[KifuInfo]:
        """
        Search for games based on query parameters.
        
        Args:
            query: Search parameters (provider-specific)
                Common fields:
                - player: str - Player name
                - date_from: datetime - Start date
                - date_to: datetime - End date  
                - limit: int - Maximum results
                
        Returns:
            List of KifuInfo objects matching the query
        """
        pass
    
    @abstractmethod
    def fetch(self, game_id: str) -> Optional[KifuContent]:
        """
        Fetch complete game data by ID.
        
        Args:
            game_id: Game identifier from search results
            
        Returns:
            Complete KifuContent or None if not found
        """
        pass
    
    @abstractmethod
    def is_available(self) -> bool:
        """
        Check if provider is available and configured.
        
        Returns:
            True if provider can be used
        """
        pass
    
    def get_supported_query_params(self) -> List[str]:
        """
        Get list of supported query parameters.
        
        Returns:
            List of parameter names supported by this provider
        """
        return ["player", "date_from", "date_to", "limit"]
    
    def get_rate_limits(self) -> Dict[str, Any]:
        """
        Get rate limiting information.
        
        Returns:
            Dict with rate limit info (requests_per_minute, etc.)
        """
        return {"requests_per_minute": 60, "concurrent_requests": 1}


class LocalFolderProvider(KifuProvider):
    """Provider for local folder scanning"""
    
    def __init__(self, folder_path: str):
        super().__init__("local_folder")
        self.folder_path = folder_path
    
    def search(self, query: Dict[str, Any]) -> List[KifuInfo]:
        """Search local files based on query"""
        from ..kifu_loader import scan_kifu_directory
        import os
        from pathlib import Path
        
        if not os.path.exists(self.folder_path):
            return []
        
        files = scan_kifu_directory(self.folder_path, recursive=True)
        results = []
        
        limit = query.get("limit", 100)
        player_filter = query.get("player", "").lower() if query.get("player") else None
        
        for file_path in files[:limit]:
            file_info = Path(file_path)
            
            # Basic filtering by filename if player specified
            if player_filter and player_filter not in file_info.name.lower():
                continue
            
            kifu_info = KifuInfo(
                id=file_path,
                source=self.name,
                title=file_info.stem,
                metadata={"file_path": file_path, "file_size": file_info.stat().st_size}
            )
            results.append(kifu_info)
        
        return results
    
    def fetch(self, game_id: str) -> Optional[KifuContent]:
        """Load complete file content"""
        from ..kifu_loader import load_kifu_file
        import os
        
        try:
            if not os.path.exists(game_id):  # game_id is file path
                return None
            
            kifu_data = load_kifu_file(game_id)
            
            kifu_info = KifuInfo(
                id=game_id,
                source=self.name,
                title=kifu_data.metadata.title or os.path.basename(game_id),
                sente=kifu_data.metadata.sente,
                gote=kifu_data.metadata.gote,
                result=kifu_data.metadata.result,
                time_rules=kifu_data.metadata.time_rules,
                metadata={"file_path": game_id}
            )
            
            return KifuContent(
                info=kifu_info,
                usi_moves=kifu_data.usi_moves,
                start_sfen=kifu_data.start_sfen
            )
            
        except Exception as e:
            print(f"Error loading file {game_id}: {e}")
            return None
    
    def is_available(self) -> bool:
        """Check if folder exists"""
        import os
        return os.path.exists(self.folder_path)


def get_provider_registry() -> Dict[str, type]:
    """Get registry of available provider classes"""
    return {
        "local_folder": LocalFolderProvider,
        "shogi_wars": None,  # Will be imported dynamically when needed
    }