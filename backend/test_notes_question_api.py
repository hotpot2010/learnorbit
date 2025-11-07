"""
测试提问API
"""
import requests
import json

# 测试API是否存在
try:
    response = requests.post(
        'http://localhost:8000/notes/answer-question',
        json={
            "question": "什么是Python环境变量？",
            "knowledge_point_name": "测试知识点",
            "transcript_segment": "这是一段测试逐字稿",
            "video_title": "测试视频",
            "video_url": "https://test.com"
        },
        timeout=10
    )
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
    
except requests.exceptions.ConnectionError:
    print("❌ 无法连接到后端服务器")
    print("💡 请确保后端服务正在运行: python main.py")
except Exception as e:
    print(f"❌ 错误: {e}")

