import httpx
from log import logger
import asyncio
from typing import Any, Dict, List, Optional

async def fetch_jina_summary(url: str) -> Optional[str]:
    """
    调用 Jina API 获取指定 URL 的内容摘要（Markdown 格式）。

    Args:
        url (str): 需要摘要的网页 URL

    Returns:
        Optional[str]: Jina API 返回的摘要内容（Markdown 格式），失败时返回 None

    Raises:
        ValueError: 如果 URL 为空或格式不正确

    Example:
        >>> summary = await fetch_jina_summary("https://damek.github.io/random/basic-idea-behind-flash-attention/")
        >>> print(summary)
    """
    if not url or not isinstance(url, str):
        raise ValueError("参数 url 不能为空且必须为字符串类型。")

    # headers: Dict[str, str] = {
    # 'Accept': 'application/json',
    # 'Content-Type': 'application/json',
    # 'X-Return-Format': 'text',
    # 'X-Timeout': '25'
    # }
    headers = {
    'Accept': 'application/json',
    'X-Return-Format': 'text',
    'X-Timeout': '10'
}

    data: Dict[str, Any] = {
        "url": url
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # response = await client.post('https://r.jina.ai/', headers=headers, json=data)
            response = await client.get(f"https://r.jina.ai/{url}", headers=headers)
        response.raise_for_status()
        return response.json()
    except (httpx.TimeoutException, httpx.ReadTimeout) as e:
        logger.warning(f"Jina API 超时 for URL {url}: {e}")
        return None
    except httpx.RequestError as e:
        logger.error(f"请求 Jina API 失败 for URL {url}: {e}")
        return None
    except Exception as e:
        logger.error(f"处理 Jina API 响应时发生未知错误 for URL {url}: {e}")
        return None

async def batch_fetch_jina_summary(contexts: List[tuple[str,str,str]]) -> List[Any]:
    """
    批量获取多个URL的摘要，失败的URL返回包含错误信息的字典
    
    Args:
        contexts: 包含 (url, content, title) 元组的列表
        
    Returns:
        List[Any]: 摘要列表，失败的位置为包含错误信息的字典
    """
    # Don't hammer the server. Control your concurrency.
    semaphore = asyncio.Semaphore(4)

    async def fetch_with_limit(url: str):
        async with semaphore:
            return await fetch_jina_summary(url)

    tasks = [fetch_with_limit(context[0]) for context in contexts]
    # 使用 return_exceptions=True 让失败的任务返回异常而不是崩溃整个批次
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # 处理异常结果
    processed_results = []
    for i, result in enumerate(results):
        url, content, title = contexts[i]
        if isinstance(result, Exception):
            logger.error(f"URL {url} 处理时发生意外异常: {result}", exc_info=True)
            processed_results.append({"code": 500, "data": {"text": content, "url": url, "title": title}})
        elif result is None:
            # fetch_jina_summary already logs the specific error (e.g., timeout)
            logger.warning(f"URL {url} 获取摘要失败，详见先前日志。")
            processed_results.append({"code": 500, "data": {"text": content, "url": url, "title": title}})
        else:
            processed_results.append(result)
    return processed_results

# 使用示例
if __name__ == "__main__":
    # test_url = "https://damek.github.io/random/basic-idea-behind-flash-attention/"
    # test_url="https://www.explinks.com/blog/summary-of-large-model-techniques/"
    test_url_1="https://www.analyticsvidhya.com/blog/2025/02/llm-pre-training/"
    # test_url="https://zhuanlan.zhihu.com/p/1948702636401463355"
    test_url_2="https://www.datacamp.com/tutorial/fine-tuning-large-language-models"
    test_url_3="https://medium.com/@nimritakoul01/a-comprehensive-guide-to-large-language-model-applications-with-hugging-face-7da9085c0c19"
    batch_urls = [(test_url_1,"content_1", "title_1"),(test_url_2,"content_2", "title_2"),(test_url_3,"content_3", "title_3")]
    try:
        summary = asyncio.run(batch_fetch_jina_summary(batch_urls))
        print(summary)
    except Exception as e:
        print(f"获取摘要失败: {e}")
    # print(asyncio.run(fetch_jina_summary(test_url)))
    