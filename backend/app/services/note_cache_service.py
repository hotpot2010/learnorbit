"""
笔记缓存服务
用于缓存LLM生成的笔记内容（不包括截图）
"""
import os
import json
import hashlib
from datetime import datetime
from typing import Optional, Dict, Any


class NoteCacheService:
    """笔记缓存服务类"""
    
    def __init__(self, cache_dir: str = "cache/notes"):
        """
        初始化笔记缓存服务
        
        Args:
            cache_dir: 缓存目录路径
        """
        self.cache_dir = cache_dir
        os.makedirs(cache_dir, exist_ok=True)
        print(f"📝 Note cache service initialized: {cache_dir}")
    
    def _generate_cache_key(self, video_url: str, knowledge_point_name: str) -> str:
        """
        生成缓存键
        
        Args:
            video_url: 视频URL
            knowledge_point_name: 知识点名称
            
        Returns:
            缓存键（MD5哈希）
        """
        # 组合视频URL和知识点名称作为唯一标识
        cache_string = f"{video_url}::{knowledge_point_name}"
        hash_obj = hashlib.md5(cache_string.encode('utf-8'))
        return hash_obj.hexdigest()
    
    def get_cached_note(
        self,
        video_url: str,
        knowledge_point_name: str,
        max_age_hours: Optional[int] = None
    ) -> Optional[str]:
        """
        获取缓存的笔记
        
        Args:
            video_url: 视频URL
            knowledge_point_name: 知识点名称
            max_age_hours: 最大缓存时间（小时），None表示不限制
            
        Returns:
            缓存的笔记内容，如果没有缓存或已过期则返回None
        """
        cache_key = self._generate_cache_key(video_url, knowledge_point_name)
        cache_file = os.path.join(self.cache_dir, f"note_{cache_key}.json")
        
        if not os.path.exists(cache_file):
            print(f"⚠️ Note cache miss: {cache_key}")
            return None
        
        try:
            with open(cache_file, 'r', encoding='utf-8') as f:
                cache_data = json.load(f)
            
            # 检查缓存是否过期
            if max_age_hours is not None:
                cached_at = datetime.fromisoformat(cache_data['cached_at'])
                age_hours = (datetime.now() - cached_at).total_seconds() / 3600
                
                if age_hours > max_age_hours:
                    print(f"⚠️ Note cache expired: {cache_key} (age: {age_hours:.1f}h)")
                    return None
            
            print(f"✅ Note cache hit: {cache_key}")
            print(f"📝 Note length: {len(cache_data['note'])} chars")
            
            return cache_data['note']
            
        except Exception as e:
            print(f"❌ Error reading note cache: {e}")
            return None
    
    def set_cached_note(
        self,
        video_url: str,
        knowledge_point_name: str,
        note: str,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """
        缓存笔记
        
        Args:
            video_url: 视频URL
            knowledge_point_name: 知识点名称
            note: 笔记内容
            metadata: 额外的元数据
        """
        cache_key = self._generate_cache_key(video_url, knowledge_point_name)
        cache_file = os.path.join(self.cache_dir, f"note_{cache_key}.json")
        
        cache_data = {
            'cache_key': cache_key,
            'video_url': video_url,
            'knowledge_point_name': knowledge_point_name,
            'note': note,
            'note_length': len(note),
            'cached_at': datetime.now().isoformat(),
            'metadata': metadata or {}
        }
        
        try:
            with open(cache_file, 'w', encoding='utf-8') as f:
                json.dump(cache_data, f, ensure_ascii=False, indent=2)
            
            print(f"✅ Note cached: {cache_key}")
            print(f"📝 Video: {video_url}")
            print(f"🎯 Knowledge point: {knowledge_point_name}")
            print(f"💾 Cache file: {cache_file}")
            
        except Exception as e:
            print(f"❌ Error caching note: {e}")
    
    def clear_cache(self, video_url: Optional[str] = None):
        """
        清除缓存
        
        Args:
            video_url: 如果指定，只清除该视频的缓存；否则清除所有
        """
        if video_url is None:
            # 清除所有缓存
            import glob
            cache_files = glob.glob(os.path.join(self.cache_dir, "note_*.json"))
            for cache_file in cache_files:
                try:
                    os.remove(cache_file)
                    print(f"🗑️ Removed cache: {cache_file}")
                except Exception as e:
                    print(f"❌ Error removing cache: {e}")
        else:
            # 清除特定视频的缓存
            import glob
            cache_files = glob.glob(os.path.join(self.cache_dir, "note_*.json"))
            
            for cache_file in cache_files:
                try:
                    with open(cache_file, 'r', encoding='utf-8') as f:
                        cache_data = json.load(f)
                    
                    if cache_data.get('video_url') == video_url:
                        os.remove(cache_file)
                        print(f"🗑️ Removed cache for video: {cache_file}")
                        
                except Exception as e:
                    print(f"❌ Error processing cache file: {e}")
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """
        获取缓存统计信息
        
        Returns:
            缓存统计信息字典
        """
        import glob
        
        cache_files = glob.glob(os.path.join(self.cache_dir, "note_*.json"))
        total_size = sum(os.path.getsize(f) for f in cache_files)
        
        stats = {
            'total_notes': len(cache_files),
            'total_size_bytes': total_size,
            'total_size_mb': total_size / (1024 * 1024),
            'cache_dir': self.cache_dir
        }
        
        print(f"📊 Note cache stats:")
        print(f"  - Total notes: {stats['total_notes']}")
        print(f"  - Total size: {stats['total_size_mb']:.2f} MB")
        
        return stats

