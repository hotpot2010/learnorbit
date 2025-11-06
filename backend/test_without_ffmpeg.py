#!/usr/bin/env python3
"""
测试无 FFmpeg 环境下的视频下载（使用 best 格式）
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.bilibili_service import BilibiliService

def test_without_ffmpeg():
    """测试无 FFmpeg 时是否能下载有音频的视频"""
    print("=" * 60)
    print("🎬 测试无 FFmpeg 环境下的视频下载")
    print("=" * 60)
    
    service = BilibiliService()
    
    # 测试视频（较短，易于测试）
    test_url = "https://www.bilibili.com/video/BV1Jgf6YvE8e?p=1"
    
    print(f"\n📹 测试视频: {test_url}")
    print("\n🔍 预期结果:")
    print("  ✅ 使用 'best' 格式下载")
    print("  ✅ 无需 FFmpeg 合并")
    print("  ✅ 文件包含音频（如果源视频有音频）")
    print("\n💡 注意:")
    print("  - 如果视频本身无音频，下载的文件也会无音频")
    print("  - 某些视频可能只提供分离的音视频流（需要 FFmpeg）")
    print("\n" + "=" * 60)
    
    try:
        print("\n📥 开始下载...")
        result = service.download_video(test_url, output_filename="test_no_ffmpeg")
        
        print("\n" + "=" * 60)
        print("✅ 下载成功!")
        print("=" * 60)
        print(f"📁 文件路径: {result['file_path']}")
        print(f"📦 文件大小: {result['file_size']:,} bytes ({result['file_size'] / 1024 / 1024:.2f} MB)")
        print(f"🎬 视频标题: {result['title']}")
        
        if 'download_strategy' in result:
            print(f"📊 下载策略: {result['download_strategy']}")
        
        print("\n💡 验证方法:")
        print(f"  1. 播放文件: {result['file_path']}")
        print(f"  2. 检查是否有声音")
        print(f"  3. 如果有声音 → ✅ 成功!")
        print(f"  4. 如果无声音 → ⚠️ 需要安装 FFmpeg")
        
        return True
        
    except Exception as e:
        print("\n" + "=" * 60)
        print("❌ 测试失败!")
        print("=" * 60)
        print(f"错误: {str(e)}")
        print("\n💡 如果错误提示需要 FFmpeg:")
        print("  → 请安装 FFmpeg 或更换其他视频测试")
        return False

if __name__ == "__main__":
    success = test_without_ffmpeg()
    sys.exit(0 if success else 1)


