"""
API 转发服务测试脚本
"""
import httpx
import json
import asyncio

BASE_URL = "http://localhost:8001"

async def test_health():
    """测试健康检查"""
    print("\n" + "="*60)
    print("🔍 测试健康检查")
    print("="*60)
    
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BASE_URL}/health")
        print(f"状态码: {response.status_code}")
        print(f"响应: {response.json()}")
        assert response.status_code == 200

async def test_asr_create():
    """测试 ASR 创建任务"""
    print("\n" + "="*60)
    print("🔍 测试 ASR 创建任务")
    print("="*60)
    
    payload = {
        "contentType": 2,
        "bizId": "test",
        "content": json.dumps({"audioList": ["http://file.gsxservice.com/test_audio.mp4"]}),
        "contentScenario": 9,
        "contentSource": "test",
        "creator": "test_user"
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{BASE_URL}/asr/create",
            json=payload
        )
        print(f"状态码: {response.status_code}")
        print(f"响应: {response.json()}")

async def test_llm_chat():
    """测试 LLM 聊天"""
    print("\n" + "="*60)
    print("🔍 测试 LLM 聊天")
    print("="*60)
    
    payload = {
        "model": "claude-4.5-sonnet",
        "messages": [
            {
                "role": "user",
                "content": "你好，请用一句话介绍Python"
            }
        ],
        "temperature": 0.7
    }
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{BASE_URL}/llm/chat",
            json=payload
        )
        print(f"状态码: {response.status_code}")
        print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")

async def test_root():
    """测试根路径"""
    print("\n" + "="*60)
    print("🔍 测试根路径")
    print("="*60)
    
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BASE_URL}/")
        print(f"状态码: {response.status_code}")
        print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")

async def main():
    """运行所有测试"""
    print("🚀 开始测试 API 转发服务")
    
    try:
        await test_root()
        await test_health()
        await test_llm_chat()
        # await test_asr_create()  # 需要有效的音频 URL
        
        print("\n" + "="*60)
        print("✅ 所有测试通过!")
        print("="*60)
        
    except Exception as e:
        print("\n" + "="*60)
        print(f"❌ 测试失败: {e}")
        print("="*60)
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())


