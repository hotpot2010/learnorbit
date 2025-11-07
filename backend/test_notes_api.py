"""
测试笔记生成API
"""
import asyncio
import aiohttp
import json


async def test_notes_api():
    """测试笔记生成API"""
    
    url = "http://localhost:8000/notes/generate"
    
    test_data = {
        "knowledge_point_name": "测试知识点",
        "transcript_segment": "[00:00 - 00:10] 这是一个测试视频的逐字稿内容。\n[00:10 - 00:20] 我们正在测试笔记生成功能。",
        "video_title": "测试视频"
    }
    
    print("🧪 Testing Notes Generation API")
    print(f"📍 URL: {url}")
    print(f"📦 Request data: {json.dumps(test_data, ensure_ascii=False, indent=2)}")
    print("\n" + "="*50 + "\n")
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=test_data) as response:
                print(f"📡 Response status: {response.status}")
                print(f"📋 Response headers: {dict(response.headers)}")
                
                if response.status == 200:
                    data = await response.json()
                    print(f"\n✅ API Response:")
                    print(json.dumps(data, ensure_ascii=False, indent=2))
                    
                    if data.get('success'):
                        print(f"\n🎉 Note generated successfully!")
                        print(f"📝 Note content:\n{data.get('note')}")
                    else:
                        print(f"\n❌ Note generation failed:")
                        print(f"Error: {data.get('error')}")
                else:
                    text = await response.text()
                    print(f"\n❌ API request failed:")
                    print(f"Status: {response.status}")
                    print(f"Response: {text}")
                    
    except aiohttp.ClientError as e:
        print(f"❌ Network error: {e}")
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    print("🚀 Starting Notes API Test\n")
    asyncio.run(test_notes_api())
    print("\n✅ Test completed")

