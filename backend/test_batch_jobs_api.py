"""
测试批量分析API
"""
import requests
import json

# 测试创建任务
try:
    print("🔍 测试批量分析API...")
    print("📤 请求 URL: http://localhost:8000/batch/jobs")
    
    payload = {
        "video_urls": ["https://www.bilibili.com/video/BV1Jgf6YvE8e?p=3"],
        "prompt": "提取视频中的知识点",
        "job_name": "测试任务"
    }
    
    print(f"📦 请求数据: {json.dumps(payload, indent=2, ensure_ascii=False)}")
    
    response = requests.post(
        'http://localhost:8000/batch/jobs',
        json=payload,
        timeout=10
    )
    
    print(f"\n📡 响应状态: {response.status_code} {response.reason}")
    print(f"📦 响应头: {dict(response.headers)}")
    
    try:
        data = response.json()
        print(f"\n✅ 响应数据:")
        print(json.dumps(data, indent=2, ensure_ascii=False))
        
        if data.get('success') and data.get('job_id'):
            print(f"\n🎉 任务创建成功!")
            print(f"Job ID: {data['job_id']}")
        else:
            print(f"\n❌ 任务创建失败!")
            if 'error' in data:
                print(f"错误信息: {data['error']}")
    except json.JSONDecodeError as e:
        print(f"\n❌ 响应不是有效的JSON:")
        print(f"原始响应: {response.text[:500]}")
        
except requests.exceptions.ConnectionError:
    print("\n❌ 无法连接到后端服务器")
    print("💡 请确保后端服务正在运行:")
    print("   cd backend")
    print("   .\\venv\\Scripts\\Activate.ps1")
    print("   python main.py")
except requests.exceptions.Timeout:
    print("\n❌ 请求超时")
    print("💡 后端服务可能响应缓慢，请检查日志")
except Exception as e:
    print(f"\n❌ 发生异常: {type(e).__name__}")
    print(f"错误信息: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "="*50)
print("测试完成")

