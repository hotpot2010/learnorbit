"""
Example usage of Bilibili Batch Analyzer
This script demonstrates how to use the service programmatically
"""

from app.services.batch_analyzer import BatchAnalyzer
from app.services.bilibili_service import BilibiliService

def example_1_extract_video_info():
    """Example 1: Extract video information without downloading"""
    print("\n" + "="*60)
    print("Example 1: Extract Video Info")
    print("="*60 + "\n")
    
    service = BilibiliService()
    
    # Replace with a real BV number
    test_url = "BV1xx411c7mD"
    
    try:
        info = service.extract_video_info(test_url)
        
        print(f"✅ Video Info:")
        print(f"   Title: {info['title']}")
        print(f"   BV ID: {info['bv_id']}")
        print(f"   Duration: {info['duration']} seconds ({info['duration']//60} minutes)")
        print(f"   Uploader: {info['uploader']}")
        print(f"   Views: {info['view_count']:,}")
        print(f"   Upload Date: {info['upload_date']}")
    except Exception as e:
        print(f"❌ Error: {e}")

def example_2_simple_batch_analysis():
    """Example 2: Simple batch analysis with custom prompt"""
    print("\n" + "="*60)
    print("Example 2: Simple Batch Analysis")
    print("="*60 + "\n")
    
    analyzer = BatchAnalyzer(storage_dir="batch_results")
    
    # Create a job with test videos
    video_urls = [
        "BV1xx411c7mD",  # Replace with real video URLs
        # Add more URLs here
    ]
    
    custom_prompt = """
请分析这个视频的内容，提供以下信息：

1. 视频主题和核心内容
2. 主要知识点（列举3-5个）
3. 适合的目标受众
4. 学习建议

请用简洁的 Markdown 格式输出。
"""
    
    try:
        # Create job
        print("📝 Creating job...")
        job_id = analyzer.create_job(
            video_urls=video_urls,
            prompt=custom_prompt,
            job_name="Example Batch Analysis"
        )
        print(f"✅ Job created: {job_id}")
        
        # Progress callback
        def on_progress(job):
            print(f"   Progress: {job['completed_videos']}/{job['total_videos']} videos")
        
        # Run job
        print("\n🚀 Running job...")
        result = analyzer.run_job(job_id, progress_callback=on_progress)
        
        # Print results
        print("\n📊 Results:")
        print(f"   Status: {result['status']}")
        print(f"   Completed: {result['completed_videos']}")
        print(f"   Failed: {result['failed_videos']}")
        
        if result['results']:
            print("\n✅ First video analysis:")
            first_result = result['results'][0]
            print(f"   Video: {first_result['video_info']['title']}")
            print(f"   Analysis preview:")
            analysis_text = first_result['analysis'].get('text', '')
            print("   " + analysis_text[:200] + "...")
        
        if result.get('saved_file'):
            print(f"\n💾 Results saved to: {result['saved_file']}")
            
    except Exception as e:
        print(f"❌ Error: {e}")

def example_3_using_preset_template():
    """Example 3: Use preset prompt template"""
    print("\n" + "="*60)
    print("Example 3: Using Preset Template")
    print("="*60 + "\n")
    
    analyzer = BatchAnalyzer(storage_dir="batch_results")
    
    # Use the "outline" template prompt
    outline_prompt = """请分析这个视频的内容，生成一个详细的笔记大纲。

要求：
1. 提取视频的核心主题和关键知识点
2. 按照逻辑顺序组织内容结构
3. 为每个部分添加时间戳（如果可识别）
4. 标注重点和难点
5. 用Markdown格式输出

输出格式：
# 视频标题
## 核心概要
- ...

## 详细大纲
### 1. 第一部分标题
- 要点1
- 要点2
...
"""
    
    video_urls = ["BV1xx411c7mD"]  # Replace with real URL
    
    try:
        job_id = analyzer.create_job(
            video_urls=video_urls,
            prompt=outline_prompt,
            job_name="Generate Video Outline"
        )
        
        print(f"✅ Job created with 'outline' template: {job_id}")
        print("📝 You can check the job status via API:")
        print(f"   GET http://localhost:8000/batch/jobs/{job_id}")
        
    except Exception as e:
        print(f"❌ Error: {e}")

def example_4_view_saved_jobs():
    """Example 4: View saved job results"""
    print("\n" + "="*60)
    print("Example 4: View Saved Jobs")
    print("="*60 + "\n")
    
    analyzer = BatchAnalyzer(storage_dir="batch_results")
    
    try:
        jobs = analyzer.list_saved_jobs()
        
        if not jobs:
            print("📂 No saved jobs found.")
            print("   Run Example 2 or 3 first to create some jobs.")
        else:
            print(f"📊 Found {len(jobs)} saved jobs:\n")
            
            for i, job in enumerate(jobs[:5], 1):  # Show first 5
                print(f"{i}. {job['job_name']}")
                print(f"   Created: {job['created_at']}")
                print(f"   Videos: {job['total_videos']} (✅ {job['completed_videos']}, ❌ {job['failed_videos']})")
                print(f"   File: {job['filename']}")
                print()
            
            # Load and show first job details
            if jobs:
                print("📖 Loading first job details...")
                first_job = analyzer.load_job_results(jobs[0]['filepath'])
                print(f"\nJob Name: {first_job['job_name']}")
                print(f"Prompt Preview: {first_job['prompt'][:100]}...")
                
                if first_job['results']:
                    print(f"\nFirst result preview:")
                    result = first_job['results'][0]
                    print(f"  Video: {result['video_info']['title']}")
                    print(f"  Success: {result['success']}")
                    
    except Exception as e:
        print(f"❌ Error: {e}")

def main():
    """Run all examples"""
    print("\n" + "="*60)
    print("🎬 Bilibili Batch Analyzer - Usage Examples")
    print("="*60)
    
    print("\n💡 Choose an example to run:")
    print("   1. Extract video info (fast, no download)")
    print("   2. Simple batch analysis (downloads and analyzes)")
    print("   3. Use preset template")
    print("   4. View saved jobs")
    print("   5. Run all examples")
    
    choice = input("\n👉 Enter your choice (1-5): ").strip()
    
    if choice == '1':
        example_1_extract_video_info()
    elif choice == '2':
        example_2_simple_batch_analysis()
    elif choice == '3':
        example_3_using_preset_template()
    elif choice == '4':
        example_4_view_saved_jobs()
    elif choice == '5':
        example_1_extract_video_info()
        example_2_simple_batch_analysis()
        example_3_using_preset_template()
        example_4_view_saved_jobs()
    else:
        print("❌ Invalid choice")
        return
    
    print("\n" + "="*60)
    print("✅ Example completed!")
    print("="*60 + "\n")
    
    print("💡 Next steps:")
    print("   - Check batch_results/ for saved results")
    print("   - Visit http://localhost:8000/docs for API docs")
    print("   - Use the web interface at http://localhost:3000/bilibili-batch-analyzer")

if __name__ == "__main__":
    main()


