"""
B站视频搜索服务
参考: src_utils_bilibili_retrive.py
"""
import asyncio
from typing import List, Dict, Any, Optional
from bilibili_api import search
from bilibili_api import video
import yt_dlp

# 安全的打印函数
def safe_print(msg: str):
    """安全的打印，避免 Windows 控制台编码问题"""
    try:
        print(msg)
    except (ValueError, OSError):
        # 如果 print 失败，使用 logging
        import logging
        logging.info(msg)

# 导入代理服务
try:
    from .proxy_service import proxy_service
    PROXY_SERVICE_AVAILABLE = True
except ImportError:
    PROXY_SERVICE_AVAILABLE = False
    safe_print("⚠️  Proxy service not available, will use direct connection")

class BilibiliSearchService:
    """B站视频搜索服务"""
    
    def __init__(self):
        safe_print("🔍 BilibiliSearchService initialized")
        self.use_proxy = PROXY_SERVICE_AVAILABLE
        if self.use_proxy:
            safe_print("✅ Proxy service enabled")
    
    def _validate_video_url_sync(self, url: str, proxy_url: Optional[str] = None) -> bool:
        """
        同步验证B站视频链接是否有效（在线程中执行）
        
        Args:
            url: B站视频URL
            proxy_url: 代理URL（可选）
            
        Returns:
            True if URL is valid, False otherwise
        """
        if not url or not url.startswith('http'):
            return False
        
        try:
            ydl_opts = {
                'quiet': True,
                'no_warnings': True,
                'extract_flat': True,  # 只提取基本信息，不下载
                'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'referer': 'https://www.bilibili.com/',
                'socket_timeout': 10,  # 10秒超时
                'retries': 1,  # 只重试1次
            }
            
            # 如果提供了代理，添加到配置中并禁用SSL验证（代理可能导致SSL错误）
            if proxy_url:
                ydl_opts['proxy'] = proxy_url
                ydl_opts['nocheckcertificate'] = True  # 禁用SSL证书验证，避免代理导致的SSL错误
                safe_print(f"  🌐 Using proxy for validation: {proxy_url} (SSL verification disabled)")
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.extract_info(url, download=False)
            return True
        except Exception as e:
            safe_print(f"  ⚠️  链接验证失败: {url[:50]}... 错误: {str(e)[:100]}")
            return False
    
    async def _validate_video_url(self, url: str) -> bool:
        """
        异步验证B站视频链接是否有效（支持代理）
        
        Args:
            url: B站视频URL
            
        Returns:
            True if URL is valid, False otherwise
        """
        # 如果使用代理，获取代理IP
        proxy_url = None
        if self.use_proxy:
            proxy_url = proxy_service.get_current_proxy()
        
        # 在线程池中执行同步验证，避免阻塞事件循环
        return await asyncio.to_thread(self._validate_video_url_sync, url, proxy_url)
    
    async def search_videos(self, query: str, limit: int = 5, max_retries: int = 3) -> List[Dict[str, Any]]:
        """
        搜索B站视频（支持代理IP）
        
        Args:
            query: 搜索关键词
            limit: 返回结果数量，默认5个
            max_retries: 最大重试次数（每次失败会切换代理）
            
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
        retry_delays = [1, 2, 3]  # 重试延迟
        
        for attempt in range(max_retries):
            try:
                safe_print(f"🔍 搜索B站视频: {query} (attempt {attempt + 1}/{max_retries})")
                
                # 如果使用代理，获取代理IP
                proxy_url = None
                if self.use_proxy:
                    proxy_url = await proxy_service.get_next_proxy(mark_failed=(attempt > 0))
                    if proxy_url:
                        safe_print(f"🌐 Using proxy: {proxy_url}")
                    else:
                        safe_print("⚠️  No proxy available, using direct connection")
                
                # 搜索视频，按综合排序
                # 注意：bilibili_api库可能不支持直接设置代理，需要通过环境变量或全局配置
                # 这里我们先尝试直接调用，如果失败再考虑其他方案
                search_result = await search.search_by_type(
                    query, 
                    search.SearchObjectType.VIDEO,
                    search.OrderVideo.TOTALRANK  # 综合排序
                )
                
                results = []
                
                # 解析搜索结果
                for item in search_result.get('result', [])[:limit]:
                    if item.get('type') == 'video':
                        # 调试：打印第一个视频的关键字段（用于排查问题）
                        if len(results) == 0:
                            safe_print(f"  🔍 第一个视频的关键字段:")
                            safe_print(f"    episode_count_text: {item.get('episode_count_text', 'NOT_FOUND')}")
                            safe_print(f"    bvid: {item.get('bvid', 'NOT_FOUND')}")
                            safe_print(f"    aid: {item.get('aid', 'NOT_FOUND')}")
                        
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
                        # 方法1：尝试从 episode_count_text 字段解析（如 "共3P"）
                        video_amount = 1
                        episode_text = item.get('episode_count_text', '')
                        if episode_text:
                            try:
                                # 尝试从文本中提取数字，如 "共3P" -> 3
                                import re
                                match = re.search(r'(\d+)', str(episode_text))
                                if match:
                                    video_amount = int(match.group(1))
                                    safe_print(f"  📚 从episode_count_text解析到: {title} ({video_amount}P)")
                            except Exception:
                                pass
                        
                        # 方法2：如果方法1失败，通过BV号查询视频详情
                        if video_amount == 1:
                            bvid = item.get('bvid', '')
                            if bvid:
                                try:
                                    video_amount = await self._get_video_pages_count(bvid)
                                    if video_amount > 1:
                                        safe_print(f"  📚 通过视频API检测到系列课: {title} ({video_amount}P)")
                                except Exception as e:
                                    # 如果获取失败，保持默认值1
                                    safe_print(f"  ⚠️ 获取视频分P信息失败 ({bvid}): {e}")
                                    pass
                        
                        is_series = video_amount > 1
                        
                        # 调试日志
                        if is_series:
                            safe_print(f"  ✅ 最终判断为系列课: {title} ({video_amount}P)")
                        else:
                            safe_print(f"  📹 单视频: {title}")
                        
                        video_url = item.get('arcurl', '')
                        
                        video_info = {
                            'title': title,
                            'url': video_url,
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
                
                # 验证所有视频链接有效性（并行验证）
                if results:
                    safe_print(f"\n🔍 验证 {len(results)} 个视频链接有效性...")
                    validation_tasks = [self._validate_video_url(video['url']) for video in results]
                    validation_results = await asyncio.gather(*validation_tasks, return_exceptions=True)
                    
                    # 过滤掉无效链接
                    valid_results = []
                    for video, is_valid in zip(results, validation_results):
                        if isinstance(is_valid, Exception) or not is_valid:
                            safe_print(f"  ❌ 跳过无效链接: {video['title'][:40]}... ({video['url'][:50]}...)")
                        else:
                            valid_results.append(video)
                    
                    results = valid_results
                    safe_print(f"✅ 验证完成，有效链接: {len(results)}/{len(validation_results)}")
                
                safe_print(f"✅ 找到 {len(results)} 个视频")
                return results
                
            except Exception as e:
                error_msg = str(e)
                error_lower = error_msg.lower()
                
                # 检查是否是网络错误或可重试的错误
                is_retryable = (
                    '412' in error_msg or
                    'precondition failed' in error_lower or
                    'http error' in error_lower or
                    'connection' in error_lower or
                    'timeout' in error_lower or
                    'network' in error_lower
                )
                
                safe_print(f"❌ Attempt {attempt + 1}/{max_retries} failed: {error_msg}")
                
                # 如果使用代理且失败，标记代理为失败
                if self.use_proxy and proxy_url:
                    proxy_service.mark_proxy_failed(proxy_url)
                
                # 如果是最后一次尝试或不可重试的错误，抛出异常
                if attempt == max_retries - 1 or not is_retryable:
                    safe_print(f"❌ B站视频搜索失败，已重试 {attempt + 1} 次")
                    import traceback
                    traceback.print_exc()
                    return []
                
                # 等待后重试
                if attempt < max_retries - 1:
                    delay = retry_delays[min(attempt, len(retry_delays) - 1)]
                    safe_print(f"🔄 Retrying after {delay}s...")
                    await asyncio.sleep(delay)
        
        return []
    
    async def search_videos_with_rerank(self, query: str, limit: int = 3) -> List[Dict[str, Any]]:
        """
        搜索B站视频并智能排序 - 多样化时长分布
        
        优化目标：
        1. 所有视频播放量 ≥ 100万（优先）
        2. 时长多样化分布：
           - 第1个：2-3小时（深度学习）
           - 第2个：1-2小时（适中学习）
           - 第3个：0-1小时（快速入门）
        3. 优先系列视频（多P）
        
        Args:
            query: 搜索关键词
            limit: 返回结果数量（默认3）
            
        Returns:
            智能排序后的视频列表
        """
        # 搜索更多结果用于筛选（10倍，最多30个）
        search_limit = min(limit * 10, 30)
        results = await self.search_videos(query, search_limit)
        
        if not results:
            return []
        
        safe_print(f"\n📊 开始智能排序（多样化时长分布）...")
        
        # 第一步：过滤掉大于5小时的视频和小于1分钟的视频
        MAX_DURATION_SECONDS = 18000  # 5小时
        MIN_DURATION_SECONDS = 60  # 1分钟
        filtered_results = [
            v for v in results 
            if MIN_DURATION_SECONDS <= v.get('duration_seconds', 0) <= MAX_DURATION_SECONDS
        ]
        filtered_count = len(results) - len(filtered_results)
        if filtered_count > 0:
            too_short = len([v for v in results if v.get('duration_seconds', 0) < MIN_DURATION_SECONDS])
            too_long = len([v for v in results if v.get('duration_seconds', 0) > MAX_DURATION_SECONDS])
            if too_short > 0:
                safe_print(f"🚫 过滤掉 {too_short} 个小于1分钟的视频")
            if too_long > 0:
                safe_print(f"🚫 过滤掉 {too_long} 个大于5小时的视频")
        results = filtered_results
        
        # 第二步：筛选百万播放量的视频
        million_plus = [v for v in results if v.get('play', 0) >= 1000000]
        
        safe_print(f"✅ 筛选出 {len(million_plus)} 个百万播放量视频（共{len(results)}个）")
        
        # 如果百万+视频不足，降低标准
        if len(million_plus) < limit:
            safe_print(f"⚠️  百万+视频不足，扩展到50万播放量")
            million_plus = [v for v in results if v.get('play', 0) >= 500000]
        
        # 如果50万+视频仍然不足，进一步降低标准或使用所有视频
        if len(million_plus) < limit:
            safe_print(f"⚠️  50万+视频不足（{len(million_plus)}个），扩展到10万播放量")
            million_plus = [v for v in results if v.get('play', 0) >= 100000]
        
        # 如果10万+视频仍然不足，使用所有剩余视频（不再限制播放量）
        if len(million_plus) < limit:
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
        
        # 第三步：为每组内视频打分
        def score_video(video, rank, is_long_group=False):
            s = 0
            is_series = video.get('is_series', False)
            amount = video.get('video_amount', 1)
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
            
            # 收藏率（10分）
            fav = video.get('favorites', 0)
            if play > 0 and fav / play > 0.1:
                s += 10
            elif play > 0 and fav / play > 0.05:
                s += 5
            
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
            for v in group_videos:
                v['_rank'] = results.index(v)
            
            is_long = (group_name == 'long')
            group_videos.sort(
                key=lambda v: score_video(v, v['_rank'], is_long_group=is_long), 
                reverse=True
            )
        
        # 第四步：选择最终结果
        final = []
        
        # 辅助函数：格式化时长显示
        def format_duration(seconds):
            hours = seconds // 3600
            minutes = (seconds % 3600) // 60
            if hours > 0:
                return f"{hours}h{minutes}m"
            else:
                return f"{minutes}m"
        
        # 1. 选最佳长视频（≥1.5h，优先接近3h）
        if groups['long']:
            best = groups['long'][0]
            final.append(best)
            dur_sec = best.get('duration_seconds', 0)
            safe_print(f"\n✅ [1] 长视频(≥1.5h): {best.get('title', '')[:40]}")
            safe_print(f"    时长:{format_duration(dur_sec)}({dur_sec//60}分) | "
                      f"{best.get('play', 0)//10000}万播 | "
                      f"{'系列' if best.get('is_series') else '单P'} {best.get('video_amount', 1)}P")
        
        # 2. 选最佳中视频（0.5-1.5h）
        if groups['medium'] and len(final) < limit:
            best = groups['medium'][0]
            if best not in final:
                final.append(best)
                dur_sec = best.get('duration_seconds', 0)
                safe_print(f"\n✅ [2] 中视频(0.5-1.5h): {best.get('title', '')[:40]}")
                safe_print(f"    时长:{format_duration(dur_sec)}({dur_sec//60}分) | "
                          f"{best.get('play', 0)//10000}万播 | "
                          f"{'系列' if best.get('is_series') else '单P'} {best.get('video_amount', 1)}P")
        
        # 3. 选最佳短视频（<0.5h）
        if groups['short'] and len(final) < limit:
            best = groups['short'][0]
            if best not in final:
                final.append(best)
                dur_sec = best.get('duration_seconds', 0)
                safe_print(f"\n✅ [3] 短视频(<0.5h): {best.get('title', '')[:40]}")
                safe_print(f"    时长:{format_duration(dur_sec)}({dur_sec//60}分) | "
                          f"{best.get('play', 0)//10000}万播 | "
                          f"{'系列' if best.get('is_series') else '单P'} {best.get('video_amount', 1)}P")
        
        # 4. 如果不足3个，补充其他组
        if len(final) < limit:
            safe_print(f"\n⚠️  需补充 {limit - len(final)} 个视频")
            for group_name in ['other', 'long', 'medium', 'short']:
                for v in groups[group_name]:
                    if v not in final and len(final) < limit:
                        final.append(v)
                        safe_print(f"   补充: {v.get('title', '')[:40]} ({v.get('duration_seconds', 0)//60}分)")
        
        safe_print(f"\n🏆 返回 {len(final)} 个多样化视频\n")
        
        return final[:limit]
    
    def _extract_bv_id_from_url(self, url: str) -> Optional[str]:
        """从B站视频URL中提取BV号"""
        try:
            # 格式：https://www.bilibili.com/video/BV1xx411c7mD
            if '/video/' in url:
                parts = url.split('/video/')
                if len(parts) > 1:
                    bv_id = parts[1].split('?')[0].split('/')[0]  # 移除查询参数和路径
                    if bv_id.startswith('BV'):
                        return bv_id
            return None
        except Exception:
            return None
    
    async def _get_video_pages_count(self, bv_id: str) -> int:
        """通过BV号获取视频分P数量"""
        try:
            v = video.Video(bvid=bv_id)
            info = await v.get_info()
            # B站API返回的pages字段包含所有分P信息
            pages = info.get('pages', [])
            page_count = len(pages) if pages else 1
            if page_count > 1:
                safe_print(f"    📊 BV{bv_id} 有 {page_count} 个分P")
            return page_count
        except Exception as e:
            safe_print(f"  ⚠️ 获取视频分P信息失败 ({bv_id}): {e}")
            return 1
    
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

