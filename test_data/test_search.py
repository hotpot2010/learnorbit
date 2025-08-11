import json
import asyncio
import httpx

BASE_URL = "https://study-platform.zeabur.app"  # 根据实际情况调整服务器地址和端口

async def test_web_search():
    """测试 web 搜索 API"""
    print("\n=== 测试 Web 搜索 API ===")
    
    # 中文搜索测试
    zh_payload = {
        "search_keyword": "人工智能最新发展",
        "lang": "zh"
    }
    
    # 英文搜索测试
    en_payload = {
        "search_keyword": "artificial intelligence latest developments",
        "lang": "en"
    }
    
    async with httpx.AsyncClient() as client:
        # 测试中文搜索
        print("测试中文搜索...")
        zh_response = await client.post(
            f"{BASE_URL}/api/web/search",
            json=zh_payload,
            timeout=30.0
        )
        
        if zh_response.status_code == 200:
            zh_result = zh_response.json()
            print(zh_result)
            print(f"中文搜索成功! 获取到 {len(zh_result['web_res']['results'])} 个结果")
            # 打印部分结果示例
            if zh_result['web_res']['results']:
                print(f"第一个结果标题: {zh_result['web_res']['results'][0].get('title', 'No title')}")
        else:
            print(f"中文搜索失败! 状态码: {zh_response.status_code}")
            print(f"错误信息: {zh_response.text}")
        
        # 测试英文搜索
        print("\n测试英文搜索...")
        en_response = await client.post(
            f"{BASE_URL}/api/web/search",
            json=en_payload,
            timeout=30.0
        )
        
        if en_response.status_code == 200:
            en_result = en_response.json()
            print(en_result)
            print(f"英文搜索成功! 获取到 {len(en_result['web_res']['results'])} 个结果")
            # 打印部分结果示例
            if en_result['web_res']['results']:
                print(f"第一个结果标题: {en_result['web_res']['results'][0].get('title', 'No title')}")
        else:
            print(f"英文搜索失败! 状态码: {en_response.status_code}")
            print(f"错误信息: {en_response.text}")


async def test_video_search():
    """测试视频搜索 API"""
    print("\n=== 测试视频搜索 API ===")
    
    # 中文搜索测试
    zh_payload = {
        "search_keyword": "Python教程初学者",
        "lang": "zh"
    }
    
    # 英文搜索测试
    en_payload = {
        "search_keyword": "Python tutorial for beginners",
        "lang": "en"
    }
    
    async with httpx.AsyncClient() as client:
        # 测试中文搜索
        print("测试中文视频搜索...")
        zh_response = await client.post(
            f"{BASE_URL}/api/video/search",
            json=zh_payload,
            timeout=30.0
        )
        
        if zh_response.status_code == 200:
            zh_result = zh_response.json()
            print(zh_result)
            video_count = len(zh_result['video_res']) if isinstance(zh_result['video_res'], list) else 0
            print(f"中文视频搜索成功! 获取到 {video_count} 个结果")
            # 打印部分结果示例
            if video_count > 0:
                print(f"第一个视频标题: {zh_result['video_res'][0].get('title', 'No title')}")
        else:
            print(f"中文视频搜索失败! 状态码: {zh_response.status_code}")
            print(f"错误信息: {zh_response.text}")
        
        # 测试英文搜索
        print("\n测试英文视频搜索...")
        en_response = await client.post(
            f"{BASE_URL}/api/video/search",
            json=en_payload,
            timeout=30.0
        )
        
        if en_response.status_code == 200:
            en_result = en_response.json()
            print(en_result)
            video_count = len(en_result['video_res']) if isinstance(en_result['video_res'], list) else 0
            print(f"英文视频搜索成功! 获取到 {video_count} 个结果")
            # 打印部分结果示例
            if video_count > 0:
                print(f"第一个视频标题: {en_result['video_res'][0].get('title', 'No title')}")
        else:
            print(f"英文视频搜索失败! 状态码: {en_response.status_code}")
            print(f"错误信息: {en_response.text}")


async def run_tests():
    """运行所有测试"""
    await test_web_search()
    await test_video_search()


if __name__ == "__main__":
    print("开始测试搜索 API...")
    asyncio.run(run_tests())
    print("\n所有测试完成!") 