"""
API testing script
"""
import requests
import json
import time

BASE_URL = "http://localhost:8000"

def test_health_check():
    """Test health check endpoint"""
    print("🔍 Testing health check...")
    try:
        response = requests.get(f"{BASE_URL}/api/v1/video/health")
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ Health check failed: {e}")
        return False

def test_analysis_types():
    """Test analysis types endpoint"""
    print("\n🔍 Testing analysis types...")
    try:
        response = requests.get(f"{BASE_URL}/api/v1/video/analysis-types")
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
        return response.status_code == 200
    except Exception as e:
        print(f"❌ Analysis types test failed: {e}")
        return False

def test_video_analysis(video_path: str):
    """Test video analysis by path"""
    print(f"\n🔍 Testing video analysis for: {video_path}")
    try:
        data = {
            "video_path": video_path,
            "analysis_type": "summary"
        }
        response = requests.post(f"{BASE_URL}/api/v1/video/analyze-by-path", json=data)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"Success: {result.get('success')}")
            print(f"Processing time: {result.get('processing_time', 0):.2f}s")
            if result.get('result'):
                content = result['result'].get('content', '')
                print(f"Analysis preview: {content[:200]}...")
        else:
            print(f"Error: {response.text}")
        
        return response.status_code == 200
    except Exception as e:
        print(f"❌ Video analysis test failed: {e}")
        return False

def main():
    """Run all tests"""
    print("🧪 Starting API Tests")
    print("=" * 50)
    
    # Test basic endpoints
    health_ok = test_health_check()
    types_ok = test_analysis_types()
    
    # Test video analysis if you have a test video
    # Uncomment and provide a valid video path to test
    # video_ok = test_video_analysis("/path/to/your/test/video.mp4")
    
    print("\n" + "=" * 50)
    print("📊 Test Results:")
    print(f"Health Check: {'✅' if health_ok else '❌'}")
    print(f"Analysis Types: {'✅' if types_ok else '❌'}")
    # print(f"Video Analysis: {'✅' if video_ok else '❌'}")
    
    if health_ok and types_ok:
        print("\n🎉 Basic API tests passed!")
        print("💡 To test video analysis, uncomment the video test in main() and provide a video path")
    else:
        print("\n❌ Some tests failed. Check server logs for details.")

if __name__ == "__main__":
    main()
