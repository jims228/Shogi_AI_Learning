"""
ingest.py

API router for Kifu ingestion and batch annotation.
Provides endpoints for folder and single file processing.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, Dict, Any
import os

from ..services.annotate_batch import BatchAnnotationService, AnnotationRequest
from ..ingest.providers.base import LocalFolderProvider


# Request/Response models
class FolderAnnotateRequest(BaseModel):
    dir: Optional[str] = None  # Directory to process (defaults to KIFU_DIR)
    recursive: bool = True
    byoyomi_ms: Optional[int] = None
    skip_validation: bool = False


class FileAnnotateRequest(BaseModel):
    path: str  # File path to process
    output_path: Optional[str] = None
    byoyomi_ms: Optional[int] = None
    skip_validation: bool = False


class AnnotationSummaryResponse(BaseModel):
    success: bool
    scanned: int
    annotated: int
    errors: int
    skipped: int
    total_time_ms: int
    output_dir: str
    error_details: Optional[list] = None


class FileAnnotationResponse(BaseModel):
    success: bool
    file_path: str
    output_path: Optional[str] = None
    move_count: int = 0
    annotation_count: int = 0
    error_message: Optional[str] = None
    processing_time_ms: Optional[int] = None


class FolderStatsResponse(BaseModel):
    exists: bool
    folder_path: str
    total_files: int
    by_extension: Dict[str, int]
    total_size_mb: float
    sample_files: list


# Router setup
router = APIRouter(prefix="/ingest", tags=["ingest"])


@router.post("/annotate/folder", response_model=AnnotationSummaryResponse)
async def annotate_folder(request: FolderAnnotateRequest):
    """
    Batch annotate all Kifu files in a folder.
    
    Scans the specified directory (or KIFU_DIR) for .kif/.csa/.usi files,
    processes each through the annotation engine, and saves JSON results.
    """
    try:
        service = BatchAnnotationService()
        
        # Process folder
        summary = service.annotate_folder(
            folder_path=request.dir,
            recursive=request.recursive,
            byoyomi_ms=request.byoyomi_ms,
            skip_validation=request.skip_validation
        )
        
        return AnnotationSummaryResponse(
            success=summary.errors == 0,
            scanned=summary.scanned,
            annotated=summary.annotated,
            errors=summary.errors,
            skipped=summary.skipped,
            total_time_ms=summary.total_time_ms,
            output_dir=service.kifu_out,
            error_details=summary.error_details if summary.errors > 0 else None
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Folder annotation failed: {str(e)}")


@router.post("/annotate/file", response_model=FileAnnotationResponse)
async def annotate_file(request: FileAnnotateRequest):
    """
    Annotate a single Kifu file.
    
    Processes the specified file through the annotation engine and
    saves the JSON result to the output path or default location.
    """
    try:
        service = BatchAnnotationService()
        
        # Validate file exists
        if not os.path.exists(request.path):
            raise HTTPException(status_code=404, detail=f"File not found: {request.path}")
        
        # Generate output path if not specified
        output_path = request.output_path
        if not output_path:
            rel_path = os.path.relpath(request.path, service.kifu_dir)
            output_path = os.path.join(service.kifu_out,
                                     os.path.splitext(rel_path)[0] + ".json")
        
        # Create annotation request
        annotation_request = AnnotationRequest(
            file_path=request.path,
            output_path=output_path,
            byoyomi_ms=request.byoyomi_ms,
            skip_validation=request.skip_validation
        )
        
        # Process file
        result = service.annotate_single_file(annotation_request)
        
        return FileAnnotationResponse(
            success=result.success,
            file_path=result.file_path,
            output_path=result.output_path,
            move_count=result.move_count,
            annotation_count=result.annotation_count,
            error_message=result.error_message,
            processing_time_ms=result.processing_time_ms
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File annotation failed: {str(e)}")


@router.get("/folder/stats", response_model=FolderStatsResponse)
async def get_folder_stats(dir: Optional[str] = None):
    """
    Get statistics about a Kifu folder without processing files.
    
    Returns file counts, sizes, and format distribution for planning
    batch operations.
    """
    try:
        service = BatchAnnotationService()
        stats = service.get_folder_stats(dir)
        
        return FolderStatsResponse(
            exists=stats["exists"],
            folder_path=stats.get("folder_path", dir or service.kifu_dir),
            total_files=stats["total_files"],
            by_extension=stats["by_extension"],
            total_size_mb=stats["total_size_mb"],
            sample_files=stats.get("sample_files", [])
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stats retrieval failed: {str(e)}")


@router.get("/providers")
async def get_available_providers():
    """
    List available Kifu providers and their status.
    
    Returns information about local folder and Shogi Wars providers.
    """
    try:
        service = BatchAnnotationService()
        
        # Check local provider
        local_provider = LocalFolderProvider(service.kifu_dir)
        local_available = local_provider.is_available()
        
        # Check Shogi Wars provider
        from ..ingest.providers.shogi_wars import ShogiWarsProvider
        wars_provider = ShogiWarsProvider()
        wars_available = wars_provider.is_available()
        
        return {
            "providers": {
                "local_folder": {
                    "name": "Local Folder",
                    "available": local_available,
                    "folder": service.kifu_dir,
                    "description": "Scan local filesystem for Kifu files"
                },
                "shogi_wars": {
                    "name": "Shogi Wars (Export)",
                    "available": wars_available,
                    "folder": wars_provider.exported_folder,
                    "description": "Process manually exported Shogi Wars files"
                }
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Provider check failed: {str(e)}")


@router.post("/setup/folders")
async def setup_folders():
    """
    Create necessary folder structure for Kifu ingestion.
    
    Sets up KIFU_DIR and KIFU_OUT directories with proper permissions.
    """
    try:
        service = BatchAnnotationService()
        
        # Create folders
        folders_created = []
        
        if not os.path.exists(service.kifu_dir):
            os.makedirs(service.kifu_dir, exist_ok=True)
            folders_created.append(service.kifu_dir)
        
        if not os.path.exists(service.kifu_out):
            os.makedirs(service.kifu_out, exist_ok=True)
            folders_created.append(service.kifu_out)
        
        # Create Shogi Wars export folder
        from ..ingest.providers.shogi_wars import ShogiWarsProvider
        wars_folder = ShogiWarsProvider.create_export_folder()
        if wars_folder not in folders_created:
            folders_created.append(wars_folder)
        
        return {
            "success": True,
            "folders_created": folders_created,
            "kifu_dir": service.kifu_dir,
            "kifu_out": service.kifu_out,
            "shogi_wars_export": wars_folder
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Folder setup failed: {str(e)}")


# Background task support for large batch operations
@router.post("/annotate/folder/async")
async def annotate_folder_async(request: FolderAnnotateRequest, background_tasks: BackgroundTasks):
    """
    Start folder annotation as a background task.
    
    Returns immediately with a task ID. Use /status/{task_id} to check progress.
    """
    # TODO: Implement background task tracking
    # For now, redirect to synchronous version
    return await annotate_folder(request)


@router.get("/status/{task_id}")
async def get_task_status(task_id: str):
    """
    Get status of background annotation task.
    
    TODO: Implement task tracking system.
    """
    # Placeholder for future background task system
    raise HTTPException(status_code=501, detail="Background tasks not yet implemented")