"""
Test cache service functionality
"""
from app.services.cache_service import CacheService
import time

def main():
    print("="*70)
    print("🧪 测试缓存服务")
    print("="*70)
    
    cache = CacheService(cache_dir="cache")
    
    # Test 1: Save and retrieve
    print("\n📝 Test 1: 保存和读取缓存")
    print("-"*70)
    
    test_url = "https://www.bilibili.com/video/BV1xx411xxx"
    test_prompt = "请分析这个视频的内容..."
    test_result = {
        'video_info': {
            'title': '测试视频',
            'bv_id': 'BV1xx411xxx',
        },
        'analysis': {
            'text': '这是分析结果...'
        },
        'analyzed_at': '2024-01-05T12:00:00',
    }
    
    # Save
    cache.set(test_url, test_prompt, test_result)
    print("✅ 缓存已保存")
    
    # Retrieve
    cached = cache.get(test_url, test_prompt)
    if cached:
        print("✅ 缓存读取成功")
        print(f"   标题: {cached['video_info']['title']}")
    else:
        print("❌ 缓存读取失败")
    
    # Test 2: Cache expiry
    print("\n⏰ Test 2: 缓存过期检查")
    print("-"*70)
    
    # Try to get with very short max age (should fail)
    expired = cache.get(test_url, test_prompt, max_age_hours=0)
    if expired is None:
        print("✅ 过期缓存正确返回 None")
    else:
        print("❌ 过期缓存没有正确处理")
    
    # Test 3: Different prompt = different cache
    print("\n🔑 Test 3: 不同 Prompt 使用不同缓存")
    print("-"*70)
    
    different_prompt = "请总结这个视频..."
    cached_different = cache.get(test_url, different_prompt)
    if cached_different is None:
        print("✅ 不同 Prompt 正确返回 None（未缓存）")
    else:
        print("❌ 缓存 key 生成有问题")
    
    # Test 4: Cache stats
    print("\n📊 Test 4: 缓存统计")
    print("-"*70)
    
    stats = cache.get_stats()
    print(f"总缓存数: {stats['total_entries']}")
    print(f"总大小: {stats['total_size_mb']:.2f} MB")
    print(f"最新缓存: {stats['newest_entry']}")
    print(f"最旧缓存: {stats['oldest_entry']}")
    
    # Test 5: List cached videos
    print("\n📋 Test 5: 列出所有缓存")
    print("-"*70)
    
    cached_list = cache.list_cached_videos()
    print(f"共 {len(cached_list)} 个缓存条目:")
    for entry in cached_list:
        print(f"  - {entry['video_url'][:50]}...")
        print(f"    缓存时间: {entry['cached_at']}")
        print(f"    文件大小: {entry['file_size_kb']:.2f} KB")
    
    # Test 6: Clear cache
    print("\n🗑️  Test 6: 清理缓存")
    print("-"*70)
    
    choice = input("是否清理所有测试缓存? (y/n): ").strip().lower()
    if choice == 'y':
        cleared = cache.clear_all()
        print(f"✅ 已清理 {cleared} 个缓存条目")
    else:
        print("⏭️  跳过清理")
    
    print("\n" + "="*70)
    print("🎉 缓存服务测试完成!")
    print("="*70)
    
    print("\n💡 使用建议:")
    print("   - 缓存有效期设为 7 天")
    print("   - 定期清理过期缓存节省空间")
    print("   - 相同 URL + Prompt 会命中缓存")
    print("   - 查看 cache/ 目录下的 JSON 文件")

if __name__ == "__main__":
    main()


