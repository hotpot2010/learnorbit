"""
删除知识点文件中 transcript_segment 字段的脚本

功能：
1. 从数据库读取所有任务的 knowledge_points_result_url
2. 下载知识点JSON文件
3. 删除每个知识点中的 transcript_segment 字段
4. 重新上传更新后的JSON文件
5. 更新数据库中的URL（如果URL变化）
"""
import sys
import os
import json
import requests
import tempfile
from typing import List, Dict, Any, Optional

# 添加项目根目录到路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database import get_db_session
from app.models.offline_video import OfflineVideoTask
from app.services.file_upload_service import FileUploadService


def parse_urls(url_data) -> List[str]:
    """解析URL数据（可能是字符串、JSON字符串或列表）"""
    if not url_data:
        return []
    
    if isinstance(url_data, list):
        return url_data
    
    if isinstance(url_data, str):
        try:
            # 尝试解析JSON字符串
            parsed = json.loads(url_data)
            if isinstance(parsed, list):
                return parsed
            return [parsed]
        except:
            return [url_data]
    
    return []


def download_json(url: str) -> Optional[Dict[str, Any]]:
    """下载JSON文件"""
    try:
        print(f"  📥 下载JSON文件: {url[:80]}...")
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"  ❌ 下载失败: {e}")
        return None


def remove_transcript_segment(knowledge_points: List[Dict[str, Any]]) -> int:
    """删除知识点中的 transcript_segment 字段，返回删除的数量"""
    removed_count = 0
    for kp in knowledge_points:
        if 'transcript_segment' in kp:
            del kp['transcript_segment']
            removed_count += 1
    return removed_count


def upload_json_to_cdn(json_data: Dict[str, Any], file_upload_service: FileUploadService) -> Optional[str]:
    """上传JSON文件到CDN"""
    try:
        # 创建临时文件
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f:
            json.dump(json_data, f, ensure_ascii=False, indent=2)
            temp_path = f.name
        
        try:
            # 上传文件
            print(f"  📤 上传更新后的JSON文件...")
            cdn_url = file_upload_service.upload_file(
                temp_path,
                file_key="file0",
                content_type="application/json; charset=utf-8"
            )
            
            if cdn_url:
                if not cdn_url.startswith('http'):
                    cdn_url = f"http://file.gsxservice.com/{cdn_url}"
                print(f"  ✅ 上传成功: {cdn_url[:80]}...")
                return cdn_url
            else:
                print(f"  ❌ 上传失败")
                return None
        finally:
            # 删除临时文件
            try:
                os.unlink(temp_path)
            except:
                pass
    except Exception as e:
        print(f"  ❌ 上传过程出错: {e}")
        return None


def process_task(task: OfflineVideoTask, file_upload_service: FileUploadService, db) -> bool:
    """处理单个任务"""
    task_id = task.task_id
    title = task.video_title or task.bilibili_url
    
    print(f"\n{'='*70}")
    print(f"📋 处理任务: {task_id}")
    print(f"   标题: {title[:60]}...")
    
    # 获取知识点URL
    knowledge_points_result_url = task.knowledge_points_result_url
    if not knowledge_points_result_url:
        print(f"  ⚠️  任务没有知识点结果URL，跳过")
        return False
    
    # 解析URL（可能是单个URL或URL数组）
    urls = parse_urls(knowledge_points_result_url)
    if not urls:
        print(f"  ⚠️  无法解析知识点URL，跳过")
        return False
    
    print(f"  📊 找到 {len(urls)} 个知识点文件URL")
    
    updated_urls = []
    total_removed = 0
    has_changes = False
    
    # 处理每个URL（多P视频可能有多个文件）
    for idx, url in enumerate(urls):
        print(f"\n  📄 处理文件 {idx + 1}/{len(urls)}")
        
        # 下载JSON文件
        json_data = download_json(url)
        if not json_data:
            print(f"  ⚠️  下载失败，保留原URL")
            updated_urls.append(url)
            continue
        
        # 检查是否有知识点数据
        knowledge_points = json_data.get('knowledge_points', [])
        if not knowledge_points:
            print(f"  ⚠️  JSON文件中没有知识点数据，跳过")
            updated_urls.append(url)
            continue
        
        # 检查是否有 transcript_segment 字段
        has_transcript_segment = any('transcript_segment' in kp for kp in knowledge_points)
        if not has_transcript_segment:
            print(f"  ✅ 该文件没有 transcript_segment 字段，无需更新")
            updated_urls.append(url)
            continue
        
        # 删除 transcript_segment 字段
        removed_count = remove_transcript_segment(knowledge_points)
        print(f"  🗑️  删除了 {removed_count} 个知识点中的 transcript_segment 字段")
        total_removed += removed_count
        has_changes = True
        
        # 重新上传
        new_url = upload_json_to_cdn(json_data, file_upload_service)
        if new_url:
            updated_urls.append(new_url)
            print(f"  ✅ 文件已更新并上传")
        else:
            print(f"  ⚠️  上传失败，保留原URL")
            updated_urls.append(url)
    
    # 如果URL有变化，更新数据库
    if has_changes:
        # 格式化URL（单P为字符串，多P为JSON数组）
        if len(updated_urls) == 1:
            new_knowledge_points_result_url = updated_urls[0]
        else:
            new_knowledge_points_result_url = json.dumps(updated_urls, ensure_ascii=False)
        
        # 更新数据库（上下文管理器会自动提交）
        task.knowledge_points_result_url = new_knowledge_points_result_url
        print(f"\n  ✅ 数据库已更新")
        print(f"  📊 总共删除了 {total_removed} 个 transcript_segment 字段")
        return True
    else:
        print(f"\n  ℹ️  无需更新")
        return False


def main():
    """主函数"""
    print("=" * 70)
    print("🗑️  删除知识点文件中的 transcript_segment 字段")
    print("=" * 70)
    
    # 初始化文件上传服务
    file_upload_service = FileUploadService()
    
    # 统计信息
    total_tasks = 0
    processed_tasks = 0
    updated_tasks = 0
    failed_tasks = 0
    
    # 从数据库读取所有任务ID
    with get_db_session() as db:
        tasks = db.query(OfflineVideoTask).all()
        total_tasks = len(tasks)
        task_ids = [task.task_id for task in tasks]
    
    print(f"\n📊 找到 {total_tasks} 个任务")
    
    # 处理每个任务（每个任务使用独立的数据库会话）
    for task_id in task_ids:
        try:
            with get_db_session() as db:
                task = db.query(OfflineVideoTask).filter(OfflineVideoTask.task_id == task_id).first()
                if not task:
                    print(f"\n⚠️  任务 {task_id} 不存在，跳过")
                    continue
                
                if process_task(task, file_upload_service, db):
                    updated_tasks += 1
                processed_tasks += 1
        except Exception as e:
            print(f"\n❌ 处理任务失败: {e}")
            import traceback
            traceback.print_exc()
            failed_tasks += 1
    
    # 打印统计信息
    print("\n" + "=" * 70)
    print("📊 处理完成统计")
    print("=" * 70)
    print(f"总任务数: {total_tasks}")
    print(f"已处理: {processed_tasks}")
    print(f"已更新: {updated_tasks}")
    print(f"失败: {failed_tasks}")
    print("=" * 70)


if __name__ == "__main__":
    main()

