#!/usr/bin/env python3
"""
测试音视频合并修复
"""
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.bilibili_service import BilibiliService

def test_audio_merge():
    """测试之前无音频的视频现在是否有音频"""
    print("=" * 60)
    print("🎬 测试音视频合并修复")
    print("=" * 60)
    
    service = BilibiliService()
    
    # 使用之前无音频的视频
    test_url = "https://www.bilibili.com/video/BV1Jgf6YvE8e?p=1"
    
    print(f"\n📹 测试视频: {test_url}")
    print("\n🔍 预期结果:")
    print("  ✅ 下载成功")
    print("  ✅ 格式选择: bestvideo+bestaudio")
    print("  ✅ 音视频已合并")
    print("\n" + "=" * 60)
    
    try:
        # 下载视频
        print("\n📥 开始下载...")
        result = service.download_video(test_url, output_filename="test_audio_merge")
        
        print("\n" + "=" * 60)
        print("✅ 下载成功!")
        print("=" * 60)
        print(f"📁 文件路径: {result['file_path']}")
        print(f"📦 文件大小: {result['file_size']:,} bytes ({result['file_size'] / 1024 / 1024:.2f} MB)")
        print(f"🎬 视频标题: {result['title']}")
        print(f"⏱️  视频时长: {result['duration']}秒")
        
        if 'download_strategy' in result:
            print(f"📊 下载策略: {result['download_strategy']}")
        
        print("\n💡 提示:")
        print(f"  - 使用视频播放器打开文件检查是否有音频")
        print(f"  - Windows: 右键 → 打开方式 → Windows Media Player")
        print(f"  - 或使用 VLC、PotPlayer 等播放器")
        
        # 清理
        cleanup = input("\n🗑️  测试完成后删除下载的视频？(y/n): ").lower()
        if cleanup == 'y':
            service.cleanup_video(result['file_path'])
            print("✅ 文件已删除")
        else:
            print(f"✅ 文件保留在: {result['file_path']}")
        
        return True
        
    except Exception as e:
        print("\n" + "=" * 60)
        print("❌ 测试失败!")
        print("=" * 60)
        print(f"错误: {str(e)}")
        return False

if __name__ == "__main__":
    success = test_audio_merge()
    sys.exit(0 if success else 1)


