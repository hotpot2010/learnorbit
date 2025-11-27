# serper_wrappers.py
import os
import re
import math
import time
import asyncio
from log import logger  # 按你原来代码的风格使用 logger
import httpx
import requests
import json
# from apollo import get_serper_api_key
SERPER_API_KEY = os.getenv("SERPER_API_KEY")
SERPER_BASE = "https://google.serper.dev"  # Serper 的 base url (注意：也有 api.serper.dev/xxx 的写法，但官方 JS gist 使用 google.serper.dev)
if not SERPER_API_KEY:
    logger.error("SERPER_API_KEY is not set")

# -------- 工具函数 --------
def _seconds_from_hhmmss(s: str) -> int:
    parts = s.split(':')
    parts = [int(p) for p in parts]
    if len(parts) == 3:
        h, m, sec = parts
    elif len(parts) == 2:
        h = 0
        m, sec = parts
    else:
        return 0
    return h * 3600 + m * 60 + sec

def parse_duration_from_text(text: str) -> int:
    """
    尝试从给定文本中解析时长，支持 H:MM:SS 或 M:SS 格式。
    返回秒数（找不到返回 0）。
    """
    if not text:
        return 0
    # 优先匹配 H:MM:SS
    m = re.search(r'(\d{1,2}:\d{2}:\d{2})', text)
    if m:
        return _seconds_from_hhmmss(m.group(1))
    # 再匹配 M:SS
    m = re.search(r'(\d{1,2}:\d{2})(?!:)', text)
    if m:
        return _seconds_from_hhmmss(m.group(1))
    # 有时格式是 'Duration: 1 min 15 sec' 之类
    m = re.search(r'(\d+)\s*min(?:ute)?s?\s*(\d+)\s*sec(?:ond)?s?', text)
    if m:
        return int(m.group(1)) * 60 + int(m.group(2))
    m = re.search(r'(\d+)\s*min', text)
    if m:
        return int(m.group(1)) * 60
    return 0

def format_duration(seconds: int) -> str:
    if not seconds or seconds <= 0:
        return "N/A"
    h = seconds // 3600
    m = (seconds % 3600) // 60
    s = seconds % 60
    return f"{int(h):02d}:{int(m):02d}:{int(s):02d}"

def extract_youtube_id_from_url(url: str) -> str:
    """
    尝试从常见 YouTube 链接提取 videoId；否则返回原始 url 作为 id 的回退值。
    """
    if not url:
        return ""
    # watch?v=
    m = re.search(r"[?&]v=([A-Za-z0-9_-]{6,})", url)
    if m:
        return m.group(1)
    # youtu.be/
    m = re.search(r"youtu\.be/([A-Za-z0-9_-]{6,})", url)
    if m:
        return m.group(1)
    # embed/
    m = re.search(r"youtube\.com/embed/([A-Za-z0-9_-]{6,})", url)
    if m:
        return m.group(1)
    # fallback: use url itself (短化)
    return url

# --------- 函数 A：搜索视频并格式化 ---------
async def get_and_format_serper_videos(query="surfing", max_results=10, lang="en"):
    """
    使用 Serper 的 /videos endpoint 检索视频，返回类似 YouTube 格式的字典列表：
    [
      {
        'video_id': ...,
        'title': ...,
        'description': ...,
        'cover': ...,
        'url': ...,
        'duration_seconds': ...,
        'duration': 'HH:MM:SS'
      }, ...
    ]
    注意：Serper 的 video item 通常包含 title/link/snippet/imageUrl/date/position；时长信息并非总有，
    我们会尝试从 snippet 中解析（如 "1:23"、"1:02:15" 等），否则设为 0 / "N/A"。
    """
    if not SERPER_API_KEY:
        logger.error("SERPER_API_KEY not set")
        return []
    if lang=="zh":
        gl="cn"
        hl="zh-cn"
    else:
        gl="us"
        hl="en"
    payload = {
        "q": query,
        "num": max_results,
        "gl": gl,
        "hl": hl,
    }

    headers = {
        "X-API-KEY": SERPER_API_KEY,
        "Content-Type": "application/json"
    }

    async with httpx.AsyncClient(base_url=SERPER_BASE, headers=headers, timeout=20.0) as client:
        try:
            start = time.perf_counter()
            resp = await client.post("/videos", json=payload)
            response_time = time.perf_counter() - start
            if resp.status_code != 200:
                logger.error(f"[Serper Videos] non-200 status: {resp.status_code} body={resp.text}",exc_info=True)
                return []
            data = resp.json()
        except Exception as e:
            logger.error(f"[Serper Videos] 请求失败: {e}",exc_info=True)
            return []

    videos_src = data.get("videos", []) or []
    video_details = {}

    for idx, item in enumerate(videos_src):
        # 根据 serper 的 Video interface，常见字段为 title, link, snippet, imageUrl, date, position
        link = item.get("link") or item.get("url") or ""
        title = item.get("title") or ""
        snippet = item.get("snippet") or ""
        imageUrl = item.get("imageUrl") or item.get("thumbnailUrl") or ""
        # try to extract duration from snippet
        duration_sec = parse_duration_from_text(snippet)
        # construct id (if youtube extract id else use link as id)
        video_id = extract_youtube_id_from_url(link) or f"serper-{idx}"

        video_details[video_id] = {
            "video_id": video_id,
            "title": title,
            "description": snippet,
            "cover": imageUrl,
            "url": link,
            "duration_seconds": int(duration_sec),
            "duration": format_duration(int(duration_sec)),
            # we keep original position so后面排序使用（可选）
            "original_rank": item.get("position", idx)
        }

    formatted_video_list = list(video_details.values())
    return formatted_video_list


