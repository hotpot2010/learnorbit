"""
快速检查笔记端点是否可用
"""
import requests


def check_endpoint():
    """检查笔记端点"""
    
    # 检查服务器是否运行
    try:
        response = requests.get("http://localhost:8000/")
        print(f"✅ Server is running (status: {response.status_code})")
    except requests.exceptions.ConnectionError:
        print("❌ Server is not running!")
        print("💡 Please start the server first: python main.py")
        return
    
    # 检查笔记端点
    test_url = "http://localhost:8000/notes/generate"
    print(f"\n🔍 Checking notes endpoint: {test_url}")
    
    test_data = {
        "knowledge_point_name": "测试",
        "transcript_segment": "测试内容",
        "video_title": "测试视频"
    }
    
    try:
        response = requests.post(test_url, json=test_data, timeout=10)
        
        print(f"📡 Response status: {response.status_code}")
        
        if response.status_code == 404:
            print("❌ Endpoint not found (404)")
            print("💡 The /notes/generate endpoint is not available")
            print("💡 Please check if notes.py is correctly registered in main.py")
        elif response.status_code == 200:
            print("✅ Endpoint is available!")
            data = response.json()
            if data.get('success'):
                print(f"✅ Note generated: {data.get('note')[:50]}...")
            else:
                print(f"⚠️ Note generation failed: {data.get('error')}")
        else:
            print(f"⚠️ Unexpected status: {response.status_code}")
            print(f"Response: {response.text[:200]}")
            
    except requests.exceptions.Timeout:
        print("❌ Request timeout (LLM might be slow)")
    except Exception as e:
        print(f"❌ Error: {e}")


if __name__ == "__main__":
    print("🧪 Checking Notes Endpoint\n")
    check_endpoint()
    print("\n✅ Check completed")

