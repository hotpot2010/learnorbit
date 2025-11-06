"""
Quick test for the problematic video
"""
from app.services.bilibili_service import BilibiliService

def main():
    # The video that was causing issues
    url = "https://www.bilibili.com/video/BV1Jgf6YvE8e"
    
    print("="*60)
    print("🧪 Testing Problematic Video")
    print("="*60)
    print(f"URL: {url}\n")
    
    service = BilibiliService()
    
    # Test 1: Extract info (should always work)
    print("Test 1: Extracting video info...")
    try:
        info = service.extract_video_info(url)
        print(f"✅ Success!")
        print(f"   Title: {info['title'][:50]}...")
        print(f"   Duration: {info['duration']}s")
        print(f"   Views: {info['view_count']:,}")
    except Exception as e:
        print(f"❌ Failed: {e}")
        return
    
    # Test 2: List formats (diagnostic)
    print("\nTest 2: Listing available formats...")
    try:
        formats = service.list_available_formats(url)
        if formats:
            print(f"✅ Found {len(formats)} formats")
            # Show a few examples
            for fmt in formats[:3]:
                print(f"   - {fmt['format_id']}: {fmt['ext']} {fmt['resolution']}")
        else:
            print("⚠️  No formats found")
    except Exception as e:
        print(f"⚠️  Format listing failed: {e}")
    
    # Test 3: Attempt download
    print("\nTest 3: Attempting download...")
    print("⚠️  This will download the video (may take time)")
    
    choice = input("Continue? (y/n): ").strip().lower()
    
    if choice != 'y':
        print("⏭️  Skipped")
        return
    
    try:
        result = service.download_video(url, output_filename="test_problematic")
        
        print(f"\n✅ DOWNLOAD SUCCESSFUL!")
        print(f"   Path: {result['file_path']}")
        print(f"   Size: {result['file_size'] / 1024 / 1024:.2f} MB")
        print(f"   Duration: {result['duration']}s")
        
        # Cleanup
        cleanup = input("\nDelete downloaded file? (y/n): ").strip().lower()
        if cleanup == 'y':
            service.cleanup_video(result['file_path'])
            print("✅ Cleaned up")
        
    except Exception as e:
        print(f"\n❌ DOWNLOAD FAILED: {e}")
        print("\n💡 Possible reasons:")
        print("   - Video requires authentication (Cookie)")
        print("   - Region locked")
        print("   - Format incompatibility")
        print("\nSee TROUBLESHOOTING_BILIBILI.md for solutions")
    
    print("\n" + "="*60)
    print("Test complete!")
    print("="*60)

if __name__ == "__main__":
    main()


