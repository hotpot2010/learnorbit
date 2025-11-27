import asyncio, os, time, re, base64
import httpx
from pprint import pp
# from log import logger

SEARXNG_HOST = os.getenv("SEARXNG_HOST","https://searchengine.zeabur.app")
# PASSWORD = os.getenv("SEARXNG_PASSWORD")  
# 使用任意用户名 "user"，服务器只验证密码
# auth_header = base64.b64encode(f"user:{PASSWORD}".encode()).decode()
# auth_header = base64.b64encode(f"user".encode()).decode()

HEADERS =  {
            'Accept': 'application/json',
            'User-Agent': 'SearchXNG Python Client'
        }

# 并发控制：限制同时进行的搜索请求数量
MAX_CONCURRENT_SEARCHES = int(os.getenv("MAX_CONCURRENT_SEARCHES", "20"))
_search_semaphore = asyncio.Semaphore(MAX_CONCURRENT_SEARCHES)

def parse_duration_seconds(text: str) -> int:
    if not text:
        return 0
    m = re.search(r'(\d{1,2}:\d{2}:\d{2})', text)
    if m:
        h, m2, s = map(int, m.group(1).split(":"))
        return h*3600 + m2*60 + s
    m = re.search(r'(\d{1,2}:\d{2})(?!:)', text)
    if m:
        mm, ss = map(int, m.group(1).split(":"))
        return mm*60 + ss
    return 0

def format_duration(seconds: int) -> str:
    if seconds <= 0:
        return "N/A"
    h = seconds // 3600
    m = (seconds % 3600) // 60
    s = seconds % 60
    return f"{h:02d}:{m:02d}:{s:02d}"

async def searxng_web_search(query, time_range="", num_results=10,lang="en"):
    """
    使用 SearXNG 搜索网页内容
    
    Args:
        query (str): 搜索关键词
        time_range (str): 时间范围，默认为空
        num_results (int): 返回结果数量（当前未使用）
        lang (str): 语言设置
        
    Returns:
        dict: 搜索结果，包含 query, results, answer, images 等字段
    """
    # 如果查询为空，直接返回空结果
    if not query or not query.strip():
        return {
            "query": query,
            "follow_up_questions": None,
            "answer": None,
            "images": [],
            "results": [],
            "response_time": 0
        }
    
    # 使用信号量控制并发
    async with _search_semaphore:
        params = {
            "q": query,
            "format": "json",
            "time_range": time_range,
            "pageno": 1,
            "categories": "general",
            "language": "auto",
            "safesearch": 0,
        }
        
        try:
            async with httpx.AsyncClient(timeout=20.0, headers=HEADERS) as client:
                start = time.perf_counter()
                resp = await client.get(f"{SEARXNG_HOST}/search", params=params)
                elapsed = time.perf_counter() - start
                
                if resp.status_code != 200:
                    # logger.error(f"[SearxNG Web] status {resp.status_code}")
                    return {
                        "query": query,
                        "follow_up_questions": None,
                        "answer": None,
                        "images": [],
                        "results": [],
                        "response_time": elapsed
                    }
                
                data = resp.json()
        except Exception as e:
            # 捕获所有异常，包括网络错误、超时、JSON解析失败等
            # print(f"[SearxNG Web] 请求失败: {e}")
            return {
                "query": query,
                "follow_up_questions": None,
                "answer": None,
                "images": [],
                "results": [],
                "response_time": 0
            }
        
        answer = data.get("answer") or data.get("infobox", {}).get("content")
        images = [r.get("thumbnail") or r.get("image")
                  for r in data.get("results", []) if r.get("thumbnail") or r.get("image")]
        results = [
            {"title": r.get("title"),
             "url": r.get("url") or r.get("link"),
             "snippet": r.get("snippet"),
             "position": r.get("position", idx),
             "content":r.get("content")}
            for idx, r in enumerate(data.get("results", []))
        ]
        return {"query": query, "follow_up_questions": None,
                "answer": answer, "images": images,
                "results": results, "response_time": elapsed}

