import time
from duckduckgo_search import DDGS
from typing import Dict, List, Optional


def search_web(
    query: str,
    max_results: int = 5,
    region: str = "wt-wt",
    safesearch: str = "moderate"
) -> Dict[str, any]:
    """
    根据关键词搜索网页并返回适配 TavilyClient 格式的结果
    
    Args:
        query: 搜索关键词
        max_results: 最大返回结果数
        region: 地区代码（如 "us-en"、"cn-zh" 等）
        safesearch: 安全搜索级别（"on"、"moderate"、"off"）
    
    Returns:
        符合指定格式的搜索结果字典
    """
    start_time = time.time()
    results = []
    answer = ""
    
    try:
        # 初始化搜索客户端
        ddgs = DDGS()
        
        # 执行网页搜索
        search_results = ddgs.text(
            keywords=query,
            region=region,
            safesearch=safesearch,
            max_results=max_results
        )
        
        # 处理搜索结果
        if search_results:
            # 构建结果列表
            for item in search_results:
                results.append({
                    "url": item.get("href", ""),
                    "title": item.get("title", ""),
                    "content": item.get("body", ""),
                    "score": None,  # duckduckgo 搜索结果无评分
                    "raw_content": None
                })
            
            # 生成简单回答（拼接前3条结果内容）
            answer_parts = [item["content"] for item in results[:3] if item["content"]]
            answer = " ".join(answer_parts)[:500] + "..." if answer_parts else "No relevant results found."
    
    except Exception as e:
        answer = f"Search error: {str(e)}"
    
    # 计算响应时间
    response_time = round(time.time() - start_time, 3)
    
    return {
        "query": query,
        "follow_up_questions": None,
        "answer": answer,
        "images": [],  # 网页搜索无图片结果，返回空列表
        "results": results,
        "response_time": response_time
    }


# 使用示例
if __name__ == "__main__":
    result = search_web(
        query="人工智能最新发展",
        max_results=3,
        region="cn-zh",
        safesearch="off"
    )
    print(result)