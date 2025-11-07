"""
B站视频搜索服务
参考: src_utils_bilibili_retrive.py
"""
import asyncio
from typing import List, Dict, Any
from bilibili_api import search

# 安全的打印函数
def safe_print(msg: str):
    """安全的打印，避免 Windows 控制台编码问题"""
    try:
        print(msg)
    except (ValueError, OSError):
        # 如果 print 失败，使用 logging
        import logging
        logging.info(msg)

class BilibiliSearchService:
    """B站视频搜索服务"""
    
    def __init__(self):
        safe_print("🔍 BilibiliSearchService initialized")
    
    async def search_videos(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """
        搜索B站视频
        
        Args:
            query: 搜索关键词
            limit: 返回结果数量，默认5个
            
        Returns:
            视频列表，每个视频包含:
            - title: 标题
            - url: 视频链接
            - cover: 封面图
            - duration: 时长 (MM:SS 格式)
            - duration_seconds: 时长（秒）
            - author: UP主名称
            - play: 播放量
            - video_review: 弹幕数
            - favorites: 收藏数
            - description: 视频描述
        """
        try:
            safe_print(f"🔍 搜索B站视频: {query}")
            
            # 搜索视频，按综合排序
            search_result = await search.search_by_type(
                query, 
                search.SearchObjectType.VIDEO,
                search.OrderVideo.TOTALRANK  # 综合排序
            )
            
            results = []
            
            # 解析搜索结果
            for item in search_result.get('result', [])[:limit]:
                if item.get('type') == 'video':
                    # 清理标题中的高亮标签
                    title = item['title'].replace('<em class="keyword">', '').replace('</em>', '')
                    
                    # 解析时长为秒数
                    duration_str = item.get('duration', '0:00')
                    duration_seconds = self._parse_duration(duration_str)
                    
                    # 处理封面URL - B站返回的URL可能缺少协议
                    cover_url = item.get('pic', '')
                    if cover_url and not cover_url.startswith('http'):
                        cover_url = 'https:' + cover_url
                    
                    # 判断是否为系列课（多P视频）
                    video_amount = item.get('video_amount', 1)  # 视频数量，默认1
                    is_series = video_amount > 1
                    
                    video_info = {
                        'title': title,
                        'url': item.get('arcurl', ''),
                        'cover': cover_url,  # 封面图（已添加协议）
                        'duration': duration_str,
                        'duration_seconds': duration_seconds,
                        'author': item.get('author', ''),  # UP主
                        'play': item.get('play', 0),  # 播放量
                        'video_review': item.get('video_review', 0),  # 弹幕数
                        'favorites': item.get('favorites', 0),  # 收藏数
                        'description': item.get('description', ''),  # 视频描述
                        'mid': item.get('mid', 0),  # UP主ID
                        'pubdate': item.get('pubdate', 0),  # 发布时间戳
                        'video_amount': video_amount,  # 视频数量
                        'is_series': is_series,  # 是否为系列课
                    }
                    
                    results.append(video_info)
                    safe_print(f"  ✓ {title} ({duration_str})")
            
            safe_print(f"✅ 找到 {len(results)} 个视频")
            return results
            
        except Exception as e:
            safe_print(f"❌ B站视频搜索失败: {e}")
            import traceback
            traceback.print_exc()
            return []
    
    async def search_videos_with_rerank(self, query: str, limit: int = 3) -> List[Dict[str, Any]]:
        """
        搜索B站视频并智能排序
        
        优化目标：
        1. 优先选择系列视频（多P）
        2. 总时长：2-3小时最佳（7200-10800秒）
        3. 播放量：≥100万优先
        4. 避免过长（>5小时）或过短（<1小时）的系列
        
        Args:
            query: 搜索关键词
            limit: 返回结果数量
            
        Returns:
            智能排序后的视频列表
        """
        # 搜索更多结果用于筛选（10倍，最多30个）
        search_limit = min(limit * 10, 30)
        results = await self.search_videos(query, search_limit)
        
        if not results:
            return []
        
        safe_print(f"\n📊 开始智能排序 {len(results)} 个视频...")
        
        # 为每个视频计算综合得分
        scored_videos = []
        
        for i, video in enumerate(results):
            score = 0
            duration_seconds = video.get('duration_seconds', 0)
            play_count = video.get('play', 0)
            is_series = video.get('is_series', False)
            video_amount = video.get('video_amount', 1)
            title = video.get('title', '')[:40]
            
            # === 1. 系列视频优先（权重：40%）===
            if is_series and video_amount > 1:
                score += 150  # 系列视频基础分
                
                # 根据视频数量调整（5-20P最佳）
                if 5 <= video_amount <= 20:
                    score += 50  # 理想数量
                elif 3 <= video_amount < 5:
                    score += 30  # 较少但可接受
                elif 20 < video_amount <= 30:
                    score += 30  # 较多但可接受
                else:
                    score += 10  # 过少或过多
            else:
                score += 20  # 单视频得分较低
            
            # === 2. 总时长得分（权重：30%）===
            ideal_min = 7200   # 2小时
            ideal_max = 10800  # 3小时
            
            if ideal_min <= duration_seconds <= ideal_max:
                score += 120  # 完美时长！
            elif 5400 <= duration_seconds < ideal_min:  # 1.5-2小时
                score += 90
            elif ideal_max < duration_seconds <= 14400:  # 3-4小时
                score += 90
            elif 3600 <= duration_seconds < 5400:  # 1-1.5小时
                score += 60
            elif 14400 < duration_seconds <= 18000:  # 4-5小时
                score += 60
            elif duration_seconds < 3600:  # <1小时（太短）
                score += 20
            elif duration_seconds > 18000:  # >5小时（太长）
                score += 30
            
            # === 3. 播放量得分（权重：25%）===
            if play_count >= 1000000:  # ≥100万
                score += 100
            elif play_count >= 500000:  # 50-100万
                score += 80
            elif play_count >= 100000:  # 10-50万
                score += 60
            elif play_count >= 50000:   # 5-10万
                score += 40
            else:
                score += 20
            
            # === 4. 原始排名奖励（权重：5%）===
            rank_bonus = max(0, 30 - i * 3)
            score += rank_bonus
            
            # 调试输出
            safe_print(f"  [{i+1}] {title}")
            safe_print(f"      {'[系列]' if is_series else '[单P]'} {video_amount}P | "
                      f"时长:{duration_seconds//60}分 | 播放:{play_count//10000}万 | 得分:{score}")
            
            scored_videos.append((score, video))
        
        # 按得分排序
        scored_videos.sort(key=lambda x: x[0], reverse=True)
        
        safe_print(f"\n🏆 排序结果（前{limit}个）:")
        for i, (score, video) in enumerate(scored_videos[:limit]):
            safe_print(f"  #{i+1} 得分:{score} | {video.get('title', '')[:50]}")
        
        # 返回前N个
        return [video for _, video in scored_videos[:limit]]
    
    def _parse_duration(self, duration_str: str) -> int:
        """
        解析时长字符串为秒数
        
        Args:
            duration_str: 时长字符串，如 "05:30" 或 "1:05:30"
            
        Returns:
            时长（秒）
        """
        try:
            parts = duration_str.split(':')
            if len(parts) == 2:
                # MM:SS 格式
                return int(parts[0]) * 60 + int(parts[1])
            elif len(parts) == 3:
                # HH:MM:SS 格式
                return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
            else:
                # 只有秒数
                return int(parts[0])
        except (ValueError, IndexError):
            return 0


# 创建全局实例
bilibili_search_service = BilibiliSearchService()


# 测试代码
if __name__ == "__main__":
    async def test():
        service = BilibiliSearchService()
        results = await service.search_videos_with_rerank("Python基础教程", 3)
        
        print("\n📋 搜索结果:")
        for i, video in enumerate(results, 1):
            print(f"\n{i}. {video['title']}")
            print(f"   UP主: {video['author']}")
            print(f"   时长: {video['duration']}")
            print(f"   播放: {video['play']}")
            print(f"   链接: {video['url']}")
    
    asyncio.run(test())

