"""
File handling utilities
"""
import os
import mimetypes
from typing import Set
from fastapi import UploadFile, HTTPException

# Supported video file extensions
SUPPORTED_VIDEO_EXTENSIONS: Set[str] = {
    '.mp4', '.avi', '.mov', '.mkv', '.webm', 
    '.flv', '.wmv', '.m4v', '.3gp', '.ogv'
}

# Supported video MIME types
SUPPORTED_VIDEO_MIMES: Set[str] = {
    'video/mp4', 'video/avi', 'video/quicktime', 
    'video/x-msvideo', 'video/webm', 'video/x-flv',
    'video/x-ms-wmv', 'video/x-m4v', 'video/3gpp',
    'video/ogg', 'video/x-matroska'
}

def validate_video_file(file: UploadFile) -> None:
    """
    Validate uploaded video file
    
    Args:
        file: Uploaded file object
        
    Raises:
        HTTPException: If file is invalid
    """
    # Check if file exists
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    # Check file extension
    file_extension = os.path.splitext(file.filename.lower())[1]
    if file_extension not in SUPPORTED_VIDEO_EXTENSIONS:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file type. Supported: {', '.join(SUPPORTED_VIDEO_EXTENSIONS)}"
        )
    
    # Check MIME type if available
    if file.content_type and file.content_type not in SUPPORTED_VIDEO_MIMES:
        # Try to guess MIME type from filename
        guessed_type, _ = mimetypes.guess_type(file.filename)
        if guessed_type and guessed_type not in SUPPORTED_VIDEO_MIMES:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported MIME type: {file.content_type}"
            )
    
    print(f"✅ File validation passed: {file.filename}")

def cleanup_temp_file(file_path: str) -> None:
    """
    Clean up temporary file
    
    Args:
        file_path: Path to temporary file
    """
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
            print(f"🗑️ Cleaned up temp file: {file_path}")
    except Exception as e:
        print(f"⚠️ Failed to cleanup temp file {file_path}: {e}")

def get_file_size(file_path: str) -> int:
    """
    Get file size in bytes
    
    Args:
        file_path: Path to file
        
    Returns:
        File size in bytes
    """
    try:
        return os.path.getsize(file_path)
    except OSError:
        return 0

def ensure_directory_exists(directory: str) -> None:
    """
    Ensure directory exists, create if not
    
    Args:
        directory: Directory path
    """
    os.makedirs(directory, exist_ok=True)
