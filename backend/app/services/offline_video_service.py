"""
离线视频处理服务
支持B站视频的下载、ASR识别、知识点生成等功能
"""
import os
import json
import asyncio
import time
import requests
from typing import Dict, Any, Optional, List
from datetime import datetime
from enum import Enum
from concurrent.futures import ThreadPoolExecutor

from .bilibili_service import BilibiliService
from .asr_service import AsrService
from .knowledge_point_extractor import KnowledgePointExtractor
from .file_upload_service import FileUploadService
from .result_merger_service import ResultMergerService
from .volcano_service import VolcanoService
from .doubao_service import DoubaoService
from ..database import get_db_session, init_db, test_connection
from ..models.offline_video import OfflineVideoTask
from dotenv import load_dotenv

load_dotenv()


class TaskStatus(str, Enum):
    """任务状态枚举"""
    PENDING = "pending"  # 等待执行
    RUNNING = "running"  # 执行中
    SUCCESS = "success"  # 成功
    FAILED = "failed"  # 失败
    RETRYING = "retrying"  # 重试中
    PARTIAL_SUCCESS = "partial_success"  # 部分成功（多P任务中部分分P失败）


class StepType(str, Enum):
    """步骤类型枚举"""
    DOWNLOAD = "download"  # 下载视频
    ASR = "asr"  # ASR识别
    KNOWLEDGE_POINTS = "knowledge_points"  # 生成知识点
    SCREENSHOTS = "screenshots"  # 生成截图
    EXERCISES = "exercises"  # 生成练习题
    SUMMARY = "summary"  # 生成摘要


