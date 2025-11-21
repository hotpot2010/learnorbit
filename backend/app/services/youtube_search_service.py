"""
YouTube视频搜索服务
参考: src_utils_youtube_retrive.py
"""
import os
import asyncio
from typing import List, Dict, Any, Optional
import googleapiclient.discovery
import googleapiclient.errors
import isodate
import math
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

# 安全的打印函数
def safe_print(msg: str):
    """安全的打印，避免 Windows 控制台编码问题"""
    try:
        print(msg)
    except (ValueError, OSError):
        import logging
        logging.info(msg)

class YouTubeSearchService:
    """YouTube视频搜索服务"""
    
    def __init__(self):
        API_KEY = os.getenv("YOUTUBE_API_KEY")
        if not API_KEY:
            safe_print("⚠️ YOUTUBE_API_KEY is not set, YouTube search will be disabled")
            self.youtube = None
            return
        
        api_service_name = "youtube"
        api_version = "v3"
        
        try:
            self.youtube = googleapiclient.discovery.build(
                api_service_name, api_version, developerKey=API_KEY
            )
            safe_print("🔍 YouTubeSearchService initialized")
        except Exception as e:
            safe_print(f"⚠️ Failed to initialize YouTube API: {e}")
            self.youtube = None
    
    async def get_and_format_youtube_videos(
        self, 
        query: str, 
        max_results: int = 10, 
        published_after: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        检索并格式化YouTube视频信息
        
        Args:
            query: 搜索查询字符串
            max_results: 返回的最大结果数
            published_after: RFC 3339格式的字符串（例如："2023-01-01T00:00:00Z"）
                           用于过滤在此日期之后发布的视频。默认为3年前。
        
        Returns:
            包含格式化视频详情的字典列表
        """
        if not self.youtube:
            safe_print("❌ YouTube API not initialized, check YOUTUBE_API_KEY")
            return []
        
        # 如果没有提供published_after，计算默认日期（3年前）
        if published_after is None:
            three_years_ago = datetime.now() - timedelta(days=3*365)  # 大约3年
            published_after = three_years_ago.isoformat("T") + "Z"
        
        # 执行搜索
        try:
            search_request = self.youtube.search().list(
                part="snippet",
                maxResults=max_results,
                q=query,
                type="video",  # 确保只返回视频
                publishedAfter=published_after,
                order="rating"  # 按评分排序
            )
            search_response = await asyncio.to_thread(search_request.execute)
        except Exception as e:
            safe_print(f"❌ [YouTube Search] 获取视频推荐id失败: {e}")
            return []
        
        video_ids = []
        video_details = {}
        
        # 从搜索结果中提取视频ID和初始详情
        for item in search_response.get('items', []):
            if item['id']['kind'] == 'youtube#video':
                video_id = item['id']['videoId']
                video_ids.append(video_id)
                video_details[video_id] = {
                    'video_id': video_id,
                    'title': item['snippet']['title'],
                    'description': item['snippet']['description'],
                    'cover': item['snippet']['thumbnails'].get('high', {}).get('url') or 
                            item['snippet']['thumbnails'].get('default', {}).get('url'),
                    'url': f"https://www.youtube.com/watch?v={video_id}",
                    'author': item['snippet']['channelTitle'],
                    'play': 0,  # YouTube API不直接提供播放量，需要额外调用
                    'is_series': False,  # YouTube单个视频不是系列
                    'video_amount': 1,
                }
        
        if not video_ids:
            return []
        
        # 获取内容详情（包括时长）和统计信息
        try:
            videos_request = self.youtube.videos().list(
                part="contentDetails,statistics",
                id=",".join(video_ids)
            )
            videos_response = await asyncio.to_thread(videos_request.execute)
        except Exception as e:
            safe_print(f"❌ [YouTube Search] 获取视频推荐内容失败: {e}")
            return []
        
        # 添加时长和播放量到视频详情
        for item in videos_response.get('items', []):
            video_id = item.get('id')
            if not video_id or video_id not in video_details:
                continue
            
            # 添加时长（安全访问）
            try:
                content_details = item.get('contentDetails', {})
                duration_iso = content_details.get('duration')
                if duration_iso:
                    duration_seconds = isodate.parse_duration(duration_iso).total_seconds()
                    video_details[video_id]['duration_seconds'] = int(duration_seconds)
                    # 格式化时长
                    hours = math.floor(duration_seconds / 3600)
                    minutes = math.floor((duration_seconds % 3600) / 60)
                    seconds = math.floor(duration_seconds % 60)
                    video_details[video_id]['duration'] = f"{int(hours):02d}:{int(minutes):02d}:{int(seconds):02d}"
                else:
                    video_details[video_id]['duration_seconds'] = 0
                    video_details[video_id]['duration'] = "N/A"
            except Exception as e:
                safe_print(f"⚠️ Error parsing duration for video {video_id}: {e}")
                video_details[video_id]['duration_seconds'] = 0
                video_details[video_id]['duration'] = "N/A"
            
            # 添加播放量
            try:
                statistics = item.get('statistics', {})
                view_count = int(statistics.get('viewCount', 0))
                video_details[video_id]['play'] = view_count
            except (ValueError, KeyError, TypeError):
                video_details[video_id]['play'] = 0
        
        # 确保所有视频都有 duration 和 duration_seconds 字段（即使没有从API获取到）
        for video_id, video_info in video_details.items():
            if 'duration_seconds' not in video_info:
                video_info['duration_seconds'] = 0
            if 'duration' not in video_info:
                video_info['duration'] = "N/A"
        
        # 将字典转换为字典列表以便处理
        formatted_video_list = list(video_details.values())
        
        # 打印返回的字段（用于调试）
        safe_print(f"\n📊 YouTube搜索返回 {len(formatted_video_list)} 个视频")
        if formatted_video_list:
            first_video = formatted_video_list[0]
            safe_print(f"🔍 第一个视频的字段:")
            for key, value in first_video.items():
                value_str = str(value)
                if len(value_str) > 100:
                    value_str = value_str[:100] + "..."
                safe_print(f"  {key}: {value_str}")
        
        return formatted_video_list
    
    async def rank_videos_by_duration(self, video_list: List[Dict[str, Any]], limit: int = 10) -> List[Dict[str, Any]]:
        """
        对视频列表应用智能排序（与B站逻辑一致）
        
        优化目标：
        1. 所有视频播放量 ≥ 100万（优先）
        2. 时长多样化分布：
           - 第1个：2-3小时（深度学习）
           - 第2个：1-2小时（适中学习）
           - 第3个：0-1小时（快速入门）
        3. 优先系列视频（多P）
        
        Args:
            video_list: 包含视频详情的字典列表
        
        Returns:
            智能排序后的视频列表
        """
        if not video_list:
            return []
        
        safe_print(f"\n📊 开始YouTube视频智能排序（多样化时长分布）...")
        safe_print(f"📥 初始视频数量: {len(video_list)}")
        
        # 第一步：过滤掉大于5小时的视频和小于1分钟的视频
        MAX_DURATION_SECONDS = 18000  # 5小时
        MIN_DURATION_SECONDS = 60  # 1分钟
        filtered_results = [
            v for v in video_list 
            if MIN_DURATION_SECONDS <= v.get('duration_seconds', 0) <= MAX_DURATION_SECONDS
        ]
        filtered_count = len(video_list) - len(filtered_results)
        if filtered_count > 0:
            too_short = len([v for v in video_list if v.get('duration_seconds', 0) < MIN_DURATION_SECONDS])
            too_long = len([v for v in video_list if v.get('duration_seconds', 0) > MAX_DURATION_SECONDS])
            if too_short > 0:
                safe_print(f"🚫 过滤掉 {too_short} 个小于1分钟的视频")
            if too_long > 0:
                safe_print(f"🚫 过滤掉 {too_long} 个大于5小时的视频")
        results = filtered_results
        
        if not results:
            return []
        
        # 第二步：筛选百万播放量的视频
        million_plus = [v for v in results if v.get('play', 0) >= 1000000]
        
        safe_print(f"✅ 筛选出 {len(million_plus)} 个百万播放量视频（共{len(results)}个）")
        
        # 如果百万+视频不足，降低标准
        if len(million_plus) < 10:  # 至少需要10个用于筛选
            safe_print(f"⚠️  百万+视频不足，扩展到50万播放量")
            million_plus = [v for v in results if v.get('play', 0) >= 500000]
        
        # 如果50万+视频仍然不足，进一步降低标准或使用所有视频
        if len(million_plus) < 10:
            safe_print(f"⚠️  50万+视频不足（{len(million_plus)}个），扩展到10万播放量")
            million_plus = [v for v in results if v.get('play', 0) >= 100000]
        
        # 如果10万+视频仍然不足，使用所有剩余视频（不再限制播放量）
        if len(million_plus) < 10:
            safe_print(f"⚠️  10万+视频不足（{len(million_plus)}个），使用所有视频（共{len(results)}个）")
            million_plus = results
        
        # 第三步：按时长分组（扩大范围以包含更多视频）
        groups = {'long': [], 'medium': [], 'short': [], 'other': []}
        
        for video in million_plus:
            dur = video.get('duration_seconds', 0)
            # 长视频：≥1.5小时（优先接近3小时的）
            if dur >= 5400:  # ≥1.5小时（90分钟）
                groups['long'].append(video)
            # 中视频：30分钟-1.5小时
            elif 1800 <= dur < 5400:  # 30分钟-1.5小时
                groups['medium'].append(video)
            # 短视频：<30分钟
            elif 0 < dur < 1800:  # <30分钟
                groups['short'].append(video)
            else:
                groups['other'].append(video)
        
        safe_print(f"\n📈 时长分布: 长≥1.5h({len(groups['long'])}) "
                  f"中0.5-1.5h({len(groups['medium'])}) "
                  f"短<0.5h({len(groups['short'])}) 其他({len(groups['other'])})")
        
        # 第四步：为每组内视频打分（与B站逻辑一致）
        def score_video(video, rank, is_long_group=False):
            s = 0
            is_series = video.get('is_series', False)
            play = video.get('play', 0)
            dur = video.get('duration_seconds', 0)
            
            # 系列视频加分（10分）
            if is_series:
                s += 10
            
            # 播放量（30分）
            if play >= 5000000:
                s += 30
            elif play >= 2000000:
                s += 25
            elif play >= 1000000:
                s += 20
            else:
                s += 15
            
            # 原始排名（20分）
            s += max(0, 20 - rank * 2)
            
            # YouTube没有收藏数据，跳过收藏率评分
            
            # 🆕 长视频组额外加分：优先接近3小时的视频（30分）
            if is_long_group:
                target_duration = 10800  # 3小时 = 10800秒
                # 计算与3小时的距离，越近分数越高
                duration_diff = abs(dur - target_duration)
                
                if duration_diff <= 1800:  # 与3小时相差≤30分钟
                    s += 30  # 完美！2.5-3.5小时
                elif duration_diff <= 3600:  # 与3小时相差≤1小时
                    s += 25  # 很好！2-4小时
                elif duration_diff <= 5400:  # 与3小时相差≤1.5小时
                    s += 20  # 可接受！1.5-4.5小时
                else:
                    s += 10  # 其他
            
            return s
        
        # 为每组排序（长视频组特殊处理）
        for group_name, group_videos in groups.items():
            for i, v in enumerate(group_videos):
                v['_rank'] = million_plus.index(v) if v in million_plus else i
            
            is_long = (group_name == 'long')
            group_videos.sort(
                key=lambda v: score_video(v, v['_rank'], is_long_group=is_long), 
                reverse=True
            )
        
        # 第五步：选择最终结果（与B站逻辑一致）
        final = []
        
        # 辅助函数：格式化时长显示
        def format_duration(seconds):
            hours = seconds // 3600
            minutes = (seconds % 3600) // 60
            return f"{hours}h{minutes}m"
        
        # 优先选择：长、中、短各选一个，然后循环补充
        group_order = ['long', 'medium', 'short', 'other']
        group_indices = {name: 0 for name in group_order}
        
        while len(final) < limit:
            added = False
            for group_name in group_order:
                group_videos = groups[group_name]
                idx = group_indices[group_name]
                
                if idx < len(group_videos):
                    video = group_videos[idx]
                    if video not in final:
                        final.append(video)
                        added = True
                        group_indices[group_name] = idx + 1
                        safe_print(f"✅ 选择 [{group_name}] {video.get('title', 'N/A')[:50]} "
                                  f"(时长:{format_duration(video.get('duration_seconds', 0))}, "
                                  f"播放:{video.get('play', 0):,})")
                        break
            
            if not added:
                break
        
        safe_print(f"\n✅ YouTube智能排序完成，返回 {len(final)} 个视频")
        
        return final
    
    async def search_videos_with_rerank(
        self, 
        query: str, 
        limit: int = 10,
        **kwargs
    ) -> List[Dict[str, Any]]:
        """
        搜索YouTube视频并进行重排序（与B站逻辑一致）
        
        Args:
            query: 搜索关键词
            limit: 返回结果数量
            **kwargs: 其他参数（如published_after）
        
        Returns:
            重排序后的视频列表
        """
        try:
            # 搜索更多结果用于筛选（10倍，最多30个）
            search_limit = min(limit * 10, 30)
            youtube_videos = await self.get_and_format_youtube_videos(query, max_results=search_limit, **kwargs)
            ranked_videos = await self.rank_videos_by_duration(youtube_videos, limit=limit)
            return ranked_videos
        except Exception as e:
            safe_print(f"❌ [YouTube Search] 获取视频推荐失败: {e}")
            import traceback
            traceback.print_exc()
            return []


# 创建全局实例（如果API KEY不存在，会创建但无法使用）
try:
    youtube_search_service = YouTubeSearchService()
except Exception as e:
    safe_print(f"⚠️ Failed to initialize YouTubeSearchService: {e}")
    # 创建一个空的服务实例，避免导入错误
    class DummyYouTubeSearchService:
        async def search_videos_with_rerank(self, *args, **kwargs):
            return []
    youtube_search_service = DummyYouTubeSearchService()

