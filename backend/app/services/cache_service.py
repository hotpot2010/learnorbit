"""
Video analysis result cache service
"""
import os
import json
import hashlib
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from pathlib import Path


class CacheService:
    """Service for caching video analysis results"""
    
    def __init__(self, cache_dir: str = "cache"):
        """
        Initialize cache service
        
        Args:
            cache_dir: Directory to store cache files
        """
        self.cache_dir = cache_dir
        os.makedirs(cache_dir, exist_ok=True)
        
        # 创建索引文件
        self.index_file = os.path.join(cache_dir, "cache_index.json")
        self._init_index()
    
    def _init_index(self):
        """Initialize cache index file"""
        if not os.path.exists(self.index_file):
            self._save_index({})
    
    def _load_index(self) -> Dict[str, Any]:
        """Load cache index"""
        try:
            with open(self.index_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return {}
    
    def _save_index(self, index: Dict[str, Any]):
        """Save cache index"""
        with open(self.index_file, 'w', encoding='utf-8') as f:
            json.dump(index, f, ensure_ascii=False, indent=2)
    
    def _generate_cache_key(self, video_url: str, prompt: str = "") -> str:
        """
        Generate cache key from video URL and prompt
        
        Args:
            video_url: Video URL
            prompt: Analysis prompt (empty for ASR-only cache)
            
        Returns:
            Cache key (MD5 hash)
        """
        # 组合 URL 和 Prompt
        combined = f"{video_url}||{prompt}"
        
        # 生成 MD5 哈希
        hash_obj = hashlib.md5(combined.encode('utf-8'))
        return hash_obj.hexdigest()
    
    def _generate_asr_cache_key(self, video_url: str) -> str:
        """
        Generate ASR cache key from video URL only
        
        Args:
            video_url: Video URL
            
        Returns:
            ASR cache key (MD5 hash)
        """
        # ASR 结果只与视频相关，不依赖 prompt
        hash_obj = hashlib.md5(f"asr::{video_url}".encode('utf-8'))
        return hash_obj.hexdigest()
    
    def get(
        self, 
        video_url: str, 
        prompt: str,
        max_age_hours: Optional[int] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Get cached analysis result
        
        Args:
            video_url: Video URL
            prompt: Analysis prompt
            max_age_hours: Maximum age in hours (None = no expiry)
            
        Returns:
            Cached result or None if not found/expired
        """
        cache_key = self._generate_cache_key(video_url, prompt)
        cache_file = os.path.join(self.cache_dir, f"{cache_key}.json")
        
        # 检查文件是否存在
        if not os.path.exists(cache_file):
            return None
        
        try:
            # 读取缓存文件
            with open(cache_file, 'r', encoding='utf-8') as f:
                cached_data = json.load(f)
            
            # 检查是否过期
            if max_age_hours is not None:
                cached_time = datetime.fromisoformat(cached_data['cached_at'])
                age = datetime.now() - cached_time
                
                if age > timedelta(hours=max_age_hours):
                    print(f"🕐 Cache expired (age: {age.total_seconds() / 3600:.1f}h)")
                    return None
            
            print(f"✅ Cache hit: {cache_key[:8]}...")
            return cached_data['result']
            
        except Exception as e:
            print(f"⚠️ Failed to read cache: {e}")
            return None
    
    def set(
        self, 
        video_url: str, 
        prompt: str, 
        result: Dict[str, Any],
        metadata: Optional[Dict[str, Any]] = None
    ):
        """
        Save analysis result to cache
        
        Args:
            video_url: Video URL
            prompt: Analysis prompt
            result: Analysis result
            metadata: Optional metadata (video info, etc.)
        """
        cache_key = self._generate_cache_key(video_url, prompt)
        cache_file = os.path.join(self.cache_dir, f"{cache_key}.json")
        
        cache_data = {
            'cache_key': cache_key,
            'video_url': video_url,
            'prompt': prompt[:100] + '...' if len(prompt) > 100 else prompt,  # 截断长 Prompt
            'result': result,
            'metadata': metadata or {},
            'cached_at': datetime.now().isoformat(),
        }
        
        try:
            # 保存缓存文件
            with open(cache_file, 'w', encoding='utf-8') as f:
                json.dump(cache_data, f, ensure_ascii=False, indent=2)
            
            # 更新索引
            index = self._load_index()
            index[cache_key] = {
                'video_url': video_url,
                'cached_at': cache_data['cached_at'],
                'file': cache_file,
            }
            self._save_index(index)
            
            print(f"💾 Cached result: {cache_key[:8]}...")
            
        except Exception as e:
            print(f"⚠️ Failed to save cache: {e}")
    
    def delete(self, video_url: str, prompt: str) -> bool:
        """
        Delete cached result
        
        Args:
            video_url: Video URL
            prompt: Analysis prompt
            
        Returns:
            True if deleted, False if not found
        """
        cache_key = self._generate_cache_key(video_url, prompt)
        cache_file = os.path.join(self.cache_dir, f"{cache_key}.json")
        
        if os.path.exists(cache_file):
            os.remove(cache_file)
            
            # 更新索引
            index = self._load_index()
            if cache_key in index:
                del index[cache_key]
                self._save_index(index)
            
            print(f"🗑️ Deleted cache: {cache_key[:8]}...")
            return True
        
        return False
    
    def clear_expired(self, max_age_hours: int = 24) -> int:
        """
        Clear expired cache entries
        
        Args:
            max_age_hours: Maximum age in hours
            
        Returns:
            Number of entries cleared
        """
        index = self._load_index()
        cleared = 0
        cutoff_time = datetime.now() - timedelta(hours=max_age_hours)
        
        keys_to_delete = []
        
        for cache_key, entry in index.items():
            try:
                cached_time = datetime.fromisoformat(entry['cached_at'])
                
                if cached_time < cutoff_time:
                    cache_file = entry['file']
                    if os.path.exists(cache_file):
                        os.remove(cache_file)
                    keys_to_delete.append(cache_key)
                    cleared += 1
                    
            except Exception as e:
                print(f"⚠️ Failed to process cache entry: {e}")
        
        # 更新索引
        for key in keys_to_delete:
            del index[key]
        
        self._save_index(index)
        
        print(f"🗑️ Cleared {cleared} expired cache entries (older than {max_age_hours}h)")
        return cleared
    
    def clear_all(self) -> int:
        """
        Clear all cache entries
        
        Returns:
            Number of entries cleared
        """
        index = self._load_index()
        cleared = 0
        
        for cache_key, entry in index.items():
            cache_file = entry['file']
            if os.path.exists(cache_file):
                os.remove(cache_file)
                cleared += 1
        
        # 重置索引
        self._save_index({})
        
        print(f"🗑️ Cleared all {cleared} cache entries")
        return cleared
    
    def get_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics
        
        Returns:
            Statistics dictionary
        """
        index = self._load_index()
        
        total_size = 0
        oldest_entry = None
        newest_entry = None
        
        for entry in index.values():
            cache_file = entry['file']
            if os.path.exists(cache_file):
                total_size += os.path.getsize(cache_file)
                
                cached_time = datetime.fromisoformat(entry['cached_at'])
                
                if oldest_entry is None or cached_time < oldest_entry:
                    oldest_entry = cached_time
                
                if newest_entry is None or cached_time > newest_entry:
                    newest_entry = cached_time
        
        return {
            'total_entries': len(index),
            'total_size_mb': total_size / 1024 / 1024,
            'oldest_entry': oldest_entry.isoformat() if oldest_entry else None,
            'newest_entry': newest_entry.isoformat() if newest_entry else None,
            'cache_dir': self.cache_dir,
        }
    
    def list_cached_videos(self) -> List[Dict[str, Any]]:
        """
        List all cached videos
        
        Returns:
            List of cached video entries
        """
        index = self._load_index()
        
        entries = []
        for cache_key, entry in index.items():
            cache_file = entry['file']
            
            if os.path.exists(cache_file):
                file_size = os.path.getsize(cache_file)
                
                entries.append({
                    'cache_key': cache_key,
                    'video_url': entry['video_url'],
                    'cached_at': entry['cached_at'],
                    'file_size_kb': file_size / 1024,
                })
        
        # 按时间排序（最新的在前）
        entries.sort(key=lambda x: x['cached_at'], reverse=True)
        
        return entries
    
    def get_asr_transcript(
        self,
        video_url: str,
        max_age_hours: Optional[int] = None
    ) -> Optional[str]:
        """
        Get cached ASR transcript
        
        Args:
            video_url: Video URL
            max_age_hours: Maximum age in hours (None = no expiry)
            
        Returns:
            Cached transcript or None if not found/expired
        """
        cache_key = self._generate_asr_cache_key(video_url)
        cache_file = os.path.join(self.cache_dir, f"asr_{cache_key}.json")
        
        if not os.path.exists(cache_file):
            return None
        
        try:
            with open(cache_file, 'r', encoding='utf-8') as f:
                cached_data = json.load(f)
            
            # 检查是否过期
            if max_age_hours is not None:
                cached_time = datetime.fromisoformat(cached_data['cached_at'])
                age = datetime.now() - cached_time
                
                if age > timedelta(hours=max_age_hours):
                    print(f"🕐 ASR cache expired (age: {age.total_seconds() / 3600:.1f}h)")
                    return None
            
            print(f"✅ ASR cache hit: {cache_key[:8]}... ({len(cached_data['transcript'])} chars)")
            return cached_data['transcript']
            
        except Exception as e:
            print(f"⚠️ Failed to read ASR cache: {e}")
            return None
    
    def set_asr_transcript(
        self,
        video_url: str,
        transcript: str,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """
        Save ASR transcript to cache
        
        Args:
            video_url: Video URL
            transcript: ASR transcript
            metadata: Optional metadata (video info, ASR task ID, etc.)
        """
        cache_key = self._generate_asr_cache_key(video_url)
        cache_file = os.path.join(self.cache_dir, f"asr_{cache_key}.json")
        
        cache_data = {
            'cache_key': cache_key,
            'cache_type': 'asr_transcript',
            'video_url': video_url,
            'transcript': transcript,
            'transcript_length': len(transcript),
            'metadata': metadata or {},
            'cached_at': datetime.now().isoformat(),
        }
        
        try:
            with open(cache_file, 'w', encoding='utf-8') as f:
                json.dump(cache_data, f, ensure_ascii=False, indent=2)
            
            # 更新索引
            index = self._load_index()
            index[f"asr_{cache_key}"] = {
                'type': 'asr',
                'video_url': video_url,
                'cached_at': cache_data['cached_at'],
                'file': cache_file,
            }
            self._save_index(index)
            
            print(f"💾 ASR cached: {cache_key[:8]}... ({len(transcript)} chars)")
            
        except Exception as e:
            print(f"⚠️ Failed to save ASR cache: {e}")


