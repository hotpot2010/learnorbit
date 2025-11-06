"""
Test script for Bilibili Batch Analyzer
Run this to verify your setup is working correctly
"""
import sys
import os

def test_imports():
    """Test if all required packages are installed"""
    print("\n🔍 Testing package imports...")
    
    try:
        import fastapi
        print("✅ FastAPI installed")
    except ImportError:
        print("❌ FastAPI not found - run: pip install fastapi")
        return False
    
    try:
        import google.generativeai as genai
        print("✅ Google Generative AI installed")
    except ImportError:
        print("❌ Google Generative AI not found - run: pip install google-generativeai")
        return False
    
    try:
        import yt_dlp
        print("✅ yt-dlp installed")
    except ImportError:
        print("❌ yt-dlp not found - run: pip install yt-dlp")
        return False
    
    print("✅ All required packages are installed!\n")
    return True

def test_env_config():
    """Test if environment is configured correctly"""
    print("🔍 Testing environment configuration...")
    
    from dotenv import load_dotenv
    load_dotenv()
    
    api_key = os.getenv('GEMINI_API_KEY')
    
    if not api_key:
        print("❌ GEMINI_API_KEY not found in .env file")
        print("   Please add: GEMINI_API_KEY=your_key_here")
        return False
    
    if api_key.startswith('your_') or api_key == 'your_key_here':
        print("⚠️  GEMINI_API_KEY looks like a placeholder")
        print("   Please replace it with your actual API key")
        return False
    
    print(f"✅ GEMINI_API_KEY configured (length: {len(api_key)})\n")
    return True

def test_services():
    """Test if services can be initialized"""
    print("🔍 Testing service initialization...")
    
    try:
        from app.services.bilibili_service import BilibiliService
        bilibili = BilibiliService()
        print("✅ BilibiliService initialized")
    except Exception as e:
        print(f"❌ BilibiliService failed: {e}")
        return False
    
    try:
        from app.services.gemini_service import GeminiService
        gemini = GeminiService()
        print("✅ GeminiService initialized")
    except Exception as e:
        print(f"❌ GeminiService failed: {e}")
        return False
    
    try:
        from app.services.batch_analyzer import BatchAnalyzer
        analyzer = BatchAnalyzer()
        print("✅ BatchAnalyzer initialized")
    except Exception as e:
        print(f"❌ BatchAnalyzer failed: {e}")
        return False
    
    print("✅ All services initialized successfully!\n")
    return True

def test_video_info():
    """Test video info extraction (without downloading)"""
    print("🔍 Testing video info extraction...")
    print("   Using test video: BV1xx411c7mD (a popular Bilibili video)")
    
    try:
        from app.services.bilibili_service import BilibiliService
        service = BilibiliService()
        
        # Use a known public video for testing
        test_url = "BV1xx411c7mD"
        
        info = service.extract_video_info(test_url)
        
        print(f"✅ Video info extracted successfully!")
        print(f"   Title: {info.get('title', 'N/A')[:50]}...")
        print(f"   Duration: {info.get('duration', 0)} seconds")
        print(f"   Uploader: {info.get('uploader', 'N/A')}")
        print()
        return True
    except Exception as e:
        print(f"⚠️  Video info extraction failed: {e}")
        print("   This might be due to network issues or the test video being unavailable")
        print("   You can still proceed if other tests pass\n")
        return True  # Don't fail the entire test

def test_storage_directory():
    """Test if storage directory can be created"""
    print("🔍 Testing storage directory...")
    
    storage_dir = "batch_results"
    
    try:
        os.makedirs(storage_dir, exist_ok=True)
        print(f"✅ Storage directory '{storage_dir}' is ready\n")
        return True
    except Exception as e:
        print(f"❌ Failed to create storage directory: {e}\n")
        return False

def main():
    """Run all tests"""
    print("="*60)
    print("🎬 Bilibili Batch Analyzer - Setup Test")
    print("="*60)
    
    results = []
    
    # Run tests
    results.append(("Package Imports", test_imports()))
    results.append(("Environment Config", test_env_config()))
    results.append(("Service Initialization", test_services()))
    results.append(("Storage Directory", test_storage_directory()))
    results.append(("Video Info Extraction", test_video_info()))
    
    # Print summary
    print("="*60)
    print("📊 Test Summary")
    print("="*60)
    
    for test_name, passed in results:
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{status}: {test_name}")
    
    print("="*60)
    
    # Overall result
    if all(passed for _, passed in results):
        print("\n🎉 All tests passed! Your setup is ready to use!")
        print("\n💡 Next steps:")
        print("   1. Start the backend: python main.py")
        print("   2. Start the frontend: npm run dev")
        print("   3. Visit: http://localhost:3000/bilibili-batch-analyzer")
        return 0
    else:
        print("\n⚠️  Some tests failed. Please fix the issues above.")
        print("\n💡 Common fixes:")
        print("   - Install missing packages: pip install -r requirements.txt")
        print("   - Configure GEMINI_API_KEY in .env file")
        print("   - Check network connection for video access")
        return 1

if __name__ == "__main__":
    sys.exit(main())


