# from log import logger
from duckduckgo_search import AsyncDDGS
from log import logger
import asyncio
from typing import List, Dict, Optional

async def duckduckgo_image_search(query,lang="en")-> list[dict]:
    """
    根据关键词的语言设置 DuckDuckGo Search 的搜索区域。

    Args:
        keywords: 搜索关键词 (字符串)。

    Returns:
        适用于 DuckDuckGo Search 的区域代码 (字符串)。
    返回结果格式：
    [
        {
            "title": "...",
            "url": "...",
            "image": "...",
            "source": "...",
            "thumbnail": "...",
            "width": "...",
            "height": "...",
        }
    ]
    """
    # 简单的判断方法：检查关键词中是否包含中文字符
    if lang=="zh":
        region = "cn-zh"
    else:
        region = "wt-wt"


    try:
        results = await AsyncDDGS().images(
            keywords=query,
            region=region,
            safesearch="off",
            size=None,
            color=None,
            type_image=None,
            layout=None,
            license_image=None,
            max_results=10, # 限制结果数量以便展示
            )
        for result in results:
            result.update({"url":result["image"]})
        logger.info(f"DuckDuckGo Search Found {len(results)} images")
        return results
    
    except Exception as e:
        logger.error(f"DuckDuckGo Search Error: {e}",exc_info=True)
        return []


def format_duration(seconds: int) -> str:
    """将秒数转换为时分秒格式（例如：125秒 → "2:05"）"""
    if seconds < 0:
        return "0:00"
    minutes, secs = divmod(seconds, 60)
    hours, mins = divmod(minutes, 60)
    if hours > 0:
        return f"{hours}:{mins:02d}:{secs:02d}"
    return f"{mins}:{secs:02d}"

async def duckduckgo_video_search(
    query: str,
    lang: str = "en",
    safesearch: str = "moderate",
    timelimit: Optional[str] = None,
    resolution: Optional[str] = "high",
    duration: Optional[str] = "medium",
    license_videos: Optional[str] = None,
    max_results: Optional[int] = 10
) -> List[Dict]:
    """
    异步搜索视频并返回指定格式的结果列表
    
    参数:
        keywords: 搜索关键词
        region: 地区代码（例如：us-en, cn-zh）
        safesearch: 安全搜索级别（on, moderate, off）
        timelimit: 时间限制（d: 天, w: 周, m: 月）
        resolution: 视频分辨率（high, standart）
        duration: 视频时长（short, medium, long）
        license_videos: 视频授权类型（creativeCommon, youtube）
        max_results: 最大返回结果数
    
    返回:
        符合指定格式的视频信息列表
    """
    if lang=="zh":
        region = "cn-zh"
    else:
        region = "wt-wt"
    result_list = []
    
    try:
        # 初始化异步DDGS客户端（可根据需要添加代理参数）
        async with AsyncDDGS() as ddgs:
            # 调用视频搜索接口
            raw_results = await ddgs.videos(
                keywords=query,
                region=region,
                safesearch=safesearch,
                timelimit=timelimit,
                resolution=resolution,
                duration=duration,
                license_videos=license_videos,
                max_results=max_results
            )
            
            # 处理原始结果并转换为目标格式
            for idx, item in enumerate(raw_results):
                # 提取视频ID（从URL中解析，不同平台格式可能不同）
                video_id = ""
                link = item.get("content", "")
                if "youtube.com" in link and "v=" in link:
                    video_id = link.split("v=")[-1].split("&")[0]
                elif "vimeo.com" in link:
                    video_id = link.split("/")[-1].split("?")[0]
                else:
                    # 通用ID提取（使用URL哈希）
                    import hashlib
                    video_id = hashlib.md5(link.encode()).hexdigest()[:10]
                
                # 解析时长（原始结果中可能为字符串，需转换为秒）
                duration_str = item.get("duration", "0:00")
                duration_parts = list(map(int, duration_str.split(":")))
                duration_sec = 0
                if len(duration_parts) == 3:  # 时:分:秒
                    duration_sec = duration_parts[0] * 3600 + duration_parts[1] * 60 + duration_parts[2]
                elif len(duration_parts) == 2:  # 分:秒
                    duration_sec = duration_parts[0] * 60 + duration_parts[1]
                elif len(duration_parts) == 1:  # 秒
                    duration_sec = duration_parts[0]
                
                # 构建视频信息字典
                video_info = {
                    "video_id": video_id,
                    "title": item.get("title", "无标题"),
                    "description": item.get("description", "无描述"),
                    "cover": item['images']['large'],  # 封面图URL
                    "url": link,
                    "duration_seconds": int(duration_sec),
                    "duration": format_duration(int(duration_sec)),
                    "original_rank": item.get("position", idx),  # 保留原始排序位置
                    "score": None  # 初始化为None，可根据后续逻辑填充
                }
                
                result_list.append(video_info)
        
        return result_list
    except Exception as e:
        print(f"意外错误: {str(e)}")
        return []

if __name__ == "__main__":
    # results = asyncio.run(duckduckgo_image_search("蝴蝶"))
    # print(results)
    async def main():
        # 搜索"nature documentary"相关的高清视频，最多返回10个结果
        videos = await duckduckgo_video_search(
            query="钢琴入门",
            lang="en"
        )
        print(f"找到{len(videos)}个视频结果：")
        for video in videos:
            print(f"[{video['duration']}] {video['title']}")

    asyncio.run(main())