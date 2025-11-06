"""
Debug script to check available formats for a specific Bilibili video
"""
import sys
from app.services.bilibili_service import BilibiliService

def main():
    # The problematic video URL
    test_url = "https://www.bilibili.com/video/BV1Jgf6YvE8e"
    
    print("="*60)
    print("🔍 Bilibili Video Format Debugger")
    print("="*60)
    print(f"\nTesting video: {test_url}\n")
    
    service = BilibiliService()
    
    # Step 1: Extract video info
    print("📋 Step 1: Extracting video information...")
    try:
        info = service.extract_video_info(test_url)
        print(f"✅ Video Info:")
        print(f"   Title: {info.get('title', 'N/A')}")
        print(f"   BV ID: {info.get('bv_id', 'N/A')}")
        print(f"   Duration: {info.get('duration', 0)} seconds")
        print(f"   Uploader: {info.get('uploader', 'N/A')}")
    except Exception as e:
        print(f"❌ Failed to extract info: {e}")
        return
    
    # Step 2: List available formats
    print(f"\n📊 Step 2: Listing available formats...")
    try:
        formats = service.list_available_formats(test_url)
        
        if not formats:
            print("⚠️  No formats found or failed to list formats")
        else:
            print(f"✅ Found {len(formats)} available formats:\n")
            
            # Group by type
            video_formats = [f for f in formats if f['vcodec'] != 'none']
            audio_formats = [f for f in formats if f['acodec'] != 'none' and f['vcodec'] == 'none']
            
            if video_formats:
                print("📹 Video Formats:")
                for fmt in video_formats[:10]:  # Show first 10
                    size = fmt.get('filesize', 0)
                    size_str = f"{size / 1024 / 1024:.1f}MB" if size > 0 else "Unknown"
                    print(f"   ID: {fmt['format_id']:8} | Ext: {fmt['ext']:5} | "
                          f"Resolution: {fmt['resolution']:12} | Size: {size_str:10} | "
                          f"Codec: {fmt['vcodec']}")
            
            if audio_formats:
                print("\n🔊 Audio Formats:")
                for fmt in audio_formats[:5]:  # Show first 5
                    size = fmt.get('filesize', 0)
                    size_str = f"{size / 1024 / 1024:.1f}MB" if size > 0 else "Unknown"
                    print(f"   ID: {fmt['format_id']:8} | Ext: {fmt['ext']:5} | "
                          f"Size: {size_str:10} | Codec: {fmt['acodec']}")
    except Exception as e:
        print(f"❌ Failed to list formats: {e}")
    
    # Step 3: Try downloading with updated method
    print(f"\n📥 Step 3: Attempting download with updated method...")
    print("(This will actually download the video)")
    
    choice = input("\n⚠️  Continue with download? (y/n): ").strip().lower()
    
    if choice == 'y':
        try:
            result = service.download_video(test_url, output_filename="test_video")
            
            print(f"\n✅ Download successful!")
            print(f"   File path: {result['file_path']}")
            print(f"   File size: {result['file_size'] / 1024 / 1024:.1f}MB")
            print(f"   Duration: {result['duration']} seconds")
            
            # Ask if user wants to clean up
            cleanup = input("\n🗑️  Delete downloaded file? (y/n): ").strip().lower()
            if cleanup == 'y':
                service.cleanup_video(result['file_path'])
                print("✅ File deleted")
            else:
                print(f"💾 File kept at: {result['file_path']}")
                
        except Exception as e:
            print(f"\n❌ Download failed: {e}")
            print("\n💡 Suggestions:")
            print("   1. This video might be region-locked")
            print("   2. The video might require login/authentication")
            print("   3. The video format might be incompatible")
            print("   4. Try updating yt-dlp: pip install --upgrade yt-dlp")
    else:
        print("⏭️  Download skipped")
    
    print("\n" + "="*60)
    print("🎉 Debug complete!")
    print("="*60)

if __name__ == "__main__":
    main()


