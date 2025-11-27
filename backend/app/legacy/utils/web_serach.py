# To install: pip install tavily-python
from tavily import TavilyClient
import asyncio
import os
from log import logger
# from apollo import get_tavily_api_key
client = TavilyClient(os.getenv("TAVILY_API_KEY"))
async def web_search(query):
    try:
        response = client.search(
        query=query,
        time_range="year",
        include_images=True,
        include_image_descriptions=True
        )
    except Exception as e:
        logger.error(f"[Web Search] 获取图片与资料推荐失败: {e}",exc_info=True)
        return {"query": query, "follow_up_questions": None, "answer": None, "images": [], "results": [],"response_time": -1}
    return response

if __name__ == "__main__":
    response = asyncio.run(web_search("python"))
    print(response)