async def searxng_video_search(query, num_results=10,lang="en"):
    """
    使用 SearXNG 搜索视频
    
    Args:
        query (str): 搜索关键词
        num_results (int): 返回结果数量
        lang (str): 语言设置
        
    Returns:
        list: 视频列表
    """
    # 如果查询为空，直接返回空结果
    if not query or not query.strip():
        return []
    
    # 使用信号量控制并发
    async with _search_semaphore:
        params = {
            "q": query,
            "format": "json",
            "categories": "videos",
            "pageno": 1,
            "language": lang,
        }
        
        try:
            async with httpx.AsyncClient(timeout=20.0, headers=HEADERS) as client:
                resp = await client.get(f"{SEARXNG_HOST}/search", params=params)
                if resp.status_code != 200:
                    # logger.error(f"[SearxNG Video] status {resp.status_code}")
                    return []
                data = resp.json()
        except Exception as e:
            # 捕获所有异常，包括网络错误、超时、JSON解析失败等
            # print(f"[SearxNG Video] 请求失败: {e}")
            return []
        
        videos = []
        for idx, r in enumerate(data.get("results", [])[:num_results]):
            desc = r.get("snippet", "")
            dur = parse_duration_seconds(desc)
            url = r.get("url") or r.get("link")
            m = re.search(r"[?&]v=([^&]+)", url or "")
            vid = m.group(1) if m else f"vid-{idx}"
            videos.append({
                "video_id": vid,
                "title": r.get("title"),
                "description": desc,
                "cover": r.get("thumbnail") or r.get("image"),
                "url": url,
                "duration_seconds": dur,
                "duration": format_duration(dur)
            })
        return videos

async def check_image_accessibility(url: str, timeout: float = 3.0) -> bool:
    """
    检测图片URL是否可访问
    
    Args:
        url (str): 图片URL
        timeout (float): 超时时间（秒），默认3秒
        
    Returns:
        bool: True表示可访问，False表示不可访问
    """
    if not url:
        return False
    
    # 处理协议相对URL
    if url.startswith('//'):
        url = 'https:' + url
    
    # 跳过明显的问题域名
    blocked_domains = ['artic.edu', 'cloudfront.net']  # 可以根据实际情况扩展
    if any(domain in url.lower() for domain in blocked_domains):
        return False
    
    try:
        # 使用HEAD请求检查，更快且节省带宽
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
                'Referer': 'https://www.google.com/',  # 添加Referer避免防盗链
            }
            resp = await client.head(url, headers=headers)
            
            # 如果HEAD失败，尝试GET（有些服务器不支持HEAD）
            if resp.status_code >= 400:
                resp = await client.get(url, headers=headers)
            
            # 检查状态码和Content-Type
            if resp.status_code == 200:
                content_type = resp.headers.get('content-type', '').lower()
                return 'image' in content_type or content_type == ''
            return False
    except Exception:
        # 任何异常都视为不可访问
        return False

