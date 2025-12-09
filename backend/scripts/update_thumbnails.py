"""
更新数据库中任务的封面图
从B站API获取封面，下载并上传到CDN，更新数据库
"""
import sys
import os
import json
import tempfile
from pathlib import Path

# 添加项目根目录到Python路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import get_db_session
from app.models.offline_video import OfflineVideoTask
from app.services.file_upload_service import FileUploadService

# 导入httpx（项目已安装）替代requests
try:
    import httpx
    HTTP_CLIENT = httpx
except ImportError:
    print("❌ 缺少httpx库，请运行: pip install httpx")
    sys.exit(1)


def fetch_bilibili_cover(bv_id: str) -> str:
    """
    从B站API获取视频封面URL
    
    Args:
        bv_id: B站视频的BV号
        
    Returns:
        封面图片URL
    """
    try:
        url = f"https://api.bilibili.com/x/web-interface/view?bvid={bv_id}"
        
        # 使用更完整的请求头，模拟浏览器
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://www.bilibili.com/',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Origin': 'https://www.bilibili.com',
        }
        
        with HTTP_CLIENT.Client() as client:
            response = client.get(url, headers=headers, timeout=10)
        
            # 打印响应内容以便调试
            print(f"🔍 API响应状态: {response.status_code}")
            
            if response.status_code != 200:
                print(f"⚠️ API返回非200状态码: {response.status_code}")
                print(f"   响应内容: {response.text[:200]}")
                return None
            
            # 尝试解析JSON
            try:
                data = response.json()
            except Exception as json_error:
                print(f"❌ JSON解析失败: {json_error}")
                print(f"   响应内容: {response.text[:500]}")
                return None
            
            if data.get('code') == 0 and data.get('data') and data['data'].get('pic'):
                cover_url = data['data']['pic']
                # 确保使用HTTPS
                if cover_url.startswith('http://'):
                    cover_url = cover_url.replace('http://', 'https://')
                print(f"✅ 获取到封面URL: {cover_url}")
                return cover_url
            else:
                print(f"❌ API返回错误: code={data.get('code')}, message={data.get('message')}")
                return None
            
    except Exception as e:
        print(f"❌ 获取封面失败 (BV={bv_id}): {e}")
        import traceback
        traceback.print_exc()
    
    return None


def download_image(url: str, save_path: str) -> bool:
    """
    下载图片到本地
    
    Args:
        url: 图片URL
        save_path: 保存路径
        
    Returns:
        是否成功
    """
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://www.bilibili.com/'
        }
        
        with HTTP_CLIENT.Client() as client:
            response = client.get(url, headers=headers, timeout=30)
            response.raise_for_status()
            
            with open(save_path, 'wb') as f:
                f.write(response.content)
            
            print(f"✅ 图片下载成功: {save_path} ({len(response.content)} bytes)")
            return True
    except Exception as e:
        print(f"❌ 图片下载失败: {e}")
        return False


def upload_thumbnail_to_cdn(image_path: str, file_upload_service: FileUploadService) -> str:
    """
    上传封面图到CDN
    
    Args:
        image_path: 图片本地路径
        file_upload_service: 文件上传服务
        
    Returns:
        CDN URL
    """
    try:
        cdn_url = file_upload_service.upload_file(image_path, file_key="file0")
        
        if cdn_url:
            if not cdn_url.startswith('http'):
                cdn_url = f"http://file.gsxservice.com/{cdn_url}"
            print(f"✅ 封面上传到CDN: {cdn_url}")
            return cdn_url
    except Exception as e:
        print(f"❌ 封面上传失败: {e}")
    
    return None


