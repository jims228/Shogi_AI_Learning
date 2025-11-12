"""
ingest.py

API router stub for Kifu ingestion and batch annotation.
This is a placeholder for future ingestion functionality.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any


# Request/Response models
class FolderAnnotateRequest(BaseModel):
    dir: Optional[str] = None  # Directory to process (defaults to KIFU_DIR)
    recursive: bool = True
    byoyomi_ms: Optional[int] = None
    skip_validation: bool = False


class AnnotationSummaryResponse(BaseModel):
    success: bool
    message: str


# Router setup
router = APIRouter(prefix="/ingest", tags=["ingest"])


@router.post("/annotate/folder", response_model=AnnotationSummaryResponse)
async def annotate_folder(request: FolderAnnotateRequest):
    """
    Batch annotate all Kifu files in a folder.
    
    Currently returns a stub response. Full implementation available
    in feat/kifu-ingestion branch.
    """
    return AnnotationSummaryResponse(
        success=False,
        message="Kifu ingestion functionality is available in feat/kifu-ingestion branch. "
                "Merge that branch to enable batch processing capabilities."
    )


@router.get("/folder/stats")
async def get_folder_stats(dir: Optional[str] = None):
    """
    Get statistics about a Kifu folder.
    
    Currently returns a stub response.
    """
    return {
        "success": False,
        "message": "Kifu ingestion functionality is available in feat/kifu-ingestion branch."
    }


@router.get("/providers")
async def get_available_providers():
    """
    List available Kifu providers.
    
    Currently returns a stub response.
    """
    return {
        "providers": {},
        "message": "Kifu ingestion functionality is available in feat/kifu-ingestion branch."
    }