# --------- 排序函数（复用你给的逻辑） ---------
async def rank_videos_by_duration(video_list):
    """
    与你给的 rank_videos_by_duration 保持一致的打分逻辑：
    - shorter duration 更好（duration_score）
    - 原始排名越靠前越好（rank_score）
    - combine: 0.6 * duration_score + 0.4 * rank_score
    """
    if not video_list:
        return []

    for i, video in enumerate(video_list):
        if "original_rank" not in video:
            video["original_rank"] = i

    duration_seconds_list = [v.get("duration_seconds", 0) for v in video_list if "duration_seconds" in v]

    if not duration_seconds_list:
        ranked_data = sorted(video_list, key=lambda x: x.get("original_rank", float("inf")))
        for item in ranked_data:
            item.pop("original_rank", None)
            item.pop("score", None)
        return ranked_data

    max_duration = max(duration_seconds_list) if duration_seconds_list else 1
    min_duration = min(duration_seconds_list) if duration_seconds_list else 0
    duration_range = max_duration - min_duration if max_duration != min_duration else 1

    ranked_data = []
    for video in video_list:
        ds = video.get("duration_seconds", 0)
        duration_score = 1 - (ds - min_duration) / duration_range
        rank_score = 1 / (video.get("original_rank", len(video_list)) + 1)
        video["score"] = 0.6 * duration_score + 0.4 * rank_score
        ranked_data.append(video)

    ranked_data.sort(key=lambda x: x["score"], reverse=True)
    for item in ranked_data:
        item.pop("original_rank", None)
        item.pop("score", None)
    return ranked_data

async def retrive_serper_rerank(query, **kwargs):
    try:
        videos = await get_and_format_serper_videos(query, **kwargs)
        ranked = await rank_videos_by_duration(videos)
        return ranked
    except Exception as e:
        logger.error(f"[Serper Retrive] 获取并重排视频失败: {e}",exc_info=True)
        return []

