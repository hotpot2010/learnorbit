#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
练习题缓存服务
用于缓存已生成的练习题，避免重复生成
"""

import os
import json
import hashlib
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict, Any


class ExerciseCacheService:
    """练习题缓存服务"""
    
    def __init__(self, cache_dir: str = "cache/exercises"):
        """
        初始化缓存服务
        
        Args:
            cache_dir: 缓存目录路径
        """
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.index_file = self.cache_dir / "exercise_index.json"
        self._load_index()
    
    def _load_index(self):
        """加载缓存索引"""
        if self.index_file.exists():
            try:
                with open(self.index_file, 'r', encoding='utf-8') as f:
                    self.index = json.load(f)
            except Exception as e:
                print(f"⚠️ 加载练习缓存索引失败: {e}")
                self.index = {}
        else:
            self.index = {}
    
    def _save_index(self):
        """保存缓存索引"""
        try:
            with open(self.index_file, 'w', encoding='utf-8') as f:
                json.dump(self.index, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"⚠️ 保存练习缓存索引失败: {e}")
    
    def _generate_cache_key(self, video_url: str, knowledge_point_name: str) -> str:
        """
        生成缓存键
        
        Args:
            video_url: 视频URL
            knowledge_point_name: 知识点名称
            
        Returns:
            缓存键（MD5哈希）
        """
        content = f"{video_url}|{knowledge_point_name}"
        return hashlib.md5(content.encode('utf-8')).hexdigest()
    
    def get_cached_exercise(
        self, 
        video_url: str, 
        knowledge_point_name: str,
        max_age_hours: int = 24 * 7  # 默认7天
    ) -> Optional[Dict[str, Any]]:
        """
        获取缓存的练习题
        
        Args:
            video_url: 视频URL
            knowledge_point_name: 知识点名称
            max_age_hours: 最大缓存时间（小时）
            
        Returns:
            缓存的练习题数据，如果不存在或过期则返回None
        """
        cache_key = self._generate_cache_key(video_url, knowledge_point_name)
        
        # 检查索引中是否存在
        if cache_key not in self.index:
            print(f"📝 练习缓存未命中: {knowledge_point_name}")
            return None
        
        cache_info = self.index[cache_key]
        cache_file = self.cache_dir / cache_info['file']
        
        # 检查缓存文件是否存在
        if not cache_file.exists():
            print(f"⚠️ 练习缓存文件不存在: {cache_file}")
            del self.index[cache_key]
            self._save_index()
            return None
        
        # 检查缓存是否过期
        cached_time = datetime.fromisoformat(cache_info['timestamp'])
        age = datetime.now() - cached_time
        if age > timedelta(hours=max_age_hours):
            print(f"⏰ 练习缓存已过期: {knowledge_point_name} (age: {age})")
            return None
        
        # 读取缓存数据
        try:
            with open(cache_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            print(f"✅ 练习缓存命中: {knowledge_point_name}")
            print(f"   题型: {data.get('exercise', {}).get('type')}")
            print(f"   缓存时间: {cache_info['timestamp']}")
            
            return data
        except Exception as e:
            print(f"❌ 读取练习缓存失败: {e}")
            return None
    
    def set_cached_exercise(
        self,
        video_url: str,
        knowledge_point_name: str,
        exercise: Dict[str, Any],
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        保存练习题到缓存
        
        Args:
            video_url: 视频URL
            knowledge_point_name: 知识点名称
            exercise: 练习题数据
            metadata: 额外的元数据
            
        Returns:
            是否保存成功
        """
        cache_key = self._generate_cache_key(video_url, knowledge_point_name)
        cache_filename = f"exercise_{cache_key}.json"
        cache_file = self.cache_dir / cache_filename
        
        # 准备缓存数据
        cache_data = {
            "video_url": video_url,
            "knowledge_point_name": knowledge_point_name,
            "exercise": exercise,
            "cached_at": datetime.now().isoformat(),
            "metadata": metadata or {}
        }
        
        try:
            # 保存缓存文件
            with open(cache_file, 'w', encoding='utf-8') as f:
                json.dump(cache_data, f, ensure_ascii=False, indent=2)
            
            # 更新索引
            self.index[cache_key] = {
                "file": cache_filename,
                "video_url": video_url,
                "knowledge_point_name": knowledge_point_name,
                "exercise_type": exercise.get('type'),
                "timestamp": cache_data['cached_at']
            }
            self._save_index()
            
            print(f"💾 练习已缓存: {knowledge_point_name}")
            print(f"   文件: {cache_filename}")
            print(f"   题型: {exercise.get('type')}")
            
            return True
        except Exception as e:
            print(f"❌ 保存练习缓存失败: {e}")
            return False
    
    def clear_cache(self) -> int:
        """
        清除所有缓存
        
        Returns:
            清除的文件数量
        """
        count = 0
        try:
            for file in self.cache_dir.glob("exercise_*.json"):
                file.unlink()
                count += 1
            
            self.index = {}
            self._save_index()
            
            print(f"🗑️ 已清除 {count} 个练习缓存")
            return count
        except Exception as e:
            print(f"❌ 清除练习缓存失败: {e}")
            return count
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """
        获取缓存统计信息
        
        Returns:
            缓存统计数据
        """
        total_size = 0
        exercise_types = {}
        
        for cache_info in self.index.values():
            cache_file = self.cache_dir / cache_info['file']
            if cache_file.exists():
                total_size += cache_file.stat().st_size
                
                exercise_type = cache_info.get('exercise_type', 'unknown')
                exercise_types[exercise_type] = exercise_types.get(exercise_type, 0) + 1
        
        return {
            "total_exercises": len(self.index),
            "total_size_mb": round(total_size / (1024 * 1024), 2),
            "exercise_types": exercise_types,
            "cache_directory": str(self.cache_dir)
        }


# 全局缓存服务实例
exercise_cache_service = ExerciseCacheService()

