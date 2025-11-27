import httpx
import asyncio
from typing import List, Dict, Optional, Any
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import os
import aiofiles
from log import logger


async def fetch_webpage_images(url: str, include_data_urls: bool = False) -> Optional[List[Dict[str, str]]]:
    """
    从指定的网页URL中抓取所有图片信息。
    
    Args:
        url (str): 需要抓取图片的网页URL
        include_data_urls (bool): 是否包含 data: URL 格式的图片，默认为 False
        
    Returns:
        Optional[List[Dict[str, str]]]: 图片信息列表，每个字典包含:
            - src: 图片的完整URL
            - alt: 图片的alt属性（如果有）
            - title: 图片的title属性（如果有）
            失败时返回 None
            
    Raises:
        ValueError: 如果URL为空或格式不正确
        
    Example:
        >>> images = await fetch_webpage_images("https://example.com")
        >>> for img in images:
        ...     print(f"Image: {img['src']}, Alt: {img['alt']}")
    """
    if not url or not isinstance(url, str):
        raise ValueError("参数 url 不能为空且必须为字符串类型。")
    
    # 验证URL格式
    parsed_url = urlparse(url)
    if not parsed_url.scheme or not parsed_url.netloc:
        raise ValueError(f"URL 格式不正确: {url}")
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    }
    
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            
        # 解析HTML内容
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # 查找所有图片标签
        img_tags = soup.find_all('img')
        
        images = []
        for img in img_tags:
            src = img.get('src', '').strip()
            
            if not src:
                continue
            
            # 跳过 data: URL (base64图片) 如果不需要
            if src.startswith('data:') and not include_data_urls:
                continue
            
            # 处理相对URL，转换为绝对URL
            if not src.startswith(('http://', 'https://', 'data:')):
                src = urljoin(url, src)
            
            # 提取图片信息
            image_info = {
                'src': src,
                'alt': img.get('alt', '').strip(),
                'title': img.get('title', '').strip(),
                'width': img.get('width', ''),
                'height': img.get('height', ''),
            }
            
            images.append(image_info)
        
        logger.info(f"成功从 {url} 抓取到 {len(images)} 张图片")
        return images
        
    except httpx.TimeoutException as e:
        logger.warning(f"请求网页超时 for URL {url}: {e}")
        return None
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP错误 for URL {url}: 状态码 {e.response.status_code}")
        return None
    except httpx.RequestError as e:
        logger.error(f"请求网页失败 for URL {url}: {e}")
        return None
    except Exception as e:
        logger.error(f"解析网页图片时发生未知错误 for URL {url}: {e}", exc_info=True)
        return None


async def download_image(image_url: str, save_dir: str, filename: Optional[str] = None) -> Optional[str]:
    """
    下载单张图片到本地目录。
    
    Args:
        image_url (str): 图片的URL
        save_dir (str): 保存图片的目录路径
        filename (Optional[str]): 指定保存的文件名，如果为None则从URL提取
        
    Returns:
        Optional[str]: 保存的文件完整路径，失败时返回 None
        
    Example:
        >>> filepath = await download_image("https://example.com/image.jpg", "./images")
        >>> print(f"Image saved to: {filepath}")
    """
    if not image_url or not isinstance(image_url, str):
        logger.error("图片URL不能为空")
        return None
    
    # 跳过 data: URL
    if image_url.startswith('data:'):
        logger.warning("不支持下载 data: URL 格式的图片")
        return None
    
    try:
        # 创建保存目录
        os.makedirs(save_dir, exist_ok=True)
        
        # 确定文件名
        if not filename:
            parsed = urlparse(image_url)
            filename = os.path.basename(parsed.path)
            
            # 如果没有扩展名，添加.jpg作为默认扩展名
            if not os.path.splitext(filename)[1]:
                filename = filename + '.jpg'
        
        filepath = os.path.join(save_dir, filename)
        
        # 下载图片
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(image_url, headers=headers)
            response.raise_for_status()
            
        # 异步写入文件
        async with aiofiles.open(filepath, 'wb') as f:
            await f.write(response.content)
        
        logger.info(f"成功下载图片: {image_url} -> {filepath}")
        return filepath
        
    except httpx.TimeoutException as e:
        logger.warning(f"下载图片超时 for URL {image_url}: {e}")
        return None
    except httpx.HTTPStatusError as e:
        logger.error(f"下载图片HTTP错误 for URL {image_url}: 状态码 {e.response.status_code}")
        return None
    except httpx.RequestError as e:
        logger.error(f"下载图片请求失败 for URL {image_url}: {e}")
        return None
    except Exception as e:
        logger.error(f"下载图片时发生未知错误 for URL {image_url}: {e}", exc_info=True)
        return None


