"""
File cleanup service for temporary downloads
"""
import os
import time
from pathlib import Path
from typing import List, Dict, Any
import threading


class FileCleanupService:
    """Service for managing and cleaning up temporary downloaded files"""
    
    def __init__(self, downloads_dir: str = None, max_age_hours: int = 24):
        """
        Initialize cleanup service
        
        Args:
            downloads_dir: Directory containing temporary files
            max_age_hours: Maximum age of files before cleanup (in hours)
        """
        if downloads_dir is None:
            backend_dir = Path(__file__).parent.parent.parent
            downloads_dir = backend_dir / 'downloads'
        
        self.downloads_dir = str(downloads_dir)
        self.max_age_seconds = max_age_hours * 3600
        
        print(f"🧹 File cleanup service initialized")
        print(f"📁 Downloads directory: {self.downloads_dir}")
        print(f"⏰ Max file age: {max_age_hours} hours")
    
    def cleanup_old_files(self, dry_run: bool = False) -> Dict[str, Any]:
        """
        Clean up old files in downloads directory
        
        Args:
            dry_run: If True, only report what would be deleted
            
        Returns:
            Dictionary with cleanup statistics
        """
        if not os.path.exists(self.downloads_dir):
            return {
                'success': True,
                'deleted_count': 0,
                'freed_space_mb': 0,
                'message': 'Downloads directory does not exist'
            }
        
        current_time = time.time()
        deleted_files = []
        total_size = 0
        errors = []
        
        try:
            for filename in os.listdir(self.downloads_dir):
                # 跳过 .gitkeep
                if filename == '.gitkeep':
                    continue
                
                filepath = os.path.join(self.downloads_dir, filename)
                
                # 只处理文件，不处理目录
                if not os.path.isfile(filepath):
                    continue
                
                # 检查文件年龄
                file_age = current_time - os.path.getmtime(filepath)
                
                if file_age > self.max_age_seconds:
                    file_size = os.path.getsize(filepath)
                    
                    if dry_run:
                        print(f"🗑️  Would delete: {filename} ({file_size / 1024 / 1024:.2f} MB, age: {file_age / 3600:.1f}h)")
                        deleted_files.append(filename)
                        total_size += file_size
                    else:
                        try:
                            os.remove(filepath)
                            print(f"🗑️  Deleted: {filename} ({file_size / 1024 / 1024:.2f} MB)")
                            deleted_files.append(filename)
                            total_size += file_size
                        except Exception as e:
                            error_msg = f"Failed to delete {filename}: {str(e)}"
                            print(f"⚠️  {error_msg}")
                            errors.append(error_msg)
            
            return {
                'success': True,
                'deleted_count': len(deleted_files),
                'deleted_files': deleted_files,
                'freed_space_mb': total_size / 1024 / 1024,
                'errors': errors,
                'dry_run': dry_run
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def cleanup_file(self, filepath: str) -> bool:
        """
        Clean up a specific file
        
        Args:
            filepath: Path to the file to delete
            
        Returns:
            True if successful, False otherwise
        """
        try:
            if os.path.exists(filepath):
                os.remove(filepath)
                print(f"🗑️  Deleted: {filepath}")
                return True
            return False
        except Exception as e:
            print(f"⚠️  Failed to delete {filepath}: {str(e)}")
            return False
    
    def schedule_cleanup(self, filepath: str, delay_seconds: int = 300):
        """
        Schedule a file for cleanup after a delay
        
        Args:
            filepath: Path to the file to delete
            delay_seconds: Delay before deletion (default 5 minutes)
        """
        def delayed_cleanup():
            time.sleep(delay_seconds)
            self.cleanup_file(filepath)
        
        thread = threading.Thread(target=delayed_cleanup, daemon=True)
        thread.start()
        print(f"⏰ Scheduled cleanup for {filepath} in {delay_seconds}s")
    
    def get_directory_stats(self) -> Dict[str, Any]:
        """
        Get statistics about the downloads directory
        
        Returns:
            Dictionary with directory statistics
        """
        if not os.path.exists(self.downloads_dir):
            return {
                'exists': False,
                'total_files': 0,
                'total_size_mb': 0
            }
        
        total_files = 0
        total_size = 0
        file_types = {}
        
        for filename in os.listdir(self.downloads_dir):
            if filename == '.gitkeep':
                continue
            
            filepath = os.path.join(self.downloads_dir, filename)
            
            if os.path.isfile(filepath):
                total_files += 1
                file_size = os.path.getsize(filepath)
                total_size += file_size
                
                # 统计文件类型
                ext = os.path.splitext(filename)[1].lower()
                if ext:
                    file_types[ext] = file_types.get(ext, 0) + 1
        
        return {
            'exists': True,
            'total_files': total_files,
            'total_size_mb': total_size / 1024 / 1024,
            'file_types': file_types,
            'directory': self.downloads_dir
        }


# Global instance
cleanup_service = FileCleanupService()