def process_task_thumbnail(task: OfflineVideoTask, file_upload_service: FileUploadService, db) -> bool:
    """
    处理单个任务的封面图
    
    Args:
        task: 任务对象
        file_upload_service: 文件上传服务
        db: 数据库会话
        
    Returns:
        是否成功
    """
    task_id = task.task_id
    print(f"\n{'='*60}")
    print(f"📋 处理任务: {task_id}")
    print(f"   标题: {task.video_title}")
    print(f"   URL: {task.bilibili_url}")
    
    # 解析video_info
    video_info = task.video_info if isinstance(task.video_info, dict) else {}
    if isinstance(task.video_info, str):
        try:
            video_info = json.loads(task.video_info)
        except:
            video_info = {}
    
    # 检查是否已有CDN封面
    existing_thumbnail = video_info.get('thumbnail_cdn') or video_info.get('thumbnail', '')
    if existing_thumbnail and existing_thumbnail.startswith('http://file.gsxservice.com'):
        print(f"⏭️  已有CDN封面，跳过: {existing_thumbnail}")
        return True
    
    # 获取BV号
    bv_id = video_info.get('bv_id', '')
    if not bv_id:
        # 尝试从URL中提取BV号
        try:
            import re
            match = re.search(r'BV[a-zA-Z0-9]+', task.bilibili_url)
            if match:
                bv_id = match.group(0)
        except:
            pass
    
    if not bv_id:
        print(f"❌ 无法获取BV号，跳过")
        return False
    
    print(f"🔑 BV号: {bv_id}")
    
    # 获取B站封面URL
    cover_url = fetch_bilibili_cover(bv_id)
    if not cover_url:
        print(f"❌ 无法获取封面URL，跳过")
        return False
    
    # 创建临时文件
    temp_dir = tempfile.gettempdir()
    temp_file = os.path.join(temp_dir, f"{task_id}_cover.jpg")
    
    try:
        # 下载封面图
        if not download_image(cover_url, temp_file):
            return False
        
        # 上传到CDN
        cdn_url = upload_thumbnail_to_cdn(temp_file, file_upload_service)
        if not cdn_url:
            return False
        
        # 更新数据库
        print(f"📝 准备更新数据库...")
        print(f"   原始 video_info 类型: {type(video_info)}")
        print(f"   原始 video_info: {video_info}")
        
        video_info['thumbnail'] = cover_url  # 保存原始URL
        video_info['thumbnail_cdn'] = cdn_url  # 保存CDN URL
        
        print(f"   更新后 video_info: {video_info}")
        print(f"   thumbnail_cdn: {video_info.get('thumbnail_cdn')}")
        
        # 确保更新到数据库
        task.video_info = video_info
        
        # 强制标记为已修改（SQLAlchemy JSON字段的特殊处理）
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(task, 'video_info')
        
        db.commit()
        
        # 验证更新
        db.refresh(task)
        updated_info = task.video_info if isinstance(task.video_info, dict) else json.loads(task.video_info)
        print(f"✅ 数据库已更新")
        print(f"   验证 thumbnail_cdn: {updated_info.get('thumbnail_cdn')}")
        
        if 'thumbnail_cdn' not in updated_info:
            print(f"❌ 警告：thumbnail_cdn 字段未保存到数据库！")
            return False
        
        print(f"✅ 任务 {task_id} 封面图处理完成")
        print(f"   原始URL: {cover_url}")
        print(f"   CDN URL: {cdn_url}")
        
        return True
        
    except Exception as e:
        print(f"❌ 处理失败: {e}")
        db.rollback()
        return False
    finally:
        # 清理临时文件
        if os.path.exists(temp_file):
            try:
                os.remove(temp_file)
                print(f"🗑️  已删除临时文件: {temp_file}")
            except:
                pass


def main():
    """主函数"""
    print("🚀 开始更新任务封面图...")
    print("="*60)
    
    # 初始化服务
    file_upload_service = FileUploadService()
    
    # 查询所有任务
    with get_db_session() as db:
        tasks = db.query(OfflineVideoTask).all()
        total = len(tasks)
        print(f"📊 共找到 {total} 个任务")
        
        success_count = 0
        skip_count = 0
        fail_count = 0
        
        for i, task in enumerate(tasks, 1):
            print(f"\n进度: {i}/{total}")
            
            result = process_task_thumbnail(task, file_upload_service, db)
            
            if result is True:
                success_count += 1
            elif result is None:
                skip_count += 1
            else:
                fail_count += 1
    
    # 统计结果
    print(f"\n{'='*60}")
    print("📊 处理完成！")
    print(f"   ✅ 成功: {success_count}")
    print(f"   ⏭️  跳过: {skip_count}")
    print(f"   ❌ 失败: {fail_count}")
    print(f"   📋 总计: {total}")


if __name__ == "__main__":
    main()