# serper_wrappers.py (继续上面的文件)
async def serper_web_search(query, time_range="year", include_images=True,num=10,lang="en"):
    """
    使用 Serper 的 /search endpoint，返回类似 TavilyClient 的结构（已适配目标输出格式）：
    {
      "query": query,
      "follow_up_questions": None,
      "answer": "...",
      "images": [{"url": str, "description": str}],
      "results": [
        {"url": str, "title": str, "content": str, "score": float|None, "raw_content": None}
      ],
      "response_time": float(seconds)
    }
    """
    if not SERPER_API_KEY:
        logger.error("SERPER_API_KEY not set")
        return {
            "query": query,
            "follow_up_questions": None,
            "answer": None,
            "images": [],
            "results": [],
            "response_time": -1,
        }
    if lang=="zh":
        gl="cn"
        hl="zh-cn"
    else:
        gl="us"
        hl="en"
    payload = {
        "q": query,
        "num": num,
        "gl": gl,
        "hl": hl,
        # Serper 自身没有 time_range 参数，传入 time_range 可用于后续自定义过滤（目前我们放入 metadata 但不直接生效）
    }
    headers = {"X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json"}

    async with httpx.AsyncClient(base_url=SERPER_BASE, headers=headers, timeout=20.0) as client:
        try:
            start = time.perf_counter()
            resp = await client.post("/search", json=payload)
            response_time = time.perf_counter() - start
            if resp.status_code != 200:
                logger.error(f"[Serper Search] non-200: {resp.status_code} body={resp.text}")
                return {
                    "query": query,
                    "follow_up_questions": None,
                    "answer": None,
                    "images": [],
                    "results": [],
                    "response_time": response_time,
                }
            data = resp.json()
        except Exception as e:
            logger.error(f"[Serper Search] 请求失败: {e}",exc_info=True)
            return {
                "query": query,
                "follow_up_questions": None,
                "answer": None,
                "images": [],
                "results": [],
                "response_time": -1,
            }

    # answer 优先级：answerBox.snippet -> knowledgeGraph.description -> top organic snippet
    answer = None
    if data.get("answerBox") and data["answerBox"].get("snippet"):
        answer = data["answerBox"]["snippet"]
    elif data.get("knowledgeGraph") and data["knowledgeGraph"].get("description"):
        answer = data["knowledgeGraph"]["description"]
    else:
        # top organic
        organic = data.get("organic", [])
        if organic and len(organic) > 0:
            answer = organic[0].get("snippet") or organic[0].get("title")

    # images 聚合到 [{url, description}] 结构
    images = []
    if include_images:
        # 直接使用 images 字段
        if data.get("images"):
            for im in data.get("images", []):
                if isinstance(im, dict):
                    img_url = im.get("imageUrl") or im.get("thumbnailUrl")
                    img_desc = im.get("title") or im.get("snippet") or ""
                else:
                    img_url = im
                    img_desc = ""
                if img_url:
                    images.append({"url": img_url, "description": img_desc})
        # 从 organic 回退提取
        if not images:
            for org in data.get("organic", []):
                if org.get("imageUrl"):
                    images.append({
                        "url": org.get("imageUrl"),
                        "description": org.get("title") or org.get("snippet") or "",
                    })

    # results 列表化为 [{url, title, content, score, raw_content}]
    results = []
    for org in data.get("organic", []):
        results.append({
            "url": org.get("link"),
            "title": org.get("title"),
            "content": org.get("snippet") or org.get("title"),
            "score": org.get("score"),  # serper 通常不返回 score，这里可能为 None
            "raw_content": None,
        })

    return {
        "query": query,
        "follow_up_questions": None,
        "answer": answer,
        "images": images,
        "results": results,
        "response_time": response_time,
    }

async def serper_image_search(query,lang="en"):
    if not SERPER_API_KEY:
        logger.error("SERPER_API_KEY not set")
        return []
    gl="us"
    hl="en"
    if lang=="zh":
        gl="cn"
        hl="zh-cn"
    # else:
    #     gl="us"
    #     hl="en"

    payload = {
        "q": query,
        "gl": gl,
        "hl": hl
    }
    headers = {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json'
    }
    
    async with httpx.AsyncClient(base_url=SERPER_BASE, headers=headers, timeout=20.0) as client:
        try:
            resp = await client.post("/images", json=payload)
            if resp.status_code != 200:
                logger.error(f"[Serper Images] non-200 status: {resp.status_code} body={resp.text}")
                return []
            result = resp.json()
        except Exception as e:
            logger.error(f"Serper Image Search Error: {e}", exc_info=True)
            return []

    if 'images' not in result:
        logger.warning(f"Serper Image Search: 'images' key not in response. Response: {result}")
        return []

    
    results = []
    for res in result.get('images', []):
        results.append(dict(title=res['title'],url=res['imageUrl'],image=res['imageUrl'],source=res['source'],thumbnail=res['link'],width=res['imageWidth'],height=res['imageHeight']))
    logger.info(f"Serper Search Found {len(results)} images")
    return results

# 示例同步调用 (演示)
if __name__ == "__main__":
    # async def demo():
    #     vids = await retrive_serper_rerank("flash attention", max_results=8,lang="zh")
    #     print("Videos (ranked):")
    #     for v in vids:
    #         print(v)
    #     web = await serper_web_search("flash attention", num=5,lang="zh")
    #     print("\nWeb search:", web)

    # asyncio.run(demo())
    asyncio.run(serper_image_search("flash attention",lang="zh"))