async def batch_download_images(image_urls: List[str], save_dir: str, max_concurrent: int = 5) -> List[Optional[str]]:
    """
    批量下载多张图片。
    
    Args:
        image_urls (List[str]): 图片URL列表
        save_dir (str): 保存图片的目录路径
        max_concurrent (int): 最大并发下载数，默认为5
        
    Returns:
        List[Optional[str]]: 每张图片的保存路径列表，失败的为None
        
    Example:
        >>> urls = ["https://example.com/img1.jpg", "https://example.com/img2.jpg"]
        >>> paths = await batch_download_images(urls, "./downloads")
        >>> print(f"Downloaded {len([p for p in paths if p])} images")
    """
    semaphore = asyncio.Semaphore(max_concurrent)
    
    async def download_with_limit(img_url: str, idx: int):
        async with semaphore:
            # 生成唯一的文件名
            parsed = urlparse(img_url)
            ext = os.path.splitext(parsed.path)[1] or '.jpg'
            filename = f"image_{idx:04d}{ext}"
            return await download_image(img_url, save_dir, filename)
    
    tasks = [download_with_limit(url, i) for i, url in enumerate(image_urls)]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # 处理异常结果
    processed_results = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            logger.error(f"下载图片 {image_urls[i]} 时发生异常: {result}")
            processed_results.append(None)
        else:
            processed_results.append(result)
    
    success_count = len([r for r in processed_results if r is not None])
    logger.info(f"批量下载完成: 成功 {success_count}/{len(image_urls)} 张图片")
    
    return processed_results


async def fetch_and_download_webpage_images(
    url: str, 
    save_dir: str, 
    include_data_urls: bool = False,
    max_concurrent: int = 5
) -> Dict[str, Any]:
    """
    从网页抓取图片并批量下载到本地。
    
    Args:
        url (str): 网页URL
        save_dir (str): 保存图片的目录路径
        include_data_urls (bool): 是否包含 data: URL 格式的图片
        max_concurrent (int): 最大并发下载数
        
    Returns:
        Dict[str, Any]: 包含以下键的字典:
            - total: 总图片数
            - downloaded: 成功下载的图片数
            - failed: 下载失败的图片数
            - images: 图片信息列表（包含原始信息和本地路径）
            
    Example:
        >>> result = await fetch_and_download_webpage_images(
        ...     "https://example.com", 
        ...     "./downloads"
        ... )
        >>> print(f"Downloaded {result['downloaded']}/{result['total']} images")
    """
    # 第一步：抓取网页图片信息
    images = await fetch_webpage_images(url, include_data_urls=include_data_urls)
    
    if not images:
        return {
            'total': 0,
            'downloaded': 0,
            'failed': 0,
            'images': []
        }
    
    # 第二步：批量下载图片
    image_urls = [img['src'] for img in images if not img['src'].startswith('data:')]
    downloaded_paths = await batch_download_images(image_urls, save_dir, max_concurrent=max_concurrent)
    
    # 第三步：整合结果
    result_images = []
    for i, img in enumerate(images):
        if img['src'].startswith('data:'):
            result_images.append({
                **img,
                'local_path': None,
                'downloaded': False
            })
        else:
            idx = [j for j, orig_img in enumerate(images[:i+1]) if not orig_img['src'].startswith('data:')][-1]
            result_images.append({
                **img,
                'local_path': downloaded_paths[idx] if idx < len(downloaded_paths) else None,
                'downloaded': downloaded_paths[idx] is not None if idx < len(downloaded_paths) else False
            })
    
    downloaded_count = len([p for p in downloaded_paths if p is not None])
    failed_count = len(image_urls) - downloaded_count
    
    return {
        'total': len(images),
        'downloaded': downloaded_count,
        'failed': failed_count,
        'images': result_images
    }


# 使用示例
if __name__ == "__main__":
    # 测试用例1: 仅获取图片信息
    # test_url = "https://leetcode.cn/discuss/post/3141566/ru-he-ke-xue-shua-ti-by-endlesscheng-q3yd/"
    test_url="https://blog.csdn.net/MysticOrigin/article/details/136440209"
    
    print("测试1: 获取网页图片信息")
    images = asyncio.run(fetch_webpage_images(test_url))
    if images:
        print(f"找到 {len(images)} 张图片:")
        for i, img in enumerate(images[:5], 1):  # 只显示前5张
            print(f"  {i}. {img['src']}")
            if img['alt']:
                print(f"     Alt: {img['alt']}")
    
    print("\n" + "="*50 + "\n")
    
    # # 测试用例2: 下载单张图片
    # if images and len(images) > 0:
    #     print("测试2: 下载单张图片")
    #     first_image_url = images[0]['src']
    #     if not first_image_url.startswith('data:'):
    #         filepath = asyncio.run(download_image(first_image_url, "./test_images"))
    #         if filepath:
    #             print(f"图片已保存到: {filepath}")
    
    # print("\n" + "="*50 + "\n")
    
    # # 测试用例3: 批量下载图片
    # print("测试3: 批量下载前3张图片")
    # if images:
    #     image_urls = [img['src'] for img in images[:3] if not img['src'].startswith('data:')]
    #     if image_urls:
    #         paths = asyncio.run(batch_download_images(image_urls, "./test_images"))
    #         print(f"成功下载 {len([p for p in paths if p])} 张图片")
    
    # print("\n" + "="*50 + "\n")
    
    # # 测试用例4: 一站式抓取并下载
    # print("测试4: 一站式抓取并下载")
    # result = asyncio.run(fetch_and_download_webpage_images(
    #     test_url,
    #     "./test_images_batch",
    #     max_concurrent=3
    # ))
    # print(f"总计: {result['total']} 张图片")
    # print(f"成功: {result['downloaded']} 张")
    # print(f"失败: {result['failed']} 张")

