"""
测试视频搜索功能
"""
import asyncio
import sys
import os

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.bilibili_search_service import bilibili_search_service
from app.services.video_analyzer_service import video_analyzer_service


async def test_search_and_analyze():
    """测试搜索和分析流程"""
    
    query = "Python基础教程"
    print(f"\n{'='*60}")
    print(f"🔍 测试视频搜索: {query}")
    print(f"{'='*60}\n")
    
    # 1. 搜索视频
    print("📡 第一步：搜索B站视频...")
    videos = await bilibili_search_service.search_videos_with_rerank(query, limit=3)
    
    if not videos:
        print("❌ 未找到视频")
        return
    
    print(f"✅ 找到 {len(videos)} 个视频\n")
    
    # 2. 分析视频
    print("🤖 第二步：AI分析视频...")
    analyzed_videos = await video_analyzer_service.analyze_videos_batch(videos)
    
    print(f"✅ 分析完成\n")
    
    # 3. 显示结果
    print(f"{'='*60}")
    print(f"📊 分析结果")
    print(f"{'='*60}\n")
    
    for i, video in enumerate(analyzed_videos, 1):
        print(f"【视频 {i}】")
        print(f"标题: {video['title']}")
        print(f"UP主: {video['author']}")
        print(f"时长: {video['duration']}")
        print(f"播放: {video.get('play', 0):,}")
        print(f"链接: {video['url']}")
        print(f"\n学习目标:")
        for obj in video.get('learning_objectives', []):
            print(f"  • {obj}")
        print(f"\n适用人群: {video.get('target_audience', 'N/A')}")
        print(f"\n核心特点:")
        for feature in video.get('key_features', []):
            print(f"  • {feature}")
        print(f"\n推荐分数: {video.get('recommendation_score', 'N/A')}/10")
        print(f"推荐语: {video.get('analysis_summary', 'N/A')}")
        print(f"\n{'-'*60}\n")


if __name__ == "__main__":
    print("🚀 开始测试视频搜索和分析功能...")
    asyncio.run(test_search_and_analyze())
    print("✅ 测试完成！")

