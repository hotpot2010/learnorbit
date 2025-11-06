"""
验证修复是否生效
"""
from app.services.bilibili_service import BilibiliService
import os

def main():
    url = "https://www.bilibili.com/video/BV1Jgf6YvE8e"
    
    print("="*70)
    print("🧪 验证修复效果")
    print("="*70)
    print(f"测试视频: {url}\n")
    
    service = BilibiliService()
    
    print("📥 尝试下载视频...")
    print("⚠️  注意: 根据诊断，这个视频可能只有视频流（无音频）")
    print("    下载后的文件可能是无声视频\n")
    
    choice = input("继续下载测试? (y/n): ").strip().lower()
    
    if choice != 'y':
        print("❌ 已取消")
        return
    
    try:
        result = service.download_video(url, output_filename="fix_test")
        
        print("\n" + "="*70)
        print("✅ 下载成功!")
        print("="*70)
        print(f"文件路径: {result['file_path']}")
        print(f"文件大小: {result['file_size'] / 1024 / 1024:.2f} MB")
        print(f"视频标题: {result['title']}")
        print(f"视频时长: {result['duration']} 秒")
        
        if 'download_strategy' in result:
            print(f"使用策略: {result['download_strategy']}")
        
        print("\n💡 提示:")
        print("   - 如果这是仅视频文件（无音频），这是正常的")
        print("   - 某些B站视频确实只提供视频流")
        print("   - Gemini 可以分析无声视频")
        
        # 询问是否清理
        print()
        cleanup = input("删除下载的文件? (y/n): ").strip().lower()
        if cleanup == 'y':
            service.cleanup_video(result['file_path'])
            print("✅ 文件已删除")
        else:
            print(f"💾 文件保留在: {result['file_path']}")
        
        print("\n" + "="*70)
        print("🎉 修复验证完成!")
        print("="*70)
        print("\n✅ 代码修复生效，可以正常下载了！")
        print("\n💡 下一步:")
        print("   1. 重启后端服务: python main.py")
        print("   2. 在 Web 界面重新尝试批量分析")
        print("   3. 如果是多P视频，使用 ?p=1 指定分集")
        
    except Exception as e:
        print("\n" + "="*70)
        print("❌ 下载仍然失败")
        print("="*70)
        print(f"错误信息: {e}\n")
        
        print("🔍 可能的原因:")
        print("   1. 这是多P视频，需要指定分集:")
        print(f"      {url}?p=1")
        print("\n   2. 需要登录/会员权限 (Cookie)")
        print("\n   3. 地区限制")
        
        print("\n💡 建议:")
        print("   - 尝试添加 ?p=1: https://www.bilibili.com/video/BV1Jgf6YvE8e?p=1")
        print("   - 或使用其他简单的单P教程视频测试")
        print("   - 查看完整文档: VIDEO_DOWNLOAD_ISSUE_GUIDE.md")

if __name__ == "__main__":
    main()


