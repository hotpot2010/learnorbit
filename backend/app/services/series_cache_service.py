"""
Series information cache service
"""
import os
import json
import hashlib
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from pathlib import Path


class SeriesCacheService:
    """Service for caching series (video playlist) information"""
    
    def __init__(self, cache_dir: str = "cache/series"):
        """
        Initialize series cache service
        
        Args:
            cache_dir: Directory to store series cache files
        """
        self.cache_dir = cache_dir
        os.makedirs(cache_dir, exist_ok=True)
        
        # Index file for tracking all cached series
        self.index_file = os.path.join(self.cache_dir, "series_index.json")
        self._load_index()
    
    def _load_index(self):
        """Load cache index"""
        if os.path.exists(self.index_file):
            try:
                with open(self.index_file, 'r', encoding='utf-8') as f:
                    self.index = json.load(f)
            except Exception as e:
                print(f"⚠️  Failed to load series cache index: {e}")
                self.index = {}
        else:
            self.index = {}
    
    def _save_index(self):
        """Save cache index"""
        try:
            with open(self.index_file, 'w', encoding='utf-8') as f:
                json.dump(self.index, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"⚠️  Failed to save series cache index: {e}")
    
    def _generate_cache_key(self, video_url: str) -> str:
        """
        Generate cache key from video URL (without ?p= parameter)
        
        Args:
            video_url: Video URL
            
        Returns:
            Cache key (hash)
        """
        # 移除 ?p= 参数，因为序列信息与具体的P无关
        base_url = video_url.split('?')[0] if '?' in video_url else video_url
        
        # 提取BV号或AV号
        if 'BV' in base_url:
            # BV号格式: https://www.bilibili.com/video/BV1P24y1m7LA
            bv_id = base_url.split('BV')[1].split('/')[0].split('?')[0]
            cache_key = f"series_{bv_id}"
            print(f"🔑 Generated cache key from BV: {cache_key} (URL: {video_url})")
        elif '/av' in base_url or 'video/av' in base_url:
            # AV号格式: http://www.bilibili.com/video/av690173570
            av_match = base_url.split('/av')[-1].split('/')[0].split('?')[0]
            cache_key = f"series_av{av_match}"
            print(f"🔑 Generated cache key from AV: {cache_key} (URL: {video_url})")
        else:
            # 如果既没有BV号也没有AV号，使用URL的hash
            cache_key = f"series_{hashlib.md5(base_url.encode()).hexdigest()[:12]}"
            print(f"🔑 Generated cache key from hash: {cache_key} (URL: {video_url})")
        
        return cache_key
    
    def get_cached_series(
        self, 
        video_url: str, 
        max_age_hours: int = 24 * 7  # 7 days default
    ) -> Optional[Dict[str, Any]]:
        """
        Get cached series information
        
        Args:
            video_url: Video URL
            max_age_hours: Maximum cache age in hours
            
        Returns:
            Cached series info or None if not found/expired
        """
        cache_key = self._generate_cache_key(video_url)
        
        # Check if in index
        if cache_key not in self.index:
            return None
        
        cache_file = os.path.join(self.cache_dir, f"{cache_key}.json")
        
        if not os.path.exists(cache_file):
            # Remove from index if file doesn't exist
            del self.index[cache_key]
            self._save_index()
            return None
        
        # Check age
        try:
            cached_time = datetime.fromisoformat(self.index[cache_key]['cached_at'])
            age = datetime.now() - cached_time
            
            if age > timedelta(hours=max_age_hours):
                print(f"⏰ Series cache expired: {cache_key}")
                return None
            
            # Load cached data
            with open(cache_file, 'r', encoding='utf-8') as f:
                cached_data = json.load(f)
            
            print(f"✅ Series cache hit: {cache_key}")
            return cached_data.get('series_info')
            
        except Exception as e:
            print(f"⚠️  Error reading series cache: {e}")
            return None
    
    def set_cached_series(
        self, 
        video_url: str, 
        series_info: Dict[str, Any]
    ):
        """
        Cache series information
        
        Args:
            video_url: Video URL
            series_info: Series information from extract_video_info
        """
        cache_key = self._generate_cache_key(video_url)
        cache_file = os.path.join(self.cache_dir, f"{cache_key}.json")
        
        # Prepare cache data
        cache_data = {
            'cache_key': cache_key,
            'video_url': video_url.split('?')[0],  # 只保存基础URL
            'series_info': series_info,
            'cached_at': datetime.now().isoformat()
        }
        
        try:
            # Save cache file
            with open(cache_file, 'w', encoding='utf-8') as f:
                json.dump(cache_data, f, ensure_ascii=False, indent=2)
            
            # Update index
            self.index[cache_key] = {
                'bv_id': series_info.get('bv_id', ''),
                'title': series_info.get('title', ''),
                'is_series': series_info.get('is_series', False),
                'total_parts': series_info.get('total_parts', 1),
                'cached_at': cache_data['cached_at']
            }
            self._save_index()
            
            print(f"💾 Series cached: {cache_key} ({series_info.get('title', 'Unknown')[:50]}...)")
            
        except Exception as e:
            print(f"⚠️  Failed to cache series: {e}")
    
    def clear_cache(self):
        """Clear all series cache"""
        cleared = 0
        
        for cache_key in list(self.index.keys()):
            cache_file = os.path.join(self.cache_dir, f"{cache_key}.json")
            try:
                if os.path.exists(cache_file):
                    os.remove(cache_file)
                    cleared += 1
            except Exception as e:
                print(f"⚠️  Failed to delete {cache_file}: {e}")
        
        # Clear index
        self.index = {}
        self._save_index()
        
        print(f"🗑️  Cleared {cleared} series cache entries")
        return cleared
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        return {
            'total_cached': len(self.index),
            'cache_dir': self.cache_dir,
            'index_file': self.index_file
        }