class OfflineVideoService:
    """离线视频处理服务"""
    
    def __init__(self):
        self.bilibili_service = BilibiliService()
        self.asr_service = AsrService()
        self.knowledge_point_extractor = KnowledgePointExtractor()
        self.file_upload_service = FileUploadService()
        self.result_merger = ResultMergerService()
        
        # 初始化 LLM 服务（用于练习生成）
        llm_provider = os.getenv('LLM_PROVIDER', 'volcano')
        if llm_provider == 'baijia':
            self.llm_service = DoubaoService()
        else:
            self.llm_service = VolcanoService()
        print(f"🔍 [OfflineVideoService] LLM_PROVIDER = '{llm_provider}'")
        
        # 任务存储（使用数据库）
        # 内存缓存，用于快速访问
        self.tasks_cache: Dict[str, Dict[str, Any]] = {}
        
        # 确保结果目录存在（用于临时文件）
        self.results_dir = os.path.join(os.path.dirname(__file__), "../../results")
        os.makedirs(self.results_dir, exist_ok=True)
        
        # 线程池用于执行同步阻塞操作（如下载、上传等）
        self.executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="video_processing_")
        
        # 初始化数据库
        try:
            if test_connection():
                init_db()
                print("✅ 数据库初始化成功")
            else:
                print("⚠️ 数据库连接失败，将使用文件存储作为后备")
        except Exception as e:
            print(f"⚠️ 数据库初始化失败: {e}，将使用文件存储作为后备")
        
        # 启动时从数据库加载任务
        self._load_existing_tasks()
    
    def create_task(self, bilibili_url: str) -> str:
        """
        创建新任务
        
        Args:
            bilibili_url: B站视频链接
            
        Returns:
            任务ID
        """
        task_id = f"task_{int(time.time())}_{hash(bilibili_url) % 10000}"
        
        # 获取视频信息（标题、时长、描述等）
        video_info = {}
        is_series = False
        series_parts = []
        
        try:
            # 移除?p=参数以获取完整系列信息
            base_url = bilibili_url.split('?')[0] if '?' in bilibili_url else bilibili_url
            video_info = self.bilibili_service.extract_video_info(base_url)
            is_series = video_info.get('is_series', False)
            # 🔧 修复：字段名应该是 'parts' 而不是 'parts_info'
            series_parts = video_info.get('parts', []) if is_series else []
            
            print(f"📋 获取视频信息成功: {video_info.get('title', 'N/A')}")
            print(f"   is_series: {is_series}")
            print(f"   total_parts: {video_info.get('total_parts', 0)}")
            print(f"   series_parts数量: {len(series_parts)}")
            print(f"   时长: {video_info.get('duration', 0)}秒")
            print(f"   描述: {video_info.get('description', '')[:100]}...")
        except Exception as e:
            print(f"⚠️ 获取视频信息失败: {e}")
            # 使用默认值
            video_info = {
                'title': '未知视频',
                'description': '',
                'duration': 0,
                'uploader': '',
                'view_count': 0,
                'like_count': 0,
                'thumbnail': ''
            }
        
        # 使用视频标题作为任务标题
        video_title = video_info.get('title', '未知视频')
        
        # 🖼️ 处理封面图：下载并上传到CDN
        thumbnail_cdn_url = self._process_thumbnail(video_info.get('thumbnail', ''), video_info.get('bv_id', ''), task_id)
        if thumbnail_cdn_url:
            print(f"✅ 封面图已上传到CDN: {thumbnail_cdn_url}")
        
        task = {
            "task_id": task_id,
            "bilibili_url": bilibili_url,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "steps": {
                "download": {
                    "status": TaskStatus.PENDING,
                    "progress": 0,
                    "message": "等待执行",
                    "result": None,
                    "error": None,
                    "retry_count": 0
                },
                "asr": {
                    "status": TaskStatus.PENDING,
                    "progress": 0,
                    "message": "等待执行",
                    "result": None,
                    "error": None,
                    "retry_count": 0
                },
                "knowledge_points": {
                    "status": TaskStatus.PENDING,
                    "progress": 0,
                    "message": "等待执行",
                    "result": None,
                    "error": None,
                    "retry_count": 0
                },
                "screenshots": {
                    "status": TaskStatus.PENDING,
                    "progress": 0,
                    "message": "等待执行",
                    "result": None,
                    "error": None,
                    "retry_count": 0
                },
                "exercises": {
                    "status": TaskStatus.PENDING,
                    "progress": 0,
                    "message": "等待执行",
                    "result": None,
                    "error": None,
                    "retry_count": 0
                }
            },
            "video_url": None,  # 上传后的视频URL
            "asr_result_url": None,  # ASR结果文件上传后的URL
            "knowledge_points_result_url": None,  # 知识点结果文件上传后的URL
            "screenshots_result_url": None,  # 截图结果文件上传后的URL
            "exercises_result_url": None,  # 练习题结果文件上传后的URL
            "asr_document": None,  # ASR结果文档路径（本地）
            "knowledge_points_document": None,  # 知识点文档路径（本地）
            "is_series": is_series,  # 是否为系列视频
            "series_parts": series_parts,  # 系列视频的分P列表
            "video_title": video_title,  # 视频标题
            "video_info": {  # 视频详细信息
                "title": video_info.get('title', ''),
                "description": video_info.get('description', ''),
                "duration": video_info.get('duration', 0),
                "uploader": video_info.get('uploader', ''),
                "view_count": video_info.get('view_count', 0),
                "like_count": video_info.get('like_count', 0),
                "thumbnail": video_info.get('thumbnail', ''),
                "thumbnail_cdn": thumbnail_cdn_url or '',  # CDN封面URL
                "upload_date": video_info.get('upload_date', ''),
                "bv_id": video_info.get('bv_id', '')
            }
        }
        
        # 保存到数据库
        self._save_task_to_db(task)
        
        # 更新内存缓存
        self.tasks_cache[task_id] = task
        
        print(f"✅ 创建任务: {task_id} - {video_title}")
        return task_id
    
    def _process_thumbnail(self, thumbnail_url: str, bv_id: str, task_id: str) -> Optional[str]:
        """
        处理封面图：从B站获取、下载、上传到CDN
        
        Args:
            thumbnail_url: B站封面URL（可能为空）
            bv_id: BV号
            task_id: 任务ID
            
        Returns:
            CDN URL 或 None
        """
        import requests
        import tempfile
        
        # 如果没有缩略图URL，尝试从B站API获取
        if not thumbnail_url and bv_id:
            try:
                print(f"🔍 从B站API获取封面 (BV={bv_id})...")
                api_url = f"https://api.bilibili.com/x/web-interface/view?bvid={bv_id}"
                
                # 使用更完整的请求头，模拟浏览器
                headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://www.bilibili.com/',
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                }
                
                response = requests.get(api_url, headers=headers, timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get('code') == 0 and data.get('data') and data['data'].get('pic'):
                        thumbnail_url = data['data']['pic']
                        # 确保使用HTTPS
                        if thumbnail_url.startswith('http://'):
                            thumbnail_url = thumbnail_url.replace('http://', 'https://')
                        print(f"✅ 从API获取到封面: {thumbnail_url}")
                else:
                    print(f"⚠️ API返回状态码: {response.status_code}")
            except Exception as e:
                print(f"⚠️ 从API获取封面失败: {e}")
        
        if not thumbnail_url:
            print(f"⚠️ 无封面URL，跳过封面处理")
            return None
        
        try:
            # 下载封面图
            print(f"📥 下载封面图: {thumbnail_url}")
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://www.bilibili.com/'
            }
            response = requests.get(thumbnail_url, headers=headers, timeout=30)
            response.raise_for_status()
            
            # 保存到临时文件
            temp_dir = tempfile.gettempdir()
            temp_file = os.path.join(temp_dir, f"{task_id}_cover.jpg")
            
            with open(temp_file, 'wb') as f:
                f.write(response.content)
            
            print(f"✅ 封面下载成功: {temp_file} ({len(response.content)} bytes)")
            
            # 上传到CDN
            print(f"📤 上传封面到CDN...")
            cdn_url = self.file_upload_service.upload_file(temp_file, file_key="file0")
            
            if cdn_url:
                if not cdn_url.startswith('http'):
                    cdn_url = f"https://file.gsxservice.com/{cdn_url}"
                print(f"✅ 封面已上传到CDN: {cdn_url}")
                
                # 清理临时文件
                try:
                    os.remove(temp_file)
                except:
                    pass
                
                return cdn_url
            else:
                print(f"❌ 封面上传CDN失败")
                return None
                
        except Exception as e:
            print(f"❌ 处理封面图失败: {e}")
            return None
    
    def _ensure_all_steps(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """
        确保任务包含所有步骤（用于兼容旧任务）
        如果缺失某个步骤，自动添加默认状态
        """
        if not task or "steps" not in task:
            return task
        
        # 定义所有应该存在的步骤
        required_steps = {
            "download": {
                "status": TaskStatus.PENDING,
                "progress": 0,
                "message": "等待执行",
                "result": None,
                "error": None,
                "retry_count": 0
            },
            "asr": {
                "status": TaskStatus.PENDING,
                "progress": 0,
                "message": "等待执行",
                "result": None,
                "error": None,
                "retry_count": 0
            },
            "knowledge_points": {
                "status": TaskStatus.PENDING,
                "progress": 0,
                "message": "等待执行",
                "result": None,
                "error": None,
                "retry_count": 0
            },
            "screenshots": {
                "status": TaskStatus.PENDING,
                "progress": 0,
                "message": "等待执行",
                "result": None,
                "error": None,
                "retry_count": 0
            }
        }
        
        # 检查并补全缺失的步骤
        steps_added = False
        for step_key, default_value in required_steps.items():
            if step_key not in task["steps"]:
                print(f"🔧 为任务 {task.get('task_id')} 补全缺失的步骤: {step_key}")
                task["steps"][step_key] = default_value.copy()
                steps_added = True
        
        # 如果添加了新步骤，保存到数据库
        if steps_added:
            try:
                self._save_task_to_db(task)
                print(f"✅ 已保存更新后的任务到数据库: {task.get('task_id')}")
            except Exception as e:
                print(f"⚠️ 保存任务失败: {e}")
        
        return task
    
    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        """获取任务信息"""
        # 先检查缓存
        if task_id in self.tasks_cache:
            task = self.tasks_cache[task_id]
            # 确保包含所有步骤
            task = self._ensure_all_steps(task)
            self.tasks_cache[task_id] = task
            return task
        
        # 从数据库加载
        try:
            with get_db_session() as db:
                task = db.query(OfflineVideoTask).filter(OfflineVideoTask.task_id == task_id).first()
                if task:
                    task_dict = task.to_dict()
                    # 确保包含所有步骤
                    task_dict = self._ensure_all_steps(task_dict)
                    self.tasks_cache[task_id] = task_dict
                    return task_dict
        except Exception as e:
            print(f"⚠️ 从数据库获取任务失败: {e}")
            # 后备：从文件加载
            task = self._load_task_from_file(task_id)
            if task:
                task = self._ensure_all_steps(task)
                self.tasks_cache[task_id] = task
            return task
        
        return None
    
    def list_tasks(self) -> List[Dict[str, Any]]:
        """列出所有任务"""
        try:
            # 先测试数据库连接
            if not test_connection():
                print(f"⚠️ 数据库连接不可用，返回缓存的任务列表")
                # 确保缓存中的任务包含所有步骤
                cached_tasks = []
                for task in self.tasks_cache.values():
                    task = self._ensure_all_steps(task)
                    cached_tasks.append(task)
                return cached_tasks
            
            with get_db_session() as db:
                tasks = db.query(OfflineVideoTask).order_by(OfflineVideoTask.created_at.desc()).all()
                task_list = []
                for task in tasks:
                    try:
                        task_dict = task.to_dict()
                        # 确保包含所有步骤
                        task_dict = self._ensure_all_steps(task_dict)
                        task_list.append(task_dict)
                        # 更新缓存
                        self.tasks_cache[task_dict['task_id']] = task_dict
                    except Exception as e:
                        print(f"⚠️ 转换任务数据失败: {e}")
                        continue
                return task_list
        except Exception as e:
            print(f"⚠️ 从数据库获取任务列表失败: {e}")
            import traceback
            traceback.print_exc()
            # 后备：从文件加载，确保包含所有步骤
            cached_tasks = []
            for task in self.tasks_cache.values():
                task = self._ensure_all_steps(task)
                cached_tasks.append(task)
            return cached_tasks
    
    def _update_step_status(
        self,
        task_id: str,
        step: str,
        status: TaskStatus,
        progress: int = 0,
        message: str = "",
        result: Any = None,
        error: Optional[str] = None
    ):
        """更新步骤状态"""
        print(f"🔄 更新步骤状态: task_id={task_id}, step={step}, status={status}, progress={progress}")
        
        # 获取任务（从缓存或数据库）
        task = self.get_task(task_id)
        if not task:
            print(f"⚠️ 任务不存在: {task_id}")
            return
        
        if step in task["steps"]:
            task["steps"][step]["status"] = status
            task["steps"][step]["progress"] = progress
            task["steps"][step]["message"] = message
            task["steps"][step]["result"] = result
            task["steps"][step]["error"] = error
            task["updated_at"] = datetime.now().isoformat()
            
            # 更新缓存
            self.tasks_cache[task_id] = task
            print(f"✅ 已更新缓存: task_id={task_id}, step={step}, status={status}")
            
            # 保存到数据库
            self._save_task_to_db(task)
            print(f"✅ 已保存到数据库: task_id={task_id}, step={step}, status={status}")
        else:
            print(f"⚠️ 步骤不存在: task_id={task_id}, step={step}")
    
    def _save_task_to_db(self, task: Dict[str, Any]):
        """保存任务到数据库"""
        try:
            # 先测试数据库连接
            if not test_connection():
                print(f"⚠️ 数据库连接不可用，保存到文件")
                self._save_task_to_file(task)
                return
            
            # 辅助函数：将URL字段转换为字符串（如果是列表则转为JSON字符串）
            def serialize_url_field(url_field):
                """将URL字段序列化为字符串"""
                if url_field is None:
                    return None
                if isinstance(url_field, list):
                    # 多P视频：列表转为JSON字符串
                    return json.dumps(url_field, ensure_ascii=False)
                elif isinstance(url_field, str):
                    # 单P视频：已经是字符串，直接返回
                    return url_field
                else:
                    # 其他类型：转为字符串
                    return str(url_field)
            
            with get_db_session() as db:
                task_id = task.get('task_id')
                if not task_id:
                    return
                
                # 查询是否存在
                db_task = db.query(OfflineVideoTask).filter(OfflineVideoTask.task_id == task_id).first()
                
                # 序列化URL字段
                video_url = serialize_url_field(task.get('video_url'))
                asr_result_url = serialize_url_field(task.get('asr_result_url'))
                knowledge_points_result_url = serialize_url_field(task.get('knowledge_points_result_url'))
                screenshots_result_url = serialize_url_field(task.get('screenshots_result_url'))
                exercises_result_url = serialize_url_field(task.get('exercises_result_url'))
                
                if db_task:
                    # 更新现有任务
                    db_task.bilibili_url = task.get('bilibili_url')
                    db_task.video_title = task.get('video_title')
                    db_task.steps = task.get('steps', {})
                    db_task.video_url = video_url
                    db_task.asr_result_url = asr_result_url
                    db_task.knowledge_points_result_url = knowledge_points_result_url
                    db_task.screenshots_result_url = screenshots_result_url
                    # 只有当数据库模型有该字段时才设置
                    if hasattr(db_task, 'exercises_result_url'):
                        db_task.exercises_result_url = exercises_result_url
                    db_task.video_info = task.get('video_info', {})
                    db_task.is_series = 1 if task.get('is_series') else 0
                    db_task.series_parts = task.get('series_parts', [])
                    db_task.updated_at = datetime.now()
                else:
                    # 创建新任务
                    task_data = {
                        'task_id': task_id,
                        'bilibili_url': task.get('bilibili_url'),
                        'video_title': task.get('video_title'),
                        'steps': task.get('steps', {}),
                        'video_url': video_url,
                        'asr_result_url': asr_result_url,
                        'knowledge_points_result_url': knowledge_points_result_url,
                        'screenshots_result_url': screenshots_result_url,
                        'video_info': task.get('video_info', {}),
                        'is_series': 1 if task.get('is_series') else 0,
                        'series_parts': task.get('series_parts', []),
                        'created_at': datetime.fromisoformat(task.get('created_at')) if task.get('created_at') else datetime.now(),
                        'updated_at': datetime.now()
                    }
                    # 只有当数据库模型有该字段时才设置
                    if hasattr(OfflineVideoTask, 'exercises_result_url'):
                        task_data['exercises_result_url'] = exercises_result_url
                    db_task = OfflineVideoTask(**task_data)
                    db.add(db_task)
                
                db.commit()
        except Exception as e:
            print(f"⚠️ 保存任务到数据库失败: {e}")
            import traceback
            traceback.print_exc()
            # 后备：保存到文件
            self._save_task_to_file(task)
    
    def _save_task_to_file(self, task: Dict[str, Any]):
        """后备：保存任务到文件"""
        task_id = task.get('task_id')
        if not task_id:
            return
        
        task_file = os.path.join(self.results_dir, f"{task_id}.json")
        try:
            with open(task_file, 'w', encoding='utf-8') as f:
                json.dump(task, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"⚠️ 保存任务到文件失败: {e}")
    
    def _load_existing_tasks(self):
        """启动时从数据库加载已存在的任务"""
        try:
            # 先测试数据库连接
            if not test_connection():
                print(f"⚠️ 数据库连接不可用，跳过从数据库加载任务")
                self._load_tasks_from_files()
                return
            
            with get_db_session() as db:
                tasks = db.query(OfflineVideoTask).all()
                loaded_count = 0
                
                for task in tasks:
                    try:
                        task_dict = task.to_dict()
                        task_id = task_dict.get('task_id')
                        if task_id:
                            self.tasks_cache[task_id] = task_dict
                            loaded_count += 1
                    except Exception as e:
                        print(f"⚠️ 转换任务数据失败: {e}")
                        continue
                
                print(f"📋 从数据库加载了 {loaded_count} 个任务")
        except Exception as e:
            print(f"⚠️ 从数据库加载任务失败: {e}")
            import traceback
            traceback.print_exc()
            # 后备：从文件加载
            self._load_tasks_from_files()
    
    def _load_tasks_from_files(self):
        """后备：从文件加载任务"""
        try:
            if not os.path.exists(self.results_dir):
                print(f"📁 Results目录不存在，跳过加载任务")
                return
            
            # 查找所有任务JSON文件
            task_files = [f for f in os.listdir(self.results_dir) if f.endswith('.json') and f.startswith('task_')]
            
            if not task_files:
                print(f"📋 未找到已存在的任务文件")
                return
            
            loaded_count = 0
            for task_file in task_files:
                try:
                    task_data = self._load_task_from_file(task_file.replace('.json', ''))
                    if task_data:
                        task_id = task_data.get('task_id')
                        if task_id:
                            self.tasks_cache[task_id] = task_data
                            loaded_count += 1
                            print(f"✅ 从文件加载任务: {task_id} - {task_data.get('video_title', 'N/A')}")
                except Exception as e:
                    print(f"⚠️ 加载任务文件失败 {task_file}: {e}")
            
            print(f"📋 从文件共加载 {loaded_count} 个任务")
        except Exception as e:
            print(f"⚠️ 从文件加载任务失败: {e}")
    
    def _load_task_from_file(self, task_id: str) -> Optional[Dict[str, Any]]:
        """从文件加载单个任务"""
        task_file = os.path.join(self.results_dir, f"{task_id}.json")
        if not os.path.exists(task_file):
            return None
        
        try:
            with open(task_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"⚠️ 读取任务文件失败 {task_file}: {e}")
            return None
    
    async def execute_step_download(self, task_id: str, mode: Optional[str] = None) -> Dict[str, Any]:
        """
        执行步骤1: 下载视频并上传（支持多P视频）
        
        Args:
            task_id: 任务ID
            mode: 执行模式 (None: 正常执行, "continue": 只执行失败的分P, "retry": 重新执行成功的分P)
            
        Returns:
            执行结果
        """
        task = self.get_task(task_id)
        if not task:
            raise ValueError(f"任务不存在: {task_id}")
        
        bilibili_url = task["bilibili_url"]
        is_series = task.get("is_series", False)
        series_parts = task.get("series_parts", [])
        
        try:
            # 检查是否已有部分完成的结果
            existing_result = task["steps"]["download"].get("result")
            completed_urls = []
            if existing_result:
                if isinstance(existing_result.get("video_urls"), list):
                    completed_urls = existing_result.get("video_urls", [])
                elif existing_result.get("video_url"):
                    completed_urls = [existing_result.get("video_url")]
            
            # 如果是多P视频，处理所有分P
            print(f"🔍 检查多P视频: is_series={is_series}, series_parts长度={len(series_parts) if series_parts else 0}")
            if is_series and series_parts:
                total_parts = len(series_parts)
                print(f"✅ 开始处理多P视频，共 {total_parts} 个分P")
                video_urls = []
                part_results = []
                
                self._update_step_status(
                    task_id, "download",
                    TaskStatus.RUNNING, 5,
                    f"开始处理系列视频（共{total_parts}个分P）..."
                )
                
                # 移除URL中的?p=参数，获取基础URL
                base_url = bilibili_url.split('?')[0] if '?' in bilibili_url else bilibili_url
                
                # 根据mode参数决定处理哪些分P
                part_results_existing = existing_result.get("part_results", []) if existing_result else []
                
                # 构建分P编号到结果的映射（用于快速查找）
                part_results_map = {r.get("part_number"): r for r in part_results_existing if r.get("part_number")}
                
                print(f"📋 开始遍历 {total_parts} 个分P... (mode={mode})")
                print(f"   已有 {len(part_results_existing)} 个分P结果记录")
                
                for idx, part_info in enumerate(series_parts, 1):
                    # 查找该分P的已有结果
                    existing_part = part_results_map.get(idx)
                    existing_url = existing_part.get("video_url") if existing_part else None
                    existing_status = existing_part.get("status") if existing_part else None
                    
                    # 判断是否需要执行该分P
                    should_skip = False
                    
                    if mode == "continue":
                        # 继续执行模式：只执行失败的或没有URL的分P
                        if existing_status == "success" and existing_url:
                            print(f"⏭️ [continue] 跳过已成功的分P {idx}/{total_parts}: {part_info.get('part_title', '')}")
                            video_urls.append(existing_url)
                            part_results.append(existing_part)
                            should_skip = True
                        elif existing_status == "completed" and existing_url:
                            print(f"⏭️ [continue] 跳过已完成的分P {idx}/{total_parts}: {part_info.get('part_title', '')}")
                            video_urls.append(existing_url)
                            part_results.append(existing_part)
                            should_skip = True
                        else:
                            print(f"🔄 [continue] 需要执行分P {idx}/{total_parts}: status={existing_status}, url={existing_url}")
                    elif mode == "retry":
                        # 重新执行模式：重新执行所有分P
                        print(f"🔄 [retry] 重新执行分P {idx}/{total_parts}: {part_info.get('part_title', '')}")
                    else:
                        # 正常模式：跳过已有URL的分P
                        if existing_url:
                            print(f"⏭️ 跳过已有URL的分P {idx}/{total_parts}: {part_info.get('part_title', '')}")
                            video_urls.append(existing_url)
                            part_results.append(existing_part if existing_part else {
                            "part_number": idx,
                            "status": "completed",
                                "video_url": existing_url
                        })
                            should_skip = True
                    
                    if should_skip:
                        continue
                    
                    part_url = part_info.get('url', f"{base_url}?p={idx}")
                    part_title = part_info.get('part_title', f'P{idx}')
                    
                    self._update_step_status(
                        task_id, "download",
                        TaskStatus.RUNNING,
                        int(5 + (idx - 1) * 85 / total_parts),
                        f"正在处理第 {idx}/{total_parts} 个分P: {part_title}"
                    )
                    
                    print(f"📥 下载分P {idx}/{total_parts}: {part_title}")
                    print(f"   URL: {part_url}")
                    
                    try:
                        # 下载视频（在线程池中执行，避免阻塞）
                        loop = asyncio.get_event_loop()
                        download_result = await loop.run_in_executor(
                            self.executor,
                            self.bilibili_service.download_video,
                            part_url,
                            f"video_{task_id}_p{idx}",
                            'best'
                        )
                        
                        if not download_result.get('success'):
                            raise Exception(f"视频下载失败: {download_result.get('error', '未知错误')}")
                        
                        video_file_path = download_result['file_path']
                        print(f"✅ 分P {idx} 下载完成: {os.path.basename(video_file_path)}")
                        
                        # 上传视频到CDN（在线程池中执行，避免阻塞）
                        print(f"📤 上传分P {idx} 到CDN...")
                        upload_result = await loop.run_in_executor(
                            self.executor,
                            self.file_upload_service.upload_file,
                            video_file_path,
                            "file0"
                        )
                        
                        if not upload_result:
                            raise Exception("视频上传失败")
                        
                        video_url = upload_result
                        if not video_url.startswith('http'):
                            video_url = f"https://file.gsxservice.com/{video_url}"
                        
                        video_urls.append(video_url)
                        part_results.append({
                            "part_number": idx,
                            "status": "success",
                            "video_url": video_url,
                            "file_path": video_file_path
                        })
                        
                        print(f"✅ 分P {idx}/{total_parts} 处理完成: {video_url}")
                        print(f"📊 当前已处理: {len(video_urls)}/{total_parts} 个分P")
                        
                        # 🔧 每上传完成一个分P就更新数据库，避免最后一起写入导致字段过长
                        try:
                            task = self.get_task(task_id)
                            if task:
                                import json
                                # video_url 字段只存储URL列表（多P为JSON字符串，单P为普通字符串）
                                # 多P视频：存储JSON字符串数组，如 '["url1", "url2", ...]'
                                # 单P视频：存储单个URL字符串，如 'url1'
                                if len(video_urls) > 1:
                                    task["video_url"] = json.dumps(video_urls)  # 多P：JSON字符串
                                elif len(video_urls) == 1:
                                    task["video_url"] = video_urls[0]  # 单P：普通字符串
                                else:
                                    task["video_url"] = None  # 空列表：None
                                
                                # 更新步骤结果（包含详细信息和统计）
                                task["steps"]["download"]["result"] = {
                                    "video_urls": video_urls,
                                    "part_results": part_results,
                                    "total_parts": total_parts,
                                    "success_count": len(video_urls),
                                    "failed_count": len(part_results) - len(video_urls)
                                }
                                self.tasks_cache[task_id] = task
                                self._save_task_to_db(task)
                                print(f"💾 已更新数据库：{len(video_urls)}/{total_parts} 个分P")
                        except Exception as e:
                            print(f"⚠️ 更新数据库失败: {e}，将继续处理下一个分P")
                        
                        # 删除本地文件
                        try:
                            if os.path.exists(video_file_path):
                                os.remove(video_file_path)
                                print(f"🗑️ 已删除本地文件: {video_file_path}")
                        except Exception as e:
                            print(f"⚠️ 删除本地文件失败: {e}")
                        
                    except Exception as e:
                        error_msg = str(e)
                        print(f"❌ 分P {idx} 处理失败: {error_msg}")
                        part_results.append({
                            "part_number": idx,
                            "status": "failed",
                            "error": error_msg
                        })
                        # 继续处理下一个分P，不中断整个流程
                        continue
                
                # 检查是否有成功的分P
                success_count = sum(1 for r in part_results if r.get("status") == "success")
                failed_count = sum(1 for r in part_results if r.get("status") == "failed")
                
                if success_count == 0:
                    raise Exception("所有分P处理失败")
                
                # 更新状态
                status_msg = f"完成 {success_count}/{total_parts} 个分P"
                if failed_count > 0:
                    status_msg += f"，{failed_count} 个失败"
                
                # 根据成功和失败数量确定状态
                if failed_count == 0:
                    step_status = TaskStatus.SUCCESS
                elif success_count == 0:
                    step_status = TaskStatus.FAILED
                else:
                    step_status = TaskStatus.PARTIAL_SUCCESS
                
                self._update_step_status(
                    task_id, "download",
                    step_status,
                    100,
                    status_msg,
                    result={
                        "video_urls": video_urls,
                        "part_results": part_results,
                        "total_parts": total_parts,
                        "success_count": success_count,
                        "failed_count": failed_count
                    }
                )
                
                # 🔧 注意：video_url 已经在每个分P上传完成时更新，这里只需要更新步骤状态
                # 最后再更新一次确保状态同步（但video_url已经在循环中更新了）
                print(f"✅ 所有分P处理完成，最终状态: {success_count}/{total_parts} 成功")
                
                return {
                    "success": True,
                    "video_urls": video_urls,
                    "part_results": part_results
                }
            
            else:
                # 单P视频：原有逻辑
                self._update_step_status(
                    task_id, "download",
                    TaskStatus.RUNNING, 10,
                    "开始下载视频..."
                )
                
                # 检查是否已完成
                if completed_urls:
                    print(f"⏭️ 跳过已完成的视频")
                    video_url = completed_urls[0]
                    self._update_step_status(
                        task_id, "download",
                        TaskStatus.SUCCESS, 100,
                        "视频已存在",
                        result={"video_url": video_url}
                    )
                    return {
                        "success": True,
                        "video_url": video_url
                    }
                
                # 提取视频信息（在线程池中执行，避免阻塞）
                print(f"📥 提取视频信息: {bilibili_url}")
                loop = asyncio.get_event_loop()
                video_info = await loop.run_in_executor(
                    self.executor,
                    self.bilibili_service.extract_video_info,
                    bilibili_url
                )
                bv_id = video_info.get('bv_id', 'unknown')
                
                self._update_step_status(
                    task_id, "download",
                    TaskStatus.RUNNING, 30,
                    f"视频信息提取成功: {video_info.get('title', '')}"
                )
                
                # 下载视频（在线程池中执行，避免阻塞）
                print(f"🎬 下载视频: {bv_id}")
                download_result = await loop.run_in_executor(
                    self.executor,
                    self.bilibili_service.download_video,
                    bilibili_url,
                    f"video_{bv_id}",
                    'best'
                )
                
                if not download_result.get('success'):
                    raise Exception(f"视频下载失败: {download_result.get('error', '未知错误')}")
                
                video_file_path = download_result['file_path']
                self._update_step_status(
                    task_id, "download",
                    TaskStatus.RUNNING, 60,
                    f"视频下载完成: {os.path.basename(video_file_path)}"
                )
                
                # 上传视频到CDN（在线程池中执行，避免阻塞）
                print(f"📤 上传视频到CDN...")
                upload_result = await loop.run_in_executor(
                    self.executor,
                    self.file_upload_service.upload_file,
                    video_file_path,
                    "file0"
                )
                
                if not upload_result:
                    raise Exception("视频上传失败")
                
                video_url = upload_result
                if not video_url.startswith('http'):
                    video_url = f"http://file.gsxservice.com/{video_url}"
                
                self._update_step_status(
                    task_id, "download",
                    TaskStatus.SUCCESS, 100,
                    "视频上传成功",
                    result={"video_url": video_url, "file_path": video_file_path}
                )
                
                # 更新任务信息
                task = self.get_task(task_id)
                if task:
                    task["video_url"] = video_url
                    self.tasks_cache[task_id] = task
                    self._save_task_to_db(task)
                
                # 删除本地文件
                try:
                    if os.path.exists(video_file_path):
                        os.remove(video_file_path)
                        print(f"🗑️ 已删除本地文件: {video_file_path}")
                except Exception as e:
                    print(f"⚠️ 删除本地文件失败: {e}")
                
                return {
                    "success": True,
                    "video_url": video_url,
                    "file_path": video_file_path
                }
            
        except Exception as e:
            error_msg = str(e)
            print(f"❌ 下载步骤失败: {error_msg}")
            import traceback
            traceback.print_exc()
            self._update_step_status(
                task_id, "download",
                TaskStatus.FAILED, 0,
                f"执行失败: {error_msg}",
                error=error_msg
            )
            raise
    
    async def execute_step_asr(self, task_id: str, mode: Optional[str] = None) -> Dict[str, Any]:
        """
        执行步骤2: ASR识别（支持多P视频）
        
        Args:
            task_id: 任务ID
            mode: 执行模式 (None: 正常执行, "continue": 只执行失败的分P, "retry": 重新执行成功的分P)
            
        Returns:
            执行结果
        """
        task = self.get_task(task_id)
        if not task:
            raise ValueError(f"任务不存在: {task_id}")
        
        # 检查上一步是否完成（必须有上传的视频URL）
        if task["steps"]["download"]["status"] not in [TaskStatus.SUCCESS, TaskStatus.PARTIAL_SUCCESS]:
            raise ValueError("请先完成下载步骤")
        
        is_series = task.get("is_series", False)
        series_parts = task.get("series_parts", [])
        
        # 获取视频URL列表
        video_url_data = task.get("video_url")
        if not video_url_data:
            raise ValueError("视频URL不存在，请先完成下载并上传步骤")
        
        # 解析URL（可能是字符串或JSON）
        import json
        try:
            if isinstance(video_url_data, str) and video_url_data.startswith('['):
                video_urls = json.loads(video_url_data)
            elif isinstance(video_url_data, list):
                video_urls = video_url_data
            else:
                video_urls = [video_url_data]
        except:
            video_urls = [video_url_data]
        
        try:
            # 检查是否已有部分完成的结果
            existing_result = task["steps"]["asr"].get("result")
            completed_urls = []
            if existing_result:
                if isinstance(existing_result.get("result_urls"), list):
                    completed_urls = existing_result.get("result_urls", [])
                elif existing_result.get("result_url"):
                    completed_urls = [existing_result.get("result_url")]
            
            # 如果是多P视频，处理所有分P
            if is_series and len(video_urls) > 1:
                total_parts = len(video_urls)
                asr_result_urls = []
                part_results = []
                
                self._update_step_status(
                    task_id, "asr",
                    TaskStatus.RUNNING, 5,
                    f"开始ASR识别（共{total_parts}个分P）..."
                )
                
                # 根据mode参数决定处理哪些分P
                part_results_existing = existing_result.get("part_results", []) if existing_result else []
                
                # 构建分P编号到结果的映射（用于快速查找）
                part_results_map = {r.get("part_number"): r for r in part_results_existing if r.get("part_number")}
                
                print(f"📋 开始遍历 {total_parts} 个分P的ASR... (mode={mode})")
                print(f"   已有 {len(part_results_existing)} 个分P结果记录")
                
                for idx, video_url in enumerate(video_urls, 1):
                    # 查找该分P的已有结果
                    existing_part = part_results_map.get(idx)
                    existing_url = existing_part.get("result_url") if existing_part else None
                    existing_status = existing_part.get("status") if existing_part else None
                    
                    # 判断是否需要执行该分P
                    should_skip = False
                    
                    if mode == "continue":
                        # 继续执行模式：只执行失败的或没有URL的分P
                        if existing_status == "success" and existing_url:
                            print(f"⏭️ [continue] 跳过已成功的分P {idx}/{total_parts} ASR")
                            asr_result_urls.append(existing_url)
                            part_results.append(existing_part)
                            should_skip = True
                        elif existing_status == "completed" and existing_url:
                            print(f"⏭️ [continue] 跳过已完成的分P {idx}/{total_parts} ASR")
                            asr_result_urls.append(existing_url)
                            part_results.append(existing_part)
                            should_skip = True
                        else:
                            print(f"🔄 [continue] 需要执行分P {idx}/{total_parts} ASR: status={existing_status}, url={existing_url}")
                    elif mode == "retry":
                        # 重新执行模式：重新执行所有分P
                        print(f"🔄 [retry] 重新执行分P {idx}/{total_parts} ASR")
                    else:
                        # 正常模式：跳过已有URL的分P
                        if existing_url:
                            print(f"⏭️ 跳过已有URL的分P {idx}/{total_parts} ASR")
                            asr_result_urls.append(existing_url)
                            part_results.append(existing_part if existing_part else {
                            "part_number": idx,
                            "status": "completed",
                                "result_url": existing_url
                        })
                            should_skip = True
                    
                    if should_skip:
                        continue
                    
                    part_title = series_parts[idx - 1].get('part_title', f'P{idx}') if idx <= len(series_parts) else f'P{idx}'
                    
                    self._update_step_status(
                        task_id, "asr",
                        TaskStatus.RUNNING,
                        int(5 + (idx - 1) * 85 / total_parts),
                        f"正在处理第 {idx}/{total_parts} 个分P的ASR: {part_title}"
                    )
                    
                    print(f"📝 创建分P {idx}/{total_parts} 的ASR任务: {part_title}")
                    print(f"   URL: {video_url}")
                    
                    try:
                        # 创建ASR任务
                        asr_task = await self.asr_service.create_async_task(video_url, biz_id="bilibili")
                        asr_task_id = asr_task.id
                        
                        print(f"✅ ASR任务已创建: {asr_task_id}")
                        
                        # 等待ASR完成
                        print(f"⏳ 等待分P {idx} ASR完成...")
                        asr_result = await self.asr_service.wait_for_completion(asr_task_id)
                        
                        # 提取逐字稿
                        transcript = self.asr_service.extract_transcript(asr_result, with_timestamps=True)
                        
                        print(f"✅ 分P {idx} ASR识别完成，逐字稿长度: {len(transcript)} 字符")
                        
                        # 保存ASR结果到文件
                        asr_doc_path = os.path.join(self.results_dir, f"{task_id}_asr_p{idx}.txt")
                        with open(asr_doc_path, 'w', encoding='utf-8') as f:
                            f.write(transcript)
                        
                        # 上传ASR结果文件（在线程池中执行，避免阻塞）
                        print(f"📤 上传分P {idx} ASR结果文件...")
                        loop = asyncio.get_event_loop()
                        asr_result_url = await loop.run_in_executor(
                            self.executor,
                            self.file_upload_service.upload_file,
                            asr_doc_path,
                            "file0",
                            "text/plain; charset=utf-8"
                        )
                        
                        if not asr_result_url:
                            raise Exception("ASR结果文件上传失败")
                        
                        if not asr_result_url.startswith('http'):
                            asr_result_url = f"https://file.gsxservice.com/{asr_result_url}"
                        
                        asr_result_urls.append(asr_result_url)
                        part_results.append({
                            "part_number": idx,
                            "status": "success",
                            "result_url": asr_result_url,
                            "transcript_length": len(transcript)
                        })
                        
                        # 删除本地文件
                        try:
                            if os.path.exists(asr_doc_path):
                                os.remove(asr_doc_path)
                                print(f"🗑️ 已删除本地ASR文件: {asr_doc_path}")
                        except Exception as e:
                            print(f"⚠️ 删除本地ASR文件失败: {e}")
                        
                        print(f"✅ 分P {idx} ASR处理完成: {asr_result_url}")
                        
                    except Exception as e:
                        error_msg = str(e)
                        print(f"❌ 分P {idx} ASR处理失败: {error_msg}")
                        part_results.append({
                            "part_number": idx,
                            "status": "failed",
                            "error": error_msg
                        })
                        # 继续处理下一个分P
                        continue
                
                # 检查是否有成功的分P
                success_count = sum(1 for r in part_results if r.get("status") == "success")
                failed_count = sum(1 for r in part_results if r.get("status") == "failed")
                
                if success_count == 0:
                    raise Exception("所有分P ASR处理失败")
                
                # 更新状态
                status_msg = f"完成 {success_count}/{total_parts} 个分P的ASR"
                if failed_count > 0:
                    status_msg += f"，{failed_count} 个失败"
                
                # 根据成功和失败数量确定状态
                if failed_count == 0:
                    step_status = TaskStatus.SUCCESS
                elif success_count == 0:
                    step_status = TaskStatus.FAILED
                else:
                    step_status = TaskStatus.PARTIAL_SUCCESS
                
                self._update_step_status(
                    task_id, "asr",
                    step_status,
                    100,
                    status_msg,
                    result={
                        "result_urls": asr_result_urls,
                        "part_results": part_results,
                        "total_parts": total_parts,
                        "success_count": success_count,
                        "failed_count": failed_count
                    }
                )
                
                # 更新任务信息
                task = self.get_task(task_id)
                if task:
                    task["asr_result_url"] = json.dumps(asr_result_urls) if len(asr_result_urls) > 1 else (asr_result_urls[0] if asr_result_urls else None)
                    self.tasks_cache[task_id] = task
                    self._save_task_to_db(task)
                
                return {
                    "success": True,
                    "result_urls": asr_result_urls,
                    "part_results": part_results
                }
            
            else:
                # 单P视频：原有逻辑
                video_url = video_urls[0]
                
                # 检查是否已完成
                if completed_urls:
                    print(f"⏭️ 跳过已完成的ASR")
                    asr_result_url = completed_urls[0]
                    self._update_step_status(
                        task_id, "asr",
                        TaskStatus.SUCCESS, 100,
                        "ASR已存在",
                        result={"result_url": asr_result_url}
                    )
                    return {
                        "success": True,
                        "result_url": asr_result_url
                    }
                
                self._update_step_status(
                    task_id, "asr",
                    TaskStatus.RUNNING, 10,
                    "开始ASR识别..."
                )
                
                # 创建ASR任务
                print(f"📝 创建ASR任务: {video_url}")
                asr_task = await self.asr_service.create_async_task(video_url, biz_id="bilibili")
                asr_task_id = asr_task.id
                
                self._update_step_status(
                    task_id, "asr",
                    TaskStatus.RUNNING, 30,
                    f"ASR任务已创建: {asr_task_id}"
                )
                
                # 等待ASR完成
                print(f"⏳ 等待ASR完成...")
                asr_result = await self.asr_service.wait_for_completion(asr_task_id)
                
                # 提取逐字稿
                transcript = self.asr_service.extract_transcript(asr_result, with_timestamps=True)
                
                self._update_step_status(
                    task_id, "asr",
                    TaskStatus.RUNNING, 70,
                    f"ASR识别完成，逐字稿长度: {len(transcript)} 字符"
                )
                
                # 保存ASR结果到文件
                asr_doc_path = os.path.join(self.results_dir, f"{task_id}_asr.txt")
                with open(asr_doc_path, 'w', encoding='utf-8') as f:
                    f.write(transcript)
                
                self._update_step_status(
                    task_id, "asr",
                    TaskStatus.RUNNING, 80,
                    "正在上传ASR结果文件..."
                )
                
                # 上传ASR结果文件（在线程池中执行，避免阻塞）
                print(f"📤 上传ASR结果文件: {asr_doc_path}")
                loop = asyncio.get_event_loop()
                asr_result_url = await loop.run_in_executor(
                    self.executor,
                    self.file_upload_service.upload_file,
                    asr_doc_path,
                    "file0",
                    "text/plain; charset=utf-8"
                )
                
                if not asr_result_url:
                    raise Exception("ASR结果文件上传失败")
                
                if not asr_result_url.startswith('http'):
                    asr_result_url = f"http://file.gsxservice.com/{asr_result_url}"
                
                print(f"✅ ASR结果文件上传成功: {asr_result_url}")
                
                # 只保存URL和统计信息，不保存完整的transcript内容
                self._update_step_status(
                    task_id, "asr",
                    TaskStatus.SUCCESS, 100,
                    f"ASR识别完成，逐字稿长度: {len(transcript)} 字符",
                    result={
                        "result_url": asr_result_url,
                        "transcript_length": len(transcript)  # 只保存长度，不保存内容
                    }
                )
                
                # 更新任务信息
                task = self.get_task(task_id)
                if task:
                    task["asr_result_url"] = asr_result_url
                    self.tasks_cache[task_id] = task
                    self._save_task_to_db(task)
                
                # 上传成功后删除本地文件
                try:
                    if os.path.exists(asr_doc_path):
                        os.remove(asr_doc_path)
                        print(f"🗑️ 已删除本地ASR文件: {asr_doc_path}")
                except Exception as e:
                    print(f"⚠️ 删除本地ASR文件失败: {e}")
                
                return {
                    "success": True,
                    "transcript": transcript,
                    "document_path": asr_doc_path,
                    "result_url": asr_result_url
                }
            
        except Exception as e:
            error_msg = str(e)
            print(f"❌ ASR步骤失败: {error_msg}")
            import traceback
            traceback.print_exc()
            self._update_step_status(
                task_id, "asr",
                TaskStatus.FAILED, 0,
                f"执行失败: {error_msg}",
                error=error_msg
            )
            raise
    
    async def execute_step_knowledge_points(self, task_id: str, mode: Optional[str] = None) -> Dict[str, Any]:
        """
        执行步骤3: 生成知识点（支持多P视频）
        
        Args:
            task_id: 任务ID
            mode: 执行模式 (None: 正常执行, "continue": 只执行失败的分P, "retry": 重新执行成功的分P)
            
        Returns:
            执行结果
        """
        task = self.get_task(task_id)
        if not task:
            raise ValueError(f"任务不存在: {task_id}")
        
        # 检查上一步是否完成（必须有ASR结果URL）
        if task["steps"]["asr"]["status"] not in [TaskStatus.SUCCESS, TaskStatus.PARTIAL_SUCCESS]:
            raise ValueError("请先完成ASR步骤")
        
        is_series = task.get("is_series", False)
        series_parts = task.get("series_parts", [])
        
        # 获取locale参数（从任务中获取，默认为'zh'）
        locale = task.get("locale", "zh")
        
        # 获取ASR结果URL列表
        asr_result_url_data = task.get("asr_result_url")
        if not asr_result_url_data:
            raise ValueError("ASR结果URL不存在，请先完成ASR步骤")
        
        # 解析URL（可能是字符串或JSON）
        import json
        try:
            if isinstance(asr_result_url_data, str) and asr_result_url_data.startswith('['):
                asr_result_urls = json.loads(asr_result_url_data)
            elif isinstance(asr_result_url_data, list):
                asr_result_urls = asr_result_url_data
            else:
                asr_result_urls = [asr_result_url_data]
        except:
            asr_result_urls = [asr_result_url_data]
        
        try:
            # 检查是否已有部分完成的结果
            existing_result = task["steps"]["knowledge_points"].get("result")
            completed_urls = []
            if existing_result:
                if isinstance(existing_result.get("result_urls"), list):
                    completed_urls = existing_result.get("result_urls", [])
                elif existing_result.get("result_url"):
                    completed_urls = [existing_result.get("result_url")]
            
            # 如果是多P视频，处理所有分P
            if is_series and len(asr_result_urls) > 1:
                total_parts = len(asr_result_urls)
                knowledge_points_result_urls = []
                part_results = []
                all_knowledge_points = []
                
                self._update_step_status(
                    task_id, "knowledge_points",
                    TaskStatus.RUNNING, 5,
                    f"开始生成知识点（共{total_parts}个分P）..."
                )
                
                # 根据mode参数决定处理哪些分P
                part_results_existing = existing_result.get("part_results", []) if existing_result else []
                
                # 构建分P编号到结果的映射（用于快速查找）
                part_results_map = {r.get("part_number"): r for r in part_results_existing if r.get("part_number")}
                
                print(f"📋 开始遍历 {total_parts} 个分P的知识点生成... (mode={mode})")
                print(f"   已有 {len(part_results_existing)} 个分P结果记录")
                
                for idx, asr_result_url in enumerate(asr_result_urls, 1):
                    # 查找该分P的已有结果
                    existing_part = part_results_map.get(idx)
                    existing_url = existing_part.get("result_url") if existing_part else None
                    existing_status = existing_part.get("status") if existing_part else None
                    
                    # 判断是否需要执行该分P
                    should_skip = False
                    
                    if mode == "continue":
                        # 继续执行模式：只执行失败的或没有URL的分P
                        if existing_status == "success" and existing_url:
                            print(f"⏭️ [continue] 跳过已成功的分P {idx}/{total_parts} 知识点生成")
                            knowledge_points_result_urls.append(existing_url)
                            part_results.append(existing_part)
                            should_skip = True
                        elif existing_status == "completed" and existing_url:
                            print(f"⏭️ [continue] 跳过已完成的分P {idx}/{total_parts} 知识点生成")
                            knowledge_points_result_urls.append(existing_url)
                            part_results.append(existing_part)
                            should_skip = True
                        else:
                            print(f"🔄 [continue] 需要执行分P {idx}/{total_parts} 知识点生成: status={existing_status}, url={existing_url}")
                    elif mode == "retry":
                        # 重新执行模式：重新执行所有分P
                        print(f"🔄 [retry] 重新执行分P {idx}/{total_parts} 知识点生成")
                    else:
                        # 正常模式：跳过已有URL的分P
                        if existing_url:
                            print(f"⏭️ 跳过已有URL的分P {idx}/{total_parts} 知识点生成")
                            knowledge_points_result_urls.append(existing_url)
                            part_results.append(existing_part if existing_part else {
                            "part_number": idx,
                            "status": "completed",
                                "result_url": existing_url
                        })
                            should_skip = True
                    
                    if should_skip:
                        continue
                    
                    part_title = series_parts[idx - 1].get('part_title', f'P{idx}') if idx <= len(series_parts) else f'P{idx}'
                    
                    self._update_step_status(
                        task_id, "knowledge_points",
                        TaskStatus.RUNNING,
                        int(5 + (idx - 1) * 85 / total_parts),
                        f"正在处理第 {idx}/{total_parts} 个分P的知识点: {part_title}"
                    )
                    
                    print(f"📚 生成分P {idx}/{total_parts} 的知识点: {part_title}")
                    print(f"   ASR URL: {asr_result_url}")
                    
                    try:
                        # 从URL下载ASR结果（在线程池中执行，避免阻塞）
                        print(f"📥 从URL下载分P {idx} 的ASR结果...")
                        loop = asyncio.get_event_loop()
                        
                        def download_asr_result():
                            response = requests.get(asr_result_url, timeout=30)
                            response.raise_for_status()
                            return response.text
                        
                        transcript = await loop.run_in_executor(
                            self.executor,
                            download_asr_result
                        )
                        print(f"✅ ASR结果下载成功，长度: {len(transcript)} 字符")
                        
                        # 生成知识点（使用从任务中获取的locale参数）
                        print(f"📚 生成知识点，逐字稿长度: {len(transcript)} 字符 (locale={locale})")
                        knowledge_points = await self.knowledge_point_extractor.extract_knowledge_points(
                            transcript,
                            locale=locale
                        )
                        
                        print(f"✅ 分P {idx} 知识点生成完成，共 {len(knowledge_points)} 个知识点")
                        all_knowledge_points.extend(knowledge_points)
                        
                        # 保存知识点到文件
                        knowledge_points_json = json.dumps(
                            {"knowledge_points": knowledge_points},
                            ensure_ascii=False,
                            indent=2
                        )
                        
                        knowledge_points_doc_path = os.path.join(
                            self.results_dir,
                            f"{task_id}_knowledge_points_p{idx}.json"
                        )
                        with open(knowledge_points_doc_path, 'w', encoding='utf-8') as f:
                            f.write(knowledge_points_json)
                        
                        # 上传知识点结果文件（在线程池中执行，避免阻塞）
                        print(f"📤 上传分P {idx} 知识点结果文件...")
                        loop = asyncio.get_event_loop()
                        knowledge_points_result_url = await loop.run_in_executor(
                            self.executor,
                            self.file_upload_service.upload_file,
                            knowledge_points_doc_path,
                            "file0",
                            "application/json; charset=utf-8"
                        )
                        
                        if not knowledge_points_result_url:
                            raise Exception("知识点结果文件上传失败")
                        
                        if not knowledge_points_result_url.startswith('http'):
                            knowledge_points_result_url = f"https://file.gsxservice.com/{knowledge_points_result_url}"
                        
                        knowledge_points_result_urls.append(knowledge_points_result_url)
                        part_results.append({
                            "part_number": idx,
                            "status": "success",
                            "result_url": knowledge_points_result_url,
                            "knowledge_points_count": len(knowledge_points)
                        })
                        
                        print(f"✅ 分P {idx}/{total_parts} 知识点处理完成: {knowledge_points_result_url}")
                        print(f"📊 当前已处理: {len(knowledge_points_result_urls)}/{total_parts} 个分P")
                        
                        # 🔧 每处理完一个分P就更新数据库，避免最后一起写入导致字段过长
                        try:
                            task = self.get_task(task_id)
                            if task:
                                # knowledge_points_result_url 字段只存储URL列表（多P为JSON字符串，单P为普通字符串）
                                # 多P视频：存储JSON字符串数组，如 '["url1", "url2", ...]'
                                # 单P视频：存储单个URL字符串，如 'url1'
                                if len(knowledge_points_result_urls) > 1:
                                    task["knowledge_points_result_url"] = json.dumps(knowledge_points_result_urls)  # 多P：JSON字符串
                                elif len(knowledge_points_result_urls) == 1:
                                    task["knowledge_points_result_url"] = knowledge_points_result_urls[0]  # 单P：普通字符串
                                else:
                                    task["knowledge_points_result_url"] = None  # 空列表：None
                                
                                # 更新步骤结果（包含详细信息和统计）
                                task["steps"]["knowledge_points"]["result"] = {
                                    "result_urls": knowledge_points_result_urls,
                                    "part_results": part_results,
                                    "total_parts": total_parts,
                                    "success_count": len(knowledge_points_result_urls),
                                    "failed_count": len(part_results) - len(knowledge_points_result_urls),
                                    "total_knowledge_points": len(all_knowledge_points)
                                }
                                self.tasks_cache[task_id] = task
                                self._save_task_to_db(task)
                                print(f"💾 已更新数据库：{len(knowledge_points_result_urls)}/{total_parts} 个分P")
                        except Exception as e:
                            print(f"⚠️ 更新数据库失败: {e}，将继续处理下一个分P")
                        
                        # 删除本地文件
                        try:
                            if os.path.exists(knowledge_points_doc_path):
                                os.remove(knowledge_points_doc_path)
                                print(f"🗑️ 已删除本地知识点文件: {knowledge_points_doc_path}")
                        except Exception as e:
                            print(f"⚠️ 删除本地知识点文件失败: {e}")
                        
                    except Exception as e:
                        error_msg = str(e)
                        print(f"❌ 分P {idx} 知识点生成失败: {error_msg}")
                        import traceback
                        traceback.print_exc()
                        part_results.append({
                            "part_number": idx,
                            "status": "failed",
                            "error": error_msg
                        })
                        # 继续处理下一个分P
                        continue
                
                # 检查是否有成功的分P
                success_count = sum(1 for r in part_results if r.get("status") == "success")
                failed_count = sum(1 for r in part_results if r.get("status") == "failed")
                
                if success_count == 0:
                    raise Exception("所有分P知识点生成失败")
                
                # 更新状态
                status_msg = f"完成 {success_count}/{total_parts} 个分P的知识点生成"
                if failed_count > 0:
                    status_msg += f"，{failed_count} 个失败"
                
                # 根据成功和失败数量确定状态
                if failed_count == 0:
                    step_status = TaskStatus.SUCCESS
                elif success_count == 0:
                    step_status = TaskStatus.FAILED
                else:
                    step_status = TaskStatus.PARTIAL_SUCCESS
                
                self._update_step_status(
                    task_id, "knowledge_points",
                    step_status,
                    100,
                    status_msg,
                    result={
                        "result_urls": knowledge_points_result_urls,
                        "part_results": part_results,
                        "total_parts": total_parts,
                        "success_count": success_count,
                        "failed_count": failed_count,
                        "total_knowledge_points": len(all_knowledge_points)
                    }
                )
                
                # 更新任务信息（最终确认）
                task = self.get_task(task_id)
                if task:
                    task["knowledge_points_result_url"] = json.dumps(knowledge_points_result_urls) if len(knowledge_points_result_urls) > 1 else (knowledge_points_result_urls[0] if knowledge_points_result_urls else None)
                    self.tasks_cache[task_id] = task
                    self._save_task_to_db(task)
                
                return {
                    "success": True,
                    "result_urls": knowledge_points_result_urls,
                    "part_results": part_results,
                    "all_knowledge_points": all_knowledge_points
                }
            
            else:
                # 单P视频：原有逻辑
                asr_result_url = asr_result_urls[0]
                
                # 检查是否已完成
                if completed_urls:
                    print(f"⏭️ 跳过已完成的知识点生成")
                    knowledge_points_result_url = completed_urls[0]
                    self._update_step_status(
                        task_id, "knowledge_points",
                        TaskStatus.SUCCESS, 100,
                        "知识点已存在",
                        result={"result_url": knowledge_points_result_url}
                    )
                    return {
                        "success": True,
                        "result_url": knowledge_points_result_url
                    }
                
                # 获取transcript：优先从result中获取（兼容旧数据），否则从URL下载
                asr_result = task["steps"]["asr"]["result"]
                transcript = None
                
                if asr_result and "transcript" in asr_result:
                    # 旧数据：直接从result中获取
                    transcript = asr_result["transcript"]
                else:
                    # 新数据：从asr_result_url下载（在线程池中执行，避免阻塞）
                    print(f"📥 从URL下载ASR结果: {asr_result_url}")
                    try:
                        loop = asyncio.get_event_loop()
                        
                        def download_asr_result():
                            response = requests.get(asr_result_url, timeout=30)
                            response.raise_for_status()
                            return response.text
                        
                        transcript = await loop.run_in_executor(
                            self.executor,
                            download_asr_result
                        )
                        print(f"✅ ASR结果下载成功，长度: {len(transcript)} 字符")
                    except Exception as e:
                        raise ValueError(f"从URL下载ASR结果失败: {e}")
                
                if not transcript:
                    raise ValueError("无法获取ASR transcript")
                
                self._update_step_status(
                    task_id, "knowledge_points",
                    TaskStatus.RUNNING, 10,
                    "开始生成知识点..."
                )
                
                # 获取locale参数（从任务中获取，默认为'zh'）
                locale = task.get("locale", "zh")
                
                # 生成知识点
                print(f"📚 生成知识点，逐字稿长度: {len(transcript)} 字符 (locale={locale})")
                knowledge_points = await self.knowledge_point_extractor.extract_knowledge_points(
                    transcript,
                    locale=locale
                )
                
                self._update_step_status(
                    task_id, "knowledge_points",
                    TaskStatus.RUNNING, 80,
                    f"知识点生成完成，共 {len(knowledge_points)} 个知识点"
                )
                
                # 保存知识点到文件
                knowledge_points_json = json.dumps(
                    {"knowledge_points": knowledge_points},
                    ensure_ascii=False,
                    indent=2
                )
                
                knowledge_points_doc_path = os.path.join(
                    self.results_dir,
                    f"{task_id}_knowledge_points.json"
                )
                with open(knowledge_points_doc_path, 'w', encoding='utf-8') as f:
                    f.write(knowledge_points_json)
                
                self._update_step_status(
                    task_id, "knowledge_points",
                    TaskStatus.RUNNING, 85,
                    "正在上传知识点结果文件..."
                )
                
                # 上传知识点结果文件（在线程池中执行，避免阻塞）
                print(f"📤 上传知识点结果文件: {knowledge_points_doc_path}")
                loop = asyncio.get_event_loop()
                knowledge_points_result_url = await loop.run_in_executor(
                    self.executor,
                    self.file_upload_service.upload_file,
                    knowledge_points_doc_path,
                    "file0",
                    "application/json; charset=utf-8"
                )
                
                if not knowledge_points_result_url:
                    raise Exception("知识点结果文件上传失败")
                
                if not knowledge_points_result_url.startswith('http'):
                    knowledge_points_result_url = f"http://file.gsxservice.com/{knowledge_points_result_url}"
                
                print(f"✅ 知识点结果文件上传成功: {knowledge_points_result_url}")
                
                # 只保存URL和统计信息，不保存完整的知识点内容
                self._update_step_status(
                    task_id, "knowledge_points",
                    TaskStatus.SUCCESS, 100,
                    f"知识点生成完成，共 {len(knowledge_points)} 个知识点",
                    result={
                        "result_url": knowledge_points_result_url,
                        "knowledge_points_count": len(knowledge_points)  # 只保存数量，不保存内容
                    }
                )
                
                # 更新任务信息
                task = self.get_task(task_id)
                if task:
                    task["knowledge_points_result_url"] = knowledge_points_result_url
                    self.tasks_cache[task_id] = task
                    self._save_task_to_db(task)
                
                # 上传成功后删除本地文件
                try:
                    if os.path.exists(knowledge_points_doc_path):
                        os.remove(knowledge_points_doc_path)
                        print(f"🗑️ 已删除本地知识点文件: {knowledge_points_doc_path}")
                except Exception as e:
                    print(f"⚠️ 删除本地知识点文件失败: {e}")
                
                return {
                    "success": True,
                    "knowledge_points": knowledge_points,
                    "document_path": knowledge_points_doc_path,
                    "result_url": knowledge_points_result_url
                }
            
        except Exception as e:
            error_msg = str(e)
            print(f"❌ 知识点生成步骤失败: {error_msg}")
            import traceback
            traceback.print_exc()
            self._update_step_status(
                task_id, "knowledge_points",
                TaskStatus.FAILED, 0,
                f"执行失败: {error_msg}",
                error=error_msg
            )
            raise
    
    async def execute_step_screenshots(self, task_id: str, mode: Optional[str] = None) -> Dict[str, Any]:
        """
        执行步骤4: 生成截图（支持多P视频）
        
        Args:
            task_id: 任务ID
            mode: 执行模式 (None: 正常执行, "continue": 只执行失败的分P, "retry": 重新执行成功的分P)
            
        Returns:
            执行结果
        """
        task = self.get_task(task_id)
        if not task:
            raise ValueError(f"任务不存在: {task_id}")
        
        # 检查上一步是否完成（必须有知识点结果URL）
        if task["steps"]["knowledge_points"]["status"] not in [TaskStatus.SUCCESS, TaskStatus.PARTIAL_SUCCESS]:
            raise ValueError("请先完成知识点生成步骤")
        
        is_series = task.get("is_series", False)
        series_parts = task.get("series_parts", [])
        
        # 获取知识点结果URL列表
        knowledge_points_result_url_data = task.get("knowledge_points_result_url")
        if not knowledge_points_result_url_data:
            raise ValueError("知识点结果URL不存在，请先完成知识点生成步骤")
        
        # 获取视频URL列表
        video_url_data = task.get("video_url")
        if not video_url_data:
            raise ValueError("视频URL不存在，请先完成视频下载步骤")
        
        # 解析URL（可能是字符串或JSON）
        import json
        try:
            if isinstance(knowledge_points_result_url_data, str) and knowledge_points_result_url_data.startswith('['):
                knowledge_points_result_urls = json.loads(knowledge_points_result_url_data)
            elif isinstance(knowledge_points_result_url_data, list):
                knowledge_points_result_urls = knowledge_points_result_url_data
            else:
                knowledge_points_result_urls = [knowledge_points_result_url_data]
        except:
            knowledge_points_result_urls = [knowledge_points_result_url_data]
        
        try:
            if isinstance(video_url_data, str) and video_url_data.startswith('['):
                video_urls = json.loads(video_url_data)
            elif isinstance(video_url_data, list):
                video_urls = video_url_data
            else:
                video_urls = [video_url_data]
        except:
            video_urls = [video_url_data]
        
        try:
            # 检查是否已有部分完成的结果
            existing_result = task["steps"]["screenshots"].get("result")
            completed_urls = []
            if existing_result:
                if isinstance(existing_result.get("result_urls"), list):
                    completed_urls = existing_result.get("result_urls", [])
                elif existing_result.get("result_url"):
                    completed_urls = [existing_result.get("result_url")]
            
            # 如果是多P视频，处理所有分P
            if is_series and len(knowledge_points_result_urls) > 1:
                total_parts = len(knowledge_points_result_urls)
                screenshots_result_urls = []
                part_results = []
                
                self._update_step_status(
                    task_id, "screenshots",
                    TaskStatus.RUNNING, 5,
                    f"开始生成截图（共{total_parts}个分P）..."
                )
                
                # 根据mode参数决定处理哪些分P
                part_results_existing = existing_result.get("part_results", []) if existing_result else []
                
                # 构建分P编号到结果的映射
                part_results_map = {r.get("part_number"): r for r in part_results_existing if r.get("part_number")}
                
                print(f"\n📋 开始遍历 {total_parts} 个分P的截图生成... (mode={mode})")
                print(f"   已有 {len(part_results_existing)} 个分P结果记录")
                
                # 🔍 调试模式：先分析执行计划
                print("\n" + "="*80)
                print("🔍 调试模式：分析执行计划")
                print("="*80)
                
                execution_plan = []
                
                for idx, (kp_url, video_url) in enumerate(zip(knowledge_points_result_urls, video_urls), 1):
                    # 查找该分P的已有结果
                    existing_part = part_results_map.get(idx)
                    existing_url = existing_part.get("result_url") if existing_part else None
                    existing_status = existing_part.get("status") if existing_part else None
                    
                    # 判断是否需要执行
                    will_skip = False
                    reason = ""
                    
                    if mode == "continue":
                        # 继续执行模式：只执行失败的或没有URL的分P
                        if existing_status == "success" and existing_url:
                            will_skip = True
                            reason = f"已成功 (有URL)"
                        elif existing_status == "completed" and existing_url:
                            will_skip = True
                            reason = f"已完成 (有URL)"
                        elif existing_url:
                            will_skip = True
                            reason = f"有URL (status={existing_status})"
                        else:
                            will_skip = False
                            reason = f"需要执行 (status={existing_status or 'None'}, 无URL)"
                    elif mode == "retry":
                        # 重新执行模式：重新执行所有分P
                        will_skip = False
                        reason = "retry模式，重新执行"
                    else:
                        # 正常模式：跳过已有URL的分P
                        if existing_url:
                            will_skip = True
                            reason = f"已有URL (status={existing_status})"
                        else:
                            will_skip = False
                            reason = "无URL，需要执行"
                    
                    execution_plan.append({
                        "part_number": idx,
                        "part_title": series_parts[idx - 1].get('part_title', f'P{idx}') if idx <= len(series_parts) else f'P{idx}',
                        "will_skip": will_skip,
                        "reason": reason,
                        "existing_url": existing_url[:80] + "..." if existing_url and len(existing_url) > 80 else existing_url,
                        "existing_status": existing_status
                    })
                    
                    status_icon = "⏭️" if will_skip else "🔄"
                    action = "跳过" if will_skip else "执行"
                    print(f"{status_icon} P{idx:2d}/{total_parts}: {action:4s} - {reason}")
                    if existing_url:
                        print(f"      URL: {existing_url[:80]}...")
                
                print("="*80)
                to_execute_count = sum(1 for p in execution_plan if not p["will_skip"])
                to_skip_count = sum(1 for p in execution_plan if p["will_skip"])
                print(f"📊 执行计划统计:")
                print(f"   需要执行: {to_execute_count} 个分P")
                print(f"   将跳过: {to_skip_count} 个分P")
                print(f"   总计: {total_parts} 个分P")
                print("="*80 + "\n")
                
                # ✅ 开始实际执行
                print("🚀 开始执行截图生成任务...")
                
                for idx, (kp_url, video_url) in enumerate(zip(knowledge_points_result_urls, video_urls), 1):
                    # 查找该分P的已有结果
                    existing_part = part_results_map.get(idx)
                    existing_url = existing_part.get("result_url") if existing_part else None
                    existing_status = existing_part.get("status") if existing_part else None
                    
                    # 判断是否需要执行该分P
                    should_skip = False
                    
                    if mode == "continue":
                        # 继续执行模式：只执行失败的或没有URL的分P
                        if existing_status == "success" and existing_url:
                            print(f"⏭️ [continue] 跳过已成功的分P {idx}/{total_parts} 截图生成")
                            screenshots_result_urls.append(existing_url)
                            part_results.append(existing_part)
                            should_skip = True
                        elif existing_status == "completed" and existing_url:
                            print(f"⏭️ [continue] 跳过已完成的分P {idx}/{total_parts} 截图生成")
                            screenshots_result_urls.append(existing_url)
                            part_results.append(existing_part)
                            should_skip = True
                        else:
                            print(f"🔄 [continue] 需要执行分P {idx}/{total_parts} 截图生成: status={existing_status}, url={existing_url}")
                    elif mode == "retry":
                        # 重新执行模式：重新执行所有分P
                        print(f"🔄 [retry] 重新执行分P {idx}/{total_parts} 截图生成")
                    else:
                        # 正常模式：跳过已有URL的分P
                        if existing_url:
                            print(f"⏭️ 跳过已有URL的分P {idx}/{total_parts} 截图生成")
                            screenshots_result_urls.append(existing_url)
                            part_results.append(existing_part if existing_part else {
                                "part_number": idx,
                                "status": "completed",
                                "result_url": existing_url
                            })
                            should_skip = True
                    
                    if should_skip:
                        continue
                    
                    part_title = series_parts[idx - 1].get('part_title', f'P{idx}') if idx <= len(series_parts) else f'P{idx}'
                    
                    self._update_step_status(
                        task_id, "screenshots",
                        TaskStatus.RUNNING,
                        int(5 + (idx - 1) * 85 / total_parts),
                        f"正在处理第 {idx}/{total_parts} 个分P的截图: {part_title}"
                    )
                    
                    print(f"📸 生成分P {idx}/{total_parts} 的截图: {part_title}")
                    print(f"   知识点URL: {kp_url}")
                    print(f"   视频URL: {video_url}")
                    
                    try:
                        # 从URL下载知识点结果
                        print(f"📥 从URL下载分P {idx} 的知识点数据...")
                        loop = asyncio.get_event_loop()
                        
                        def download_knowledge_points():
                            response = requests.get(kp_url, timeout=30)
                            response.raise_for_status()
                            return response.json()
                        
                        kp_data = await loop.run_in_executor(
                            self.executor,
                            download_knowledge_points
                        )
                        
                        # 解析知识点数据
                        knowledge_points = kp_data
                        if isinstance(kp_data, dict) and "knowledge_points" in kp_data:
                            knowledge_points = kp_data["knowledge_points"]
                        
                        if not isinstance(knowledge_points, list):
                            raise ValueError("知识点数据格式错误")
                        
                        print(f"✅ 知识点数据下载成功，共 {len(knowledge_points)} 个知识点")
                        
                        # 如果没有知识点，跳过截图生成（不算失败）
                        if len(knowledge_points) == 0:
                            print(f"ℹ️ 分P {idx} 没有知识点，跳过截图生成")
                            screenshots = []
                        else:
                            # 生成截图（基于知识点的时间戳）
                            screenshots = await self._generate_screenshots_for_video(
                                video_url,
                                knowledge_points,
                                task_id,
                                idx
                            )
                            
                            if not screenshots or len(screenshots) == 0:
                                print(f"⚠️ 分P {idx} 截图生成失败，但知识点存在")
                                raise Exception("截图生成失败或没有生成任何截图")
                            
                            print(f"✅ 分P {idx} 截图生成完成，共 {len(screenshots)} 张截图")
                        
                        # 保存截图URL列表到文件（即使为空也保存）
                        screenshots_json = json.dumps(
                            {"screenshots": screenshots},
                            ensure_ascii=False,
                            indent=2
                        )
                        
                        screenshots_doc_path = os.path.join(
                            self.results_dir,
                            f"{task_id}_screenshots_p{idx}.json"
                        )
                        with open(screenshots_doc_path, 'w', encoding='utf-8') as f:
                            f.write(screenshots_json)
                        
                        # 上传截图结果文件
                        print(f"📤 上传分P {idx} 截图结果文件...")
                        loop = asyncio.get_event_loop()
                        screenshots_result_url = await loop.run_in_executor(
                            self.executor,
                            self.file_upload_service.upload_file,
                            screenshots_doc_path,
                            "file0",
                            "application/json; charset=utf-8"
                        )
                        
                        if not screenshots_result_url:
                            raise Exception("截图结果文件上传失败")
                        
                        if not screenshots_result_url.startswith('http'):
                            screenshots_result_url = f"https://file.gsxservice.com/{screenshots_result_url}"
                        
                        screenshots_result_urls.append(screenshots_result_url)
                        
                        # 标记状态（没有知识点但成功上传空结果也算成功）
                        result_status = "success"
                        if len(screenshots) == 0 and len(knowledge_points) == 0:
                            result_status = "success_no_kp"  # 标记为没有知识点
                        
                        part_results.append({
                            "part_number": idx,
                            "status": result_status,
                            "result_url": screenshots_result_url,
                            "screenshots_count": len(screenshots),
                            "knowledge_points_count": len(knowledge_points)
                        })
                        
                        print(f"✅ 分P {idx}/{total_parts} 截图处理完成: {screenshots_result_url}")
                        print(f"📊 当前已处理: {len(screenshots_result_urls)}/{total_parts} 个分P")
                        
                        # 每处理完一个分P就更新数据库
                        try:
                            task = self.get_task(task_id)
                            if task:
                                if len(screenshots_result_urls) > 1:
                                    task["screenshots_result_url"] = json.dumps(screenshots_result_urls)
                                elif len(screenshots_result_urls) == 1:
                                    task["screenshots_result_url"] = screenshots_result_urls[0]
                                
                                # 更新步骤结果
                                task["steps"]["screenshots"]["result"] = {
                                    "result_urls": screenshots_result_urls,
                                    "part_results": part_results,
                                    "total_screenshots": sum(r.get("screenshots_count", 0) for r in part_results)
                                }
                                
                                self.tasks_cache[task_id] = task
                                self._save_task_to_db(task)
                                print(f"📝 已更新任务 {task_id} 的截图URL到数据库")
                        except Exception as e:
                            print(f"⚠️ 更新数据库失败: {e}")
                        
                    except Exception as e:
                        error_msg = str(e)
                        print(f"❌ 分P {idx}/{total_parts} 截图生成失败: {error_msg}")
                        part_results.append({
                            "part_number": idx,
                            "status": "failed",
                            "error": error_msg
                        })
                        # 继续处理下一个分P，不中断整个流程
                        continue
                
                # 最终更新
                print(f"📊 截图生成完成统计:")
                print(f"   总分P数: {total_parts}")
                print(f"   成功: {len(screenshots_result_urls)}")
                print(f"   失败: {total_parts - len(screenshots_result_urls)}")
                
                # 判断最终状态
                if len(screenshots_result_urls) == total_parts:
                    final_status = TaskStatus.SUCCESS
                    final_message = f"✅ 所有分P截图生成完成（共{total_parts}个分P，{sum(r.get('screenshots_count', 0) for r in part_results)}张截图）"
                elif len(screenshots_result_urls) > 0:
                    final_status = TaskStatus.PARTIAL_SUCCESS
                    final_message = f"⚠️ 部分分P截图生成完成（{len(screenshots_result_urls)}/{total_parts}个分P成功）"
                else:
                    final_status = TaskStatus.FAILED
                    final_message = "❌ 所有分P截图生成均失败"
                
                # 更新任务状态
                task = self.get_task(task_id)
                if task:
                    if len(screenshots_result_urls) > 1:
                        task["screenshots_result_url"] = json.dumps(screenshots_result_urls)
                    elif len(screenshots_result_urls) == 1:
                        task["screenshots_result_url"] = screenshots_result_urls[0]
                    
                    task["steps"]["screenshots"]["result"] = {
                        "result_urls": screenshots_result_urls,
                        "part_results": part_results,
                        "total_screenshots": sum(r.get("screenshots_count", 0) for r in part_results)
                    }
                    
                    self._update_step_status(
                        task_id, "screenshots",
                        final_status,
                        100 if final_status == TaskStatus.SUCCESS else 90,
                        final_message
                    )
                    
                    self.tasks_cache[task_id] = task
                    self._save_task_to_db(task)
                
                return {
                    "success": True,
                    "message": final_message,
                    "result_urls": screenshots_result_urls,
                    "part_results": part_results
                }
            
            else:
                # 单P视频处理
                print("📸 单P视频截图生成...")
                
                self._update_step_status(
                    task_id, "screenshots",
                    TaskStatus.RUNNING, 10,
                    "开始生成截图..."
                )
                
                kp_url = knowledge_points_result_urls[0]
                video_url = video_urls[0]
                
                print(f"   知识点URL: {kp_url}")
                print(f"   视频URL: {video_url}")
                
                # 从URL下载知识点结果
                print("📥 下载知识点数据...")
                loop = asyncio.get_event_loop()
                
                def download_knowledge_points():
                    response = requests.get(kp_url, timeout=30)
                    response.raise_for_status()
                    return response.json()
                
                kp_data = await loop.run_in_executor(
                    self.executor,
                    download_knowledge_points
                )
                
                # 解析知识点数据
                knowledge_points = kp_data
                if isinstance(kp_data, dict) and "knowledge_points" in kp_data:
                    knowledge_points = kp_data["knowledge_points"]
                
                if not isinstance(knowledge_points, list):
                    raise ValueError("知识点数据格式错误")
                
                print(f"✅ 知识点数据下载成功，共 {len(knowledge_points)} 个知识点")
                
                # 如果没有知识点，跳过截图生成（不算失败）
                if len(knowledge_points) == 0:
                    print(f"ℹ️ 没有知识点，跳过截图生成")
                    screenshots = []
                else:
                    # 生成截图
                    screenshots = await self._generate_screenshots_for_video(
                        video_url,
                        knowledge_points,
                        task_id,
                        1
                    )
                    
                    if not screenshots or len(screenshots) == 0:
                        print(f"⚠️ 截图生成失败，但知识点存在")
                        raise Exception("截图生成失败或没有生成任何截图")
                    
                    print(f"✅ 截图生成完成，共 {len(screenshots)} 张截图")
                
                # 保存截图URL列表到文件（即使为空也保存）
                screenshots_json = json.dumps(
                    {"screenshots": screenshots},
                    ensure_ascii=False,
                    indent=2
                )
                
                screenshots_doc_path = os.path.join(
                    self.results_dir,
                    f"{task_id}_screenshots.json"
                )
                with open(screenshots_doc_path, 'w', encoding='utf-8') as f:
                    f.write(screenshots_json)
                
                # 上传截图结果文件
                print("📤 上传截图结果文件...")
                screenshots_result_url = await loop.run_in_executor(
                    self.executor,
                    self.file_upload_service.upload_file,
                    screenshots_doc_path,
                    "file0",
                    "application/json; charset=utf-8"
                )
                
                if not screenshots_result_url:
                    raise Exception("截图结果文件上传失败")
                
                if not screenshots_result_url.startswith('http'):
                    screenshots_result_url = f"https://file.gsxservice.com/{screenshots_result_url}"
                
                # 先更新步骤状态为成功（没有知识点也算成功）
                status_message = f"✅ 截图生成完成（共{len(screenshots)}张截图）"
                if len(screenshots) == 0 and len(knowledge_points) == 0:
                    status_message = f"✅ 截图生成完成（视频无知识点，无截图）"
                
                self._update_step_status(
                    task_id, "screenshots",
                    TaskStatus.SUCCESS, 100,
                    status_message,
                    result={
                        "result_url": screenshots_result_url,
                        "screenshots_count": len(screenshots),
                        "knowledge_points_count": len(knowledge_points)
                    }
                )
                
                # 然后更新任务的screenshots_result_url字段
                task = self.get_task(task_id)
                if task:
                    task["screenshots_result_url"] = screenshots_result_url
                    self.tasks_cache[task_id] = task
                    self._save_task_to_db(task)
                
                print(f"✅ 任务状态已更新为成功: {task_id}")
                
                return {
                    "success": True,
                    "message": f"截图生成完成（共{len(screenshots)}张截图）",
                    "result_url": screenshots_result_url
                }
        
        except Exception as e:
            error_msg = str(e)
            print(f"❌ 截图生成失败: {error_msg}")
            import traceback
            traceback.print_exc()
            self._update_step_status(
                task_id, "screenshots",
                TaskStatus.FAILED, 0,
                f"执行失败: {error_msg}",
                error=error_msg
            )
            raise
    
    async def _generate_screenshots_for_video(
        self,
        video_url: str,
        knowledge_points: List[Dict[str, Any]],
        task_id: str,
        part_number: int
    ) -> List[str]:
        """
        为视频生成截图（基于知识点的时间戳）
        
        Args:
            video_url: 视频URL
            knowledge_points: 知识点列表（包含start_time）
            task_id: 任务ID
            part_number: 分P编号
            
        Returns:
            截图URL列表
        """
        import subprocess
        import tempfile
        
        screenshots_urls = []
        
        # 创建临时目录存储截图
        temp_dir = tempfile.mkdtemp(prefix=f"screenshots_{task_id}_p{part_number}_")
        print(f"📂 临时目录: {temp_dir}")
        
        try:
            for idx, kp in enumerate(knowledge_points):
                start_time = kp.get("start_time", "00:00")
                kp_name = kp.get("name", f"知识点{idx+1}")
                
                # 将时间格式转换为秒数 (MM:SS -> seconds)
                try:
                    parts = start_time.split(":")
                    if len(parts) == 2:
                        minutes, seconds = parts
                        total_seconds = int(minutes) * 60 + int(seconds)
                    else:
                        total_seconds = 0
                except:
                    total_seconds = 0
                
                # 生成截图文件名
                screenshot_filename = f"screenshot_{task_id}_p{part_number}_{idx+1}.jpg"
                screenshot_path = os.path.join(temp_dir, screenshot_filename)
                
                print(f"📸 生成截图 {idx+1}/{len(knowledge_points)}: {kp_name} @ {start_time}")
                
                # 使用ffmpeg从视频URL截图
                cmd = [
                    'ffmpeg',
                    '-ss', str(total_seconds),  # 跳转到指定时间
                    '-i', video_url,  # 输入视频URL
                    '-vframes', '1',  # 只截取1帧
                    '-q:v', '2',  # 质量设置（1-31，数字越小质量越高）
                    '-y',  # 覆盖已存在的文件
                    screenshot_path
                ]
                
                try:
                    # 执行ffmpeg命令
                    result = subprocess.run(
                        cmd,
                        capture_output=True,
                        text=True,
                        timeout=30
                    )
                    
                    if result.returncode != 0:
                        print(f"⚠️ ffmpeg执行失败: {result.stderr}")
                        continue
                    
                    # 检查文件是否生成
                    if not os.path.exists(screenshot_path):
                        print(f"⚠️ 截图文件未生成: {screenshot_path}")
                        continue
                    
                    # 上传截图到CDN
                    print(f"📤 上传截图 {idx+1}...")
                    loop = asyncio.get_event_loop()
                    screenshot_url = await loop.run_in_executor(
                        self.executor,
                        self.file_upload_service.upload_file,
                        screenshot_path,
                        "file0",
                        "image/jpeg"
                    )
                    
                    if screenshot_url:
                        if not screenshot_url.startswith('http'):
                            screenshot_url = f"https://file.gsxservice.com/{screenshot_url}"
                        screenshots_urls.append(screenshot_url)
                        print(f"✅ 截图 {idx+1} 上传成功: {screenshot_url}")
                    else:
                        print(f"⚠️ 截图 {idx+1} 上传失败")
                    
                except subprocess.TimeoutExpired:
                    print(f"⚠️ 截图 {idx+1} 超时")
                    continue
                except Exception as e:
                    print(f"⚠️ 截图 {idx+1} 失败: {e}")
                    continue
            
            print(f"📊 截图生成完成: {len(screenshots_urls)}/{len(knowledge_points)}")
            return screenshots_urls
        
        finally:
            # 清理临时文件
            try:
                import shutil
                shutil.rmtree(temp_dir)
                print(f"🗑️ 清理临时目录: {temp_dir}")
            except Exception as e:
                print(f"⚠️ 清理临时目录失败: {e}")
    
    async def _generate_exercises_for_knowledge_points(
        self,
        knowledge_points: List[Dict[str, Any]],
        transcript_text: str,
        video_title: str = "",
        locale: str = "zh",
        subject: str = "math"
    ) -> List[Dict[str, Any]]:
        """
        为知识点生成练习题
        
        Args:
            knowledge_points: 知识点列表
            transcript_text: 完整逐字稿文本
            video_title: 视频标题
            locale: 语言环境 (zh/en)
            subject: 学科类型 (math/programming)
            
        Returns:
            练习题列表（与知识点一一对应）
        """
        exercises = []
        
        print(f"💪 开始为 {len(knowledge_points)} 个知识点生成练习题...")
        print(f"📚 学科: {subject}, 语言: {locale}")
        
        for idx, kp in enumerate(knowledge_points):
            try:
                kp_name = kp.get("name", f"知识点{idx+1}")
                start_time = kp.get("start_time", "00:00")
                end_time = kp.get("end_time", "99:99")
                
                # 提取该知识点对应的逐字稿片段
                transcript_segment = kp.get("transcript_segment", "")
                if not transcript_segment and transcript_text:
                    # 如果知识点没有逐字稿片段，尝试从完整逐字稿中提取
                    # 简化版：使用完整逐字稿的前500字符作为上下文
                    transcript_segment = transcript_text[:500] if transcript_text else ""
                
                print(f"💪 生成练习 {idx+1}/{len(knowledge_points)}: {kp_name}")
                
                # 构建练习生成 prompt
                if subject == 'math':
                    # 数学题型 prompt
                    if locale == 'en':
                        prompt = f"""You are an experienced mathematics teacher. Please generate a math exercise based on the following video knowledge point.

Knowledge Point Name: {kp_name}
Knowledge Point Content: {transcript_segment}

Please generate an exercise with the following requirements:
1. Exercise Type: Randomly choose either [Multiple Choice] or [Fill in the Blank]
2. Difficulty: Suitable for middle/high school level with appropriate differentiation
3. The question should be directly related to the specific knowledge point explained in the video
4. The question should have practical application value, not too simple
5. If there are formulas, use LaTeX format (wrapped with $), **Note: In JSON, backslashes must be escaped, written as double backslashes \\\\, e.g., \\\\frac, \\\\sin**
6. Provide detailed analysis and solution steps

Please return in JSON format as follows:

**Multiple Choice Format:**
{{{{
  "type": "multiple_choice",
  "title": "Knowledge Point Practice: {kp_name}",
  "description": "Complete the following exercise based on the video content",
  "difficulty": "intermediate",
  "question": "Question content (LaTeX formula example: $\\\\frac{{{{1}}}}{{{{2}}}}$ or $\\\\sin x$)",
  "choices": [
    {{{{"label": "A", "content": "Option A content"}}}},
    {{{{"label": "B", "content": "Option B content"}}}},
    {{{{"label": "C", "content": "Option C content"}}}},
    {{{{"label": "D", "content": "Option D content"}}}}
  ],
  "answer_type": "single",
  "solution": "B",
  "hints": ["Hint 1", "Hint 2", "Hint 3"]
}}}}

**Fill in the Blank Format:**
{{{{
  "type": "fill_blank",
  "title": "Knowledge Point Practice: {kp_name}",
  "description": "Complete the following exercise based on the video content",
  "difficulty": "intermediate",
  "question": "Question content, use ___ to indicate blank positions (LaTeX example: $\\\\frac{{{{1}}}}{{{{2}}}}$)",
  "blanks": 2,
  "answer_type": "text",
  "solution": "Answer1;Answer2",
  "hints": ["Hint 1", "Hint 2", "Hint 3"]
}}}}

Return only JSON, no other explanatory text."""
                    else:
                        prompt = f"""你是一位资深的数学教师，需要根据以下视频知识点生成一道练习题。

知识点名称：{kp_name}
知识点内容：{transcript_segment}

请生成一道练习题，要求：
1. 题型：随机选择【选择题】或【填空题】其中之一
2. 难度：适配中考/高考水平，有一定区分度
3. 题目要结合视频中讲解的具体知识点
4. 题目要有实际应用价值，不要过于简单
5. 如果有公式，使用 LaTeX 格式（用 $ 包裹），**注意：JSON中反斜杠必须转义，写成双反斜杠 \\\\ 例如 \\\\frac、\\\\sin**
6. 提供详细的解析和解题步骤

请以 JSON 格式返回，格式如下：

**选择题格式：**
{{{{
  "type": "multiple_choice",
  "title": "知识点练习：{kp_name}",
  "description": "根据视频内容，完成以下练习题",
  "difficulty": "intermediate",
  "question": "题目内容（LaTeX公式示例：$\\\\frac{{{{1}}}}{{{{2}}}}$ 或 $\\\\sin x$）",
  "choices": [
    {{{{"label": "A", "content": "选项A内容"}}}},
    {{{{"label": "B", "content": "选项B内容"}}}},
    {{{{"label": "C", "content": "选项C内容"}}}},
    {{{{"label": "D", "content": "选项D内容"}}}}
  ],
  "answer_type": "single",
  "solution": "B",
  "hints": ["提示1", "提示2", "提示3"]
}}}}

**填空题格式：**
{{{{
  "type": "fill_blank",
  "title": "知识点练习：{kp_name}",
  "description": "根据视频内容，完成以下练习题",
  "difficulty": "intermediate",
  "question": "题目内容，用 ___ 表示填空位置（LaTeX示例：$\\\\frac{{{{1}}}}{{{{2}}}}$）",
  "blanks": 2,
  "answer_type": "text",
  "solution": "答案1;答案2",
  "hints": ["提示1", "提示2", "提示3"]
}}}}

只返回 JSON，不要其他说明文字。"""
                else:
                    # 编程题型 prompt（默认）
                    if locale == 'en':
                        prompt = f"""You are a professional programming education expert. Please generate a programming exercise for the knowledge point based on the video content.

Knowledge Point: {kp_name}
Video Title: {video_title}
Context: {transcript_segment}

Please generate an exercise in JSON format. Choose the appropriate type and generate the exercise."""
                    else:
                        prompt = f"""你是一位专业的编程教学专家。请根据视频内容为知识点生成一道编程练习题。

知识点：{kp_name}
视频标题：{video_title}

请根据知识点难度选择合适的题型并生成练习题。必须严格按照以下JSON格式返回。只输出 JSON，不要其他内容。"""
                
                # 调用 LLM 生成练习
                exercise_json = await self.llm_service.generate_outline(
                    transcript=transcript_segment,
                    custom_prompt=prompt
                )
                
                # 解析 JSON
                try:
                    # 清理可能的 markdown 代码块标记
                    if exercise_json.startswith('```'):
                        lines = exercise_json.split('\n')
                        exercise_json = '\n'.join(lines[1:-1]) if len(lines) > 2 else exercise_json
                    
                    exercise_data = json.loads(exercise_json)
                    exercises.append(exercise_data)
                    print(f"✅ 练习 {idx+1} 生成成功: {exercise_data.get('type', 'unknown')}")
                    
                except json.JSONDecodeError as e:
                    print(f"⚠️ 练习 {idx+1} JSON 解析失败: {e}")
                    print(f"   Raw response: {exercise_json[:200]}...")
                    # 添加一个空的占位符
                    exercises.append({
                        "type": "error",
                        "title": f"练习题生成失败：{kp_name}",
                        "error": str(e)
                    })
                    
            except Exception as e:
                print(f"⚠️ 练习 {idx+1} 生成失败: {e}")
                import traceback
                traceback.print_exc()
                # 添加一个空的占位符
                exercises.append({
                    "type": "error",
                    "title": f"练习题生成失败：{kp.get('name', f'知识点{idx+1}')}",
                    "error": str(e)
                })
        
        print(f"📊 练习生成完成: {len(exercises)}/{len(knowledge_points)}")
        return exercises
    
    async def execute_step_exercises(self, task_id: str, subject: str = "math", mode: Optional[str] = None) -> Dict[str, Any]:
        """
        执行步骤4: 生成练习题（支持多P视频）
        
        Args:
            task_id: 任务ID
            subject: 学科类型 (math/programming)
            mode: 执行模式 (None: 正常执行, "continue": 只执行失败的分P, "retry": 重新执行成功的分P)
            
        Returns:
            执行结果
        """
        task = self.get_task(task_id)
        if not task:
            raise ValueError(f"任务不存在: {task_id}")
        
        # 如果是旧任务，初始化 exercises 步骤
        if "exercises" not in task["steps"]:
            print(f"🔧 旧任务检测到，初始化 exercises 步骤...")
            task["steps"]["exercises"] = {
                "status": TaskStatus.PENDING,
                "progress": 0,
                "message": "等待执行",
                "result": None,
                "error": None,
                "retry_count": 0
            }
            if "exercises_result_url" not in task:
                task["exercises_result_url"] = None
            self.tasks_cache[task_id] = task
            self._save_task_to_db(task)
        
        # 检查知识点步骤是否完成
        if task["steps"]["knowledge_points"]["status"] not in [TaskStatus.SUCCESS, TaskStatus.PARTIAL_SUCCESS]:
            raise ValueError("请先完成知识点提取步骤")
        
        is_series = task.get("is_series", False)
        series_parts = task.get("series_parts", [])
        locale = task.get("locale", "zh")
        
        # 获取知识点结果URL列表
        kp_result_url_data = task.get("knowledge_points_result_url")
        if not kp_result_url_data:
            raise ValueError("知识点结果URL不存在，请先完成知识点提取步骤")
        
        # 解析URL
        try:
            if isinstance(kp_result_url_data, str) and kp_result_url_data.startswith('['):
                kp_result_urls = json.loads(kp_result_url_data)
            elif isinstance(kp_result_url_data, list):
                kp_result_urls = kp_result_url_data
            else:
                kp_result_urls = [kp_result_url_data]
        except:
            kp_result_urls = [kp_result_url_data]
        
        # 获取ASR结果URL列表
        asr_result_url_data = task.get("asr_result_url")
        try:
            if isinstance(asr_result_url_data, str) and asr_result_url_data.startswith('['):
                asr_result_urls = json.loads(asr_result_url_data)
            elif isinstance(asr_result_url_data, list):
                asr_result_urls = asr_result_url_data
            else:
                asr_result_urls = [asr_result_url_data]
        except:
            asr_result_urls = [asr_result_url_data]
        
        try:
            # 检查是否已有部分完成的结果
            existing_result = task["steps"]["exercises"].get("result")
            
            # 如果是多P视频，处理所有分P
            if is_series and len(kp_result_urls) > 1:
                total_parts = len(kp_result_urls)
                exercises_result_urls = []
                part_results = []
                
                self._update_step_status(
                    task_id, "exercises",
                    TaskStatus.RUNNING, 5,
                    f"开始生成练习题（共{total_parts}个分P）..."
                )
                
                part_results_existing = existing_result.get("part_results", []) if existing_result else []
                part_results_map = {r.get("part_number"): r for r in part_results_existing if r.get("part_number")}
                
                print(f"💪 开始遍历 {total_parts} 个分P的练习生成... (mode={mode})")
                
                for idx, kp_result_url in enumerate(kp_result_urls, 1):
                    existing_part = part_results_map.get(idx)
                    existing_url = existing_part.get("result_url") if existing_part else None
                    existing_status = existing_part.get("status") if existing_part else None
                    
                    should_skip = False
                    
                    if mode == "continue":
                        if existing_status == "success" and existing_url:
                            print(f"⏭️ [continue] 跳过已成功的分P {idx}/{total_parts} 练习生成")
                            exercises_result_urls.append(existing_url)
                            part_results.append(existing_part)
                            should_skip = True
                    elif mode == "retry":
                        print(f"🔄 [retry] 重新执行分P {idx}/{total_parts} 练习生成")
                    
                    if should_skip:
                        continue
                    
                    try:
                        self._update_step_status(
                            task_id, "exercises",
                            TaskStatus.RUNNING,
                            int(5 + (idx / total_parts) * 90),
                            f"正在生成分P {idx}/{total_parts} 的练习题..."
                        )
                        
                        # 下载知识点数据
                        print(f"📥 下载分P {idx} 知识点数据...")
                        loop = asyncio.get_event_loop()
                        
                        def download_knowledge_points():
                            response = requests.get(kp_result_url, timeout=30)
                            response.raise_for_status()
                            return response.json()
                        
                        kp_data = await loop.run_in_executor(
                            self.executor,
                            download_knowledge_points
                        )
                        
                        knowledge_points = kp_data
                        if isinstance(kp_data, dict) and "knowledge_points" in kp_data:
                            knowledge_points = kp_data["knowledge_points"]
                        
                        if not isinstance(knowledge_points, list):
                            raise ValueError("知识点数据格式错误")
                        
                        print(f"✅ 知识点数据下载成功，共 {len(knowledge_points)} 个知识点")
                        
                        if len(knowledge_points) == 0:
                            print(f"ℹ️ 分P {idx} 没有知识点，跳过练习生成")
                            exercises = []
                        else:
                            # 获取ASR文本
                            asr_text = ""
                            if idx <= len(asr_result_urls):
                                asr_result_url = asr_result_urls[idx - 1]
                                def download_asr_text():
                                    response = requests.get(asr_result_url, timeout=10)
                                    response.raise_for_status()
                                    return response.text
                                
                                asr_text = await loop.run_in_executor(
                                    self.executor,
                                    download_asr_text
                                )
                            
                            # 获取视频标题
                            part_title = ""
                            if series_parts:
                                for part in series_parts:
                                    if part.get("part_number") == idx:
                                        part_title = part.get("part_title", "")
                                        break
                            
                            # 生成练习题
                            exercises = await self._generate_exercises_for_knowledge_points(
                                knowledge_points,
                                asr_text,
                                part_title,
                                locale,
                                subject
                            )
                            print(f"✅ 分P {idx} 练习生成完成，共 {len(exercises)} 道练习题")
                        
                        # 保存练习题到文件
                        exercises_json = json.dumps(
                            {"exercises": exercises, "count": len(exercises)},
                            ensure_ascii=False,
                            indent=2
                        )
                        
                        exercises_doc_path = os.path.join(
                            self.results_dir,
                            f"{task_id}_exercises_p{idx}.json"
                        )
                        with open(exercises_doc_path, 'w', encoding='utf-8') as f:
                            f.write(exercises_json)
                        
                        # 上传练习结果文件
                        print(f"📤 上传分P {idx} 练习结果文件...")
                        exercises_result_url = await loop.run_in_executor(
                            self.executor,
                            self.file_upload_service.upload_file,
                            exercises_doc_path,
                            "file0",
                            "application/json; charset=utf-8"
                        )
                        
                        if not exercises_result_url:
                            raise Exception("练习结果文件上传失败")
                        
                        if not exercises_result_url.startswith('http'):
                            exercises_result_url = f"https://file.gsxservice.com/{exercises_result_url}"
                        
                        exercises_result_urls.append(exercises_result_url)
                        
                        part_results.append({
                            "part_number": idx,
                            "status": "success",
                            "result_url": exercises_result_url,
                            "exercises_count": len(exercises),
                            "knowledge_points_count": len(knowledge_points)
                        })
                        
                        print(f"✅ 分P {idx}/{total_parts} 练习处理完成: {exercises_result_url}")
                        
                    except Exception as e:
                        error_msg = str(e)
                        print(f"❌ 分P {idx}/{total_parts} 练习生成失败: {error_msg}")
                        part_results.append({
                            "part_number": idx,
                            "status": "failed",
                            "error": error_msg
                        })
                        continue
                
                # 判断最终状态
                if len(exercises_result_urls) == total_parts:
                    final_status = TaskStatus.SUCCESS
                    final_message = f"✅ 所有分P练习生成完成（共{total_parts}个分P，{sum(r.get('exercises_count', 0) for r in part_results)}道练习题）"
                elif len(exercises_result_urls) > 0:
                    final_status = TaskStatus.PARTIAL_SUCCESS
                    final_message = f"⚠️ 部分分P练习生成完成（{len(exercises_result_urls)}/{total_parts}个分P成功）"
                else:
                    final_status = TaskStatus.FAILED
                    final_message = "❌ 所有分P练习生成均失败"
                
                # 更新任务状态
                task = self.get_task(task_id)
                if task:
                    if len(exercises_result_urls) > 1:
                        task["exercises_result_url"] = json.dumps(exercises_result_urls)
                    elif len(exercises_result_urls) == 1:
                        task["exercises_result_url"] = exercises_result_urls[0]
                    
                    task["steps"]["exercises"]["result"] = {
                        "result_urls": exercises_result_urls,
                        "part_results": part_results,
                        "total_exercises": sum(r.get("exercises_count", 0) for r in part_results)
                    }
                    
                    self._update_step_status(
                        task_id, "exercises",
                        final_status,
                        100 if final_status == TaskStatus.SUCCESS else 90,
                        final_message
                    )
                    
                    self.tasks_cache[task_id] = task
                    self._save_task_to_db(task)
                
                return {
                    "success": True,
                    "message": final_message,
                    "result_urls": exercises_result_urls,
                    "part_results": part_results
                }
            
            else:
                # 单P视频处理
                print("💪 单P视频练习生成...")
                
                self._update_step_status(
                    task_id, "exercises",
                    TaskStatus.RUNNING, 10,
                    "开始生成练习题..."
                )
                
                kp_url = kp_result_urls[0]
                
                # 下载知识点数据
                print("📥 下载知识点数据...")
                loop = asyncio.get_event_loop()
                
                def download_knowledge_points():
                    response = requests.get(kp_url, timeout=30)
                    response.raise_for_status()
                    return response.json()
                
                kp_data = await loop.run_in_executor(
                    self.executor,
                    download_knowledge_points
                )
                
                knowledge_points = kp_data
                if isinstance(kp_data, dict) and "knowledge_points" in kp_data:
                    knowledge_points = kp_data["knowledge_points"]
                
                if not isinstance(knowledge_points, list):
                    raise ValueError("知识点数据格式错误")
                
                print(f"✅ 知识点数据下载成功，共 {len(knowledge_points)} 个知识点")
                
                if len(knowledge_points) == 0:
                    print(f"ℹ️ 没有知识点，跳过练习生成")
                    exercises = []
                else:
                    # 获取ASR文本
                    asr_text = ""
                    if asr_result_urls:
                        def download_asr_text():
                            response = requests.get(asr_result_urls[0], timeout=10)
                            response.raise_for_status()
                            return response.text
                        
                        asr_text = await loop.run_in_executor(
                            self.executor,
                            download_asr_text
                        )
                    
                    # 获取视频标题
                    video_title = task.get("video_title", "")
                    
                    # 生成练习题
                    exercises = await self._generate_exercises_for_knowledge_points(
                        knowledge_points,
                        asr_text,
                        video_title,
                        locale,
                        subject
                    )
                    print(f"✅ 练习生成完成，共 {len(exercises)} 道练习题")
                
                # 保存练习题到文件
                exercises_json = json.dumps(
                    {"exercises": exercises, "count": len(exercises)},
                    ensure_ascii=False,
                    indent=2
                )
                
                exercises_doc_path = os.path.join(
                    self.results_dir,
                    f"{task_id}_exercises.json"
                )
                with open(exercises_doc_path, 'w', encoding='utf-8') as f:
                    f.write(exercises_json)
                
                # 上传练习结果文件
                print("📤 上传练习结果文件...")
                exercises_result_url = await loop.run_in_executor(
                    self.executor,
                    self.file_upload_service.upload_file,
                    exercises_doc_path,
                    "file0",
                    "application/json; charset=utf-8"
                )
                
                if not exercises_result_url:
                    raise Exception("练习结果文件上传失败")
                
                if not exercises_result_url.startswith('http'):
                    exercises_result_url = f"https://file.gsxservice.com/{exercises_result_url}"
                
                # 更新步骤状态
                status_message = f"✅ 练习生成完成（共{len(exercises)}道练习题）"
                if len(exercises) == 0 and len(knowledge_points) == 0:
                    status_message = f"✅ 练习生成完成（视频无知识点，无练习题）"
                
                self._update_step_status(
                    task_id, "exercises",
                    TaskStatus.SUCCESS, 100,
                    status_message,
                    result={
                        "result_url": exercises_result_url,
                        "exercises_count": len(exercises),
                        "knowledge_points_count": len(knowledge_points)
                    }
                )
                
                # 更新任务的exercises_result_url字段
                task = self.get_task(task_id)
                if task:
                    task["exercises_result_url"] = exercises_result_url
                    self.tasks_cache[task_id] = task
                    self._save_task_to_db(task)
                
                print(f"✅ 单P视频练习生成完成")
                
                return {
                    "success": True,
                    "message": status_message,
                    "result_url": exercises_result_url,
                    "exercises_count": len(exercises)
                }
        
        except Exception as e:
            error_msg = str(e)
            print(f"❌ 练习生成失败: {error_msg}")
            import traceback
            traceback.print_exc()
            
            self._update_step_status(
                task_id, "exercises",
                TaskStatus.FAILED, 0,
                f"执行失败: {error_msg}",
                error=error_msg
            )
            raise
    
    def retry_step(self, task_id: str, step: str):
        """重试步骤"""
        task = self.get_task(task_id)
        if not task:
            raise ValueError(f"任务不存在: {task_id}")
        
        if step not in task["steps"]:
            raise ValueError(f"步骤不存在: {step}")
        
        step_info = task["steps"][step]
        step_info["retry_count"] += 1
        step_info["status"] = TaskStatus.PENDING
        step_info["error"] = None
        step_info["message"] = "等待重试"
        
        # 更新缓存
        self.tasks_cache[task_id] = task
        
        # 保存到数据库
        self._save_task_to_db(task)
    
    def delete_task(self, task_id: str):
        """
        删除任务（从数据库和缓存）
        
        Args:
            task_id: 任务ID
        """
        try:
            # 从数据库删除
            with get_db_session() as db:
                task = db.query(OfflineVideoTask).filter(OfflineVideoTask.task_id == task_id).first()
                if task:
                    db.delete(task)
                    db.commit()
                    print(f"✅ 从数据库删除任务: {task_id}")
                else:
                    print(f"⚠️ 任务不存在于数据库: {task_id}")
            
            # 从缓存删除
            if task_id in self.tasks_cache:
                del self.tasks_cache[task_id]
                print(f"✅ 从缓存删除任务: {task_id}")
            
            # 尝试删除本地文件（如果存在）
            task_file = os.path.join(self.results_dir, f"{task_id}.json")
            if os.path.exists(task_file):
                try:
                    os.remove(task_file)
                    print(f"✅ 删除本地任务文件: {task_file}")
                except Exception as e:
                    print(f"⚠️ 删除本地文件失败: {e}")
            
        except Exception as e:
            print(f"❌ 删除任务失败: {e}")
            import traceback
            traceback.print_exc()
            raise
    
    def sync_from_files(self) -> Dict[str, Any]:
        """
        从 results 目录同步 JSON 文件到数据库
        
        Returns:
            同步结果统计
        """
        if not os.path.exists(self.results_dir):
            return {
                "success": False,
                "message": f"Results目录不存在: {self.results_dir}",
                "synced": 0,
                "skipped": 0,
                "errors": 0
            }
        
        # 查找所有任务JSON文件
        task_files = [f for f in os.listdir(self.results_dir) if f.endswith('.json') and f.startswith('task_')]
        
        synced_count = 0
        skipped_count = 0
        error_count = 0
        errors = []
        
        for task_file in task_files:
            task_id = task_file.replace('.json', '')
            task_file_path = os.path.join(self.results_dir, task_file)
            
            try:
                # 加载任务数据
                task_data = self._load_task_from_file(task_id)
                if not task_data:
                    skipped_count += 1
                    continue
                
                # 检查数据库中是否已存在
                existing_task = None
                try:
                    with get_db_session() as db:
                        existing_task = db.query(OfflineVideoTask).filter(
                            OfflineVideoTask.task_id == task_id
                        ).first()
                except Exception as e:
                    print(f"⚠️ 查询任务 {task_id} 失败: {e}")
                
                # 如果已存在，比较更新时间决定是否更新
                if existing_task:
                    file_updated_str = task_data.get('updated_at', '')
                    if file_updated_str:
                        try:
                            if isinstance(file_updated_str, str):
                                file_updated = datetime.fromisoformat(file_updated_str.replace('Z', '+00:00'))
                            else:
                                file_updated = file_updated_str
                            
                            db_updated = existing_task.updated_at
                            
                            if db_updated and file_updated <= db_updated:
                                skipped_count += 1
                                print(f"⏭️ 跳过任务 {task_id}（数据库已是最新）")
                                continue
                            else:
                                print(f"🔄 更新任务 {task_id}（文件较新）")
                        except Exception as e:
                            print(f"⚠️ 比较更新时间失败: {e}，强制更新")
                    else:
                        print(f"🔄 更新任务 {task_id}（文件无更新时间）")
                
                # 保存到数据库
                self._save_task_to_db(task_data)
                
                # 更新缓存
                self.tasks_cache[task_id] = task_data
                
                synced_count += 1
                print(f"✅ 同步任务: {task_id} - {task_data.get('video_title', 'N/A')}")
                
            except Exception as e:
                error_count += 1
                error_msg = f"同步任务 {task_id} 失败: {str(e)}"
                errors.append(error_msg)
                print(f"❌ {error_msg}")
                import traceback
                traceback.print_exc()
        
        result = {
            "success": True,
            "message": f"同步完成: {synced_count} 个已同步, {skipped_count} 个已跳过, {error_count} 个失败",
            "synced": synced_count,
            "skipped": skipped_count,
            "errors": error_count,
            "error_details": errors if errors else None
        }
        
        print(f"📊 同步统计: {result['message']}")
        return result


# 全局实例
offline_video_service = OfflineVideoService()