async def searxng_image_search(query, num_results=10, lang="en", time_range="", validate_images=True):
    """
    使用 SearXNG 搜索图片
    
    Args:
        query (str): 搜索关键词
        num_results (int): 返回结果数量，默认10
        lang (str): 搜索语言，默认"en"
        time_range (str): 时间范围，可选值: "", "day", "week", "month", "year"
        validate_images (bool): 是否验证图片可访问性，默认True
        
    Returns:
        list: 图片信息列表，每个元素包含:
            - img_src: 图片源地址
            - thumbnail: 缩略图地址
            - title: 图片标题
            - url: 图片所在页面URL
            - width: 图片宽度（如果有）
            - height: 图片高度（如果有）
            - source: 图片来源网站
            
    Example:
        >>> images = await searxng_image_search("python programming", num_results=20)
        >>> for img in images:
        ...     print(f"{img['title']}: {img['img_src']}")
    """
    # 如果查询为空，直接返回空结果
    if not query or not query.strip():
        return {
            "query": query,
            "images": [],
            "response_time": 0,
            "total": 0
        }
    
    # 使用信号量控制并发
    async with _search_semaphore:
        params = {
            "q": query,
            "format": "json",
            "categories": "images",
            "pageno": 1,
            "language": lang,
            "safesearch": 0,
        }
        if time_range:
            params["time_range"] = time_range
        
        # 如果需要验证图片，多获取一些结果作为备选
        search_limit = num_results * 3 if validate_images else num_results
        
        try:
            async with httpx.AsyncClient(timeout=60.0, headers=HEADERS) as client:
                start = time.perf_counter()
                resp = await client.get(f"{SEARXNG_HOST}/search", params=params)
                elapsed = time.perf_counter() - start
                if resp.status_code != 200:
                    # logger.error(f"[SearxNG Images] status {resp.status_code}")
                    return {
                        "query": query,
                        "images": [],
                        "response_time": elapsed,
                        "total": 0
                    }
                data = resp.json()
        except Exception as e:
            # 捕获所有异常，包括网络错误、超时等
            print(f"[SearxNG Images] 请求失败: {e}")
            return {
                "query": query,
                "images": [],
                "response_time": 0,
                "total": 0
            }
        
        # 先提取所有候选图片
        candidate_images = []
        for idx, r in enumerate(data.get("results", [])[:search_limit]):
            # 提取图片信息
            img_src = r.get("img_src") or r.get("image") or r.get("thumbnail")
            thumbnail = r.get("thumbnail") or r.get("img_src")
            
            if not img_src:  # 跳过没有图片地址的结果
                continue
                
            candidate_images.append({
                "img_src": img_src,
                "thumbnail": thumbnail,
                "title": r.get("title", ""),
                "url": r.get("url") or r.get("link"),
                "width": r.get("img_width") or r.get("width"),
                "height": r.get("img_height") or r.get("height"),
                "source": r.get("source") or r.get("engine", ""),
                "position": idx + 1
            })
        
        # 如果启用验证，并行检测图片可访问性
        if validate_images and candidate_images:
            # 并行检测所有候选图片
            validation_tasks = [
                check_image_accessibility(img["thumbnail"] or img["img_src"]) 
                for img in candidate_images
            ]
            validation_results = await asyncio.gather(*validation_tasks, return_exceptions=True)
            
            # 过滤出可访问的图片
            images = []
            for img, is_accessible in zip(candidate_images, validation_results):
                # 处理异常情况
                if isinstance(is_accessible, Exception):
                    is_accessible = False
                
                if is_accessible:
                    images.append(img)
                    if len(images) >= num_results:
                        break
        else:
            images = candidate_images[:num_results]
        
        return {
            "query": query,
            "images": images,
            "response_time": elapsed,
            "total": len(images)
        }

if __name__ == "__main__":
    async def demo():
        # Web 搜索测试
        # print("=== Web Search Demo ===")
        # pp(await searxng_web_search("flash attention"))
        # print("\n" + "="*50 + "\n")
        
        # # 视频搜索测试
        # print("=== Video Search Demo ===")
        # pp(await searxng_video_search("flash attention"))
        # print("\n" + "="*50 + "\n")
        
        # 图片搜索测试
        print("=== Image Search Demo ===")
        image_results = await searxng_image_search("flash attention", num_results=5)
        print(f"Query: {image_results['query']}")
        print(f"Total images found: {image_results['total']}")
        print(f"Response time: {image_results['response_time']:.2f}s")
        print("\nImages:")
        for img in image_results['images']:
            print(f"  - Title: {img['title']}")
            print(f"    URL: {img['img_src'][:80]}...")
            print(f"    Source: {img['source']}")
            if img['width'] and img['height']:
                print(f"    Size: {img['width']}x{img['height']}")
            print()
    
    asyncio.run(demo())
