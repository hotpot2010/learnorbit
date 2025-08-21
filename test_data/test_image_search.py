#!/usr/bin/env python3
"""
测试 /api/image/search API
"""
import asyncio
import aiohttp
import json

async def test_image_search_api():
    """测试图片搜索功能"""
    url = "http://172.30.116.44:5001/api/image/search"
    data = {
        "search_keyword": "apple company",
        "lang": "en"
    }
    
    print("=== 测试图片搜索 API ===")
    print(f"请求 URL: {url}")
    print(f"请求数据: {json.dumps(data, indent=2)}")
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                url,
                json=data,
                headers={'Content-Type': 'application/json'}
            ) as response:
                print(f"响应状态码: {response.status}")
                
                if response.status == 200:
                    response_json = await response.json()
                    print("响应内容:")
                    print(json.dumps(response_json, indent=2, ensure_ascii=False))
                else:
                    error_text = await response.text()
                    print(f"请求失败: {error_text}")
                    
    except Exception as e:
        print(f"请求过程中发生错误: {e}")

if __name__ == "__main__":
    print("开始测试图片搜索 API...")
    
    asyncio.run(test_image_search_api())
    
    print("\n测试完成！") 