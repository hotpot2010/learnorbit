"""
离线视频处理API路由
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks, Request
from pydantic import BaseModel
from typing import Optional, List
import asyncio

from ...services.offline_video_service import (
    offline_video_service,
    TaskStatus,
    StepType
)
from ...services.prompt_config_service import prompt_config_service
from ...services.vod_sign_service import vod_sign_service

router = APIRouter(prefix="/offline-video", tags=["offline-video"])


class CreateTaskRequest(BaseModel):
    """创建任务请求"""
    bilibili_url: str


class RetryStepRequest(BaseModel):
    """重试步骤请求"""
    task_id: str
    step: str


class ExecuteStepRequest(BaseModel):
    """执行步骤请求"""
    task_id: str
    step: str


@router.post("/tasks")
async def create_task(request: CreateTaskRequest):
    """
    创建新的离线视频处理任务
    
    Args:
        request: 包含B站链接的请求
        
    Returns:
        任务ID和基本信息
    """
    try:
        task_id = offline_video_service.create_task(request.bilibili_url)
        task = offline_video_service.get_task(task_id)
        
        return {
            "success": True,
            "task_id": task_id,
            "task": task
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tasks")
async def list_tasks(limit: Optional[int] = None, offset: int = 0):
    """
    列出所有任务（支持分页）
    
    Args:
        limit: 每页任务数量，默认返回所有任务
        offset: 跳过的任务数量（用于分页）
        
    Returns:
        任务列表和总数
    """
    try:
        all_tasks = offline_video_service.list_tasks()
        
        # 按创建时间倒序排序（最新的在前）
        sorted_tasks = sorted(
            all_tasks,
            key=lambda x: x.get('created_at', ''),
            reverse=True
        )
        
        total = len(sorted_tasks)
        
        # 如果指定了limit，进行分页
        if limit is not None:
            tasks = sorted_tasks[offset:offset + limit]
        else:
            tasks = sorted_tasks
        
        return {
            "success": True,
            "tasks": tasks,
            "total": total,
            "limit": limit,
            "offset": offset
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tasks/{task_id}")
async def get_task(task_id: str):
    """
    获取任务详情
    
    Args:
        task_id: 任务ID
        
    Returns:
        任务详情
    """
    try:
        task = offline_video_service.get_task(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="任务不存在")
        
        return {
            "success": True,
            "task": task
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tasks/{task_id}/steps/{step}/execute")
async def execute_step(
    task_id: str,
    step: str,
    background_tasks: BackgroundTasks,
    mode: Optional[str] = None,  # "continue": 只执行失败的分P, "retry": 重新执行成功的分P
    subject: Optional[str] = "math"  # 练习题学科类型 (math/programming)
):
    """
    执行指定步骤（后台执行）
    
    Args:
        task_id: 任务ID
        step: 步骤名称 (download, transcode, asr, knowledge_points, screenshots, exercises)
        background_tasks: FastAPI后台任务
        mode: 执行模式 (None: 正常执行, "continue": 只执行失败的分P, "retry": 重新执行成功的分P)
        subject: 练习题学科类型 (math/programming)，仅在 step=exercises 时有效
        
    Returns:
        执行状态
    """
    try:
        task = offline_video_service.get_task(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="任务不存在")
        
        # 如果是旧任务且访问 exercises 步骤，先初始化该步骤
        if step == "exercises" and step not in task["steps"]:
            print(f"🔧 [API] 旧任务检测到，初始化 exercises 步骤...")
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
            offline_video_service.tasks_cache[task_id] = task
            offline_video_service._save_task_to_db(task)
        
        # 如果是旧任务且访问 transcode 步骤，先初始化该步骤
        if step == "transcode" and step not in task["steps"]:
            print(f"🔧 [API] 旧任务检测到，初始化 transcode 步骤...")
            task["steps"]["transcode"] = {
                "status": TaskStatus.PENDING,
                "progress": 0,
                "message": "等待执行",
                "result": None,
                "error": None,
                "retry_count": 0
            }
            if "transcoded_video_url" not in task:
                task["transcoded_video_url"] = None
            offline_video_service.tasks_cache[task_id] = task
            offline_video_service._save_task_to_db(task)
        
        if step not in task["steps"]:
            raise HTTPException(status_code=400, detail=f"无效的步骤: {step}")
        
        # 检查步骤状态
        step_info = task["steps"][step]
        step_status = step_info["status"]
        step_message = step_info.get("message", "")
        
        # 智能判断状态：如果状态是running但消息包含"失败"，则认为实际状态是partial_success
        if step_status == TaskStatus.RUNNING and "失败" in step_message:
            step_status = TaskStatus.PARTIAL_SUCCESS
        
        if step_status == TaskStatus.RUNNING:
            return {
                "success": False,
                "message": "步骤正在执行中"
            }
        
        # 如果步骤已经成功且不是retry模式，检查是否需要跳过执行
        if step_status == TaskStatus.SUCCESS and mode != "retry":
            # 对于transcode步骤，检查是否有VOD结果
            if step == "transcode":
                vod_file_id = task.get("vod_file_id")
                vod_play_url = task.get("vod_play_url")
                if vod_file_id and vod_play_url:
                    return {
                        "success": False,
                        "message": "转码任务已完成，如需重新执行请使用retry模式",
                        "skipped": True
                    }
            # 对于其他步骤，如果有结果URL，也跳过执行
            elif step in ["asr", "knowledge_points", "screenshots", "exercises"]:
                result_url_key = f"{step}_result_url"
                result_url = task.get(result_url_key)
                if result_url:
                    return {
                        "success": False,
                        "message": f"{step}任务已完成，如需重新执行请使用retry模式",
                        "skipped": True
                    }
        
        # 辅助函数：智能判断步骤实际状态
        def get_actual_status(step_key):
            s = task["steps"][step_key]
            status = s["status"]
            message = s.get("message", "")
            # 如果状态是running但消息包含"失败"，则认为实际状态是partial_success
            if status == TaskStatus.RUNNING and "失败" in message:
                return TaskStatus.PARTIAL_SUCCESS
            return status
        
        # 检查依赖关系
        if step == "transcode":
            # 转码需要下载步骤完成或有部分成功
            download_status = get_actual_status("download")
            if download_status not in [TaskStatus.SUCCESS, TaskStatus.PARTIAL_SUCCESS]:
                raise HTTPException(status_code=400, detail="请先完成下载步骤")
            if not task.get("video_url"):
                raise HTTPException(status_code=400, detail="视频URL不存在，请先完成下载并上传")
        
        elif step == "asr":
            # ASR需要下载步骤完成或有部分成功
            download_status = get_actual_status("download")
            if download_status not in [TaskStatus.SUCCESS, TaskStatus.PARTIAL_SUCCESS]:
                raise HTTPException(status_code=400, detail="请先完成下载步骤")
            if not task.get("video_url"):
                raise HTTPException(status_code=400, detail="视频URL不存在，请先完成下载并上传")
        
        elif step == "knowledge_points":
            # LLM步骤需要ASR步骤完成或有部分成功
            asr_status = get_actual_status("asr")
            if asr_status not in [TaskStatus.SUCCESS, TaskStatus.PARTIAL_SUCCESS]:
                raise HTTPException(status_code=400, detail="请先完成ASR步骤")
            if not task.get("asr_result_url"):
                raise HTTPException(status_code=400, detail="ASR结果URL不存在，请先完成ASR步骤")
        
        elif step == "screenshots":
            # 截图步骤需要知识点步骤完成或有部分成功
            kp_status = get_actual_status("knowledge_points")
            if kp_status not in [TaskStatus.SUCCESS, TaskStatus.PARTIAL_SUCCESS]:
                raise HTTPException(status_code=400, detail="请先完成知识点提取步骤")
            if not task.get("knowledge_points_result_url"):
                raise HTTPException(status_code=400, detail="知识点结果URL不存在，请先完成知识点提取步骤")
        
        elif step == "exercises":
            # 练习步骤需要知识点步骤完成或有部分成功
            kp_status = get_actual_status("knowledge_points")
            if kp_status not in [TaskStatus.SUCCESS, TaskStatus.PARTIAL_SUCCESS]:
                raise HTTPException(status_code=400, detail="请先完成知识点提取步骤")
            if not task.get("knowledge_points_result_url"):
                raise HTTPException(status_code=400, detail="知识点结果URL不存在，请先完成知识点提取步骤")
        
        # 立即更新步骤状态为RUNNING，让前端立即看到执行中状态
        message = "步骤已开始执行..."
        if mode == "continue":
            message = "继续执行失败的分P..."
        elif mode == "retry":
            message = "重新执行成功的分P..."
        
        offline_video_service._update_step_status(
            task_id, step,
            TaskStatus.RUNNING, 5,
            message
        )
        
        # 在后台执行步骤（使用异步包装函数确保非阻塞）
        async def run_step_async():
            """异步包装函数，确保步骤在后台非阻塞执行"""
            try:
                if step == "download":
                    await offline_video_service.execute_step_download(task_id, mode=mode)
                elif step == "asr":
                    await offline_video_service.execute_step_asr(task_id, mode=mode)
                elif step == "knowledge_points":
                    await offline_video_service.execute_step_knowledge_points(task_id, mode=mode)
                elif step == "transcode":
                    await offline_video_service.transcode_video(task_id, mode=mode)
                elif step == "screenshots":
                    await offline_video_service.execute_step_screenshots(task_id, mode=mode)
                elif step == "exercises":
                    await offline_video_service.execute_step_exercises(task_id, subject=subject, mode=mode)
            except Exception as e:
                print(f"❌ 后台步骤执行失败: {step}, task_id: {task_id}, error: {e}")
                import traceback
                traceback.print_exc()
                # 更新步骤状态为失败
                offline_video_service._update_step_status(
                    task_id, step,
                    TaskStatus.FAILED, 0,
                    f"执行失败: {str(e)}",
                    error=str(e)
                )
        
        background_tasks.add_task(run_step_async)
        
        return {
            "success": True,
            "message": f"步骤 {step} 已开始执行"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tasks/{task_id}/steps/{step}/retry")
async def retry_step(task_id: str, step: str):
    """
    重试指定步骤
    
    Args:
        task_id: 任务ID
        step: 步骤名称
        
    Returns:
        重试状态
    """
    try:
        offline_video_service.retry_step(task_id, step)
        
        return {
            "success": True,
            "message": f"步骤 {step} 已重置，可以重新执行"
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tasks/{task_id}/results/{result_type}")
async def get_result(task_id: str, result_type: str, part_number: Optional[int] = None):
    """
    获取任务结果（文档内容）
    
    Args:
        task_id: 任务ID
        result_type: 结果类型 (asr, knowledge_points)
        part_number: 分P编号（可选，多P视频时指定）
        
    Returns:
        结果内容（多P视频返回列表，单P视频返回单个内容）
    """
    try:
        task = offline_video_service.get_task(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="任务不存在")
        
        is_series = task.get("is_series", False)
        
        if result_type == "asr":
            # 从URL获取内容（不再从本地文件读取）
            asr_result_url_data = task.get("asr_result_url")
            if not asr_result_url_data:
                raise HTTPException(status_code=404, detail="ASR结果URL不存在")
            
            # 解析URL（可能是字符串或JSON数组）
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
            
            # 如果是多P视频，返回所有分P的内容
            if is_series and len(asr_result_urls) > 1:
                import requests
                contents = []
                for idx, asr_result_url in enumerate(asr_result_urls, 1):
                    # 如果指定了part_number，只返回指定的分P
                    if part_number is not None and idx != part_number:
                        continue
                    
                    try:
                        response = requests.get(asr_result_url, timeout=30)
                        response.raise_for_status()
                        contents.append({
                            "part_number": idx,
                            "content": response.text
                        })
                    except Exception as e:
                        contents.append({
                            "part_number": idx,
                            "error": f"获取内容失败: {str(e)}"
                        })
                
                return {
                    "success": True,
                    "type": "asr",
                    "is_series": True,
                    "total_parts": len(asr_result_urls),
                    "contents": contents if part_number is None else (contents[0] if contents else None)
                }
            else:
                # 单P视频
                import requests
                try:
                    response = requests.get(asr_result_urls[0], timeout=30)
                    response.raise_for_status()
                    content = response.text
                except Exception as e:
                    raise HTTPException(status_code=500, detail=f"从URL获取ASR内容失败: {e}")
                
                return {
                    "success": True,
                    "type": "asr",
                    "is_series": False,
                    "content": content
                }
        
        elif result_type == "knowledge_points":
            # 从URL获取内容（不再从本地文件读取）
            knowledge_points_result_url_data = task.get("knowledge_points_result_url")
            if not knowledge_points_result_url_data:
                raise HTTPException(status_code=404, detail="知识点结果URL不存在")
            
            # 解析URL（可能是字符串或JSON数组）
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
            
            # 如果是多P视频，返回所有分P的内容
            if is_series and len(knowledge_points_result_urls) > 1:
                import requests
                contents = []
                for idx, knowledge_points_result_url in enumerate(knowledge_points_result_urls, 1):
                    # 如果指定了part_number，只返回指定的分P
                    if part_number is not None and idx != part_number:
                        continue
                    
                    try:
                        response = requests.get(knowledge_points_result_url, timeout=30)
                        response.raise_for_status()
                        contents.append({
                            "part_number": idx,
                            "content": response.json()
                        })
                    except Exception as e:
                        contents.append({
                            "part_number": idx,
                            "error": f"获取内容失败: {str(e)}"
                        })
                
                return {
                    "success": True,
                    "type": "knowledge_points",
                    "is_series": True,
                    "total_parts": len(knowledge_points_result_urls),
                    "contents": contents if part_number is None else (contents[0] if contents else None)
                }
            else:
                # 单P视频
                import requests
                try:
                    response = requests.get(knowledge_points_result_urls[0], timeout=30)
                    response.raise_for_status()
                    content = response.json()
                except Exception as e:
                    raise HTTPException(status_code=500, detail=f"从URL获取知识点内容失败: {e}")
                
                return {
                    "success": True,
                    "type": "knowledge_points",
                    "is_series": False,
                    "content": content
                }
        
        else:
            raise HTTPException(status_code=400, detail=f"不支持的结果类型: {result_type}")
            
    except HTTPException:
        raise
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="文件不存在")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class UpdateResultUrlRequest(BaseModel):
    """更新结果URL请求"""
    result_url: str
    part_number: Optional[int] = None  # 多P任务时指定分P编号（从1开始）


def parse_urls(url_data):
    """解析URL数据（可能是字符串、JSON字符串或列表）"""
    import json
    if not url_data:
        return []
    if isinstance(url_data, str):
        try:
            if url_data.startswith('['):
                return json.loads(url_data)
            return [url_data]
        except:
            return [url_data]
    if isinstance(url_data, list):
        return url_data
    return []


@router.post("/tasks/{task_id}/results/{result_type}/update-url")
async def update_result_url(
    task_id: str,
    result_type: str,
    request: UpdateResultUrlRequest
):
    """
    更新任务结果URL（用于编辑后重新上传）
    支持多P任务：如果指定了part_number，则更新对应分P的URL
    
    Args:
        task_id: 任务ID
        result_type: 结果类型 (asr, knowledge_points)
        request: 包含新URL的请求，可选part_number（多P任务时）
        
    Returns:
        更新状态
    """
    try:
        task = offline_video_service.get_task(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="任务不存在")
        
        import json
        
        if result_type == "asr":
            if request.part_number and task.get("is_series"):
                # 多P任务：更新指定分P的URL
                asr_urls = parse_urls(task.get("asr_result_url"))
                part_index = request.part_number - 1
                if 0 <= part_index < len(asr_urls):
                    asr_urls[part_index] = request.result_url
                    task["asr_result_url"] = json.dumps(asr_urls) if len(asr_urls) > 1 else asr_urls[0]
                else:
                    raise HTTPException(status_code=400, detail=f"无效的分P编号: {request.part_number}")
            else:
                # 单P任务：直接更新
                task["asr_result_url"] = request.result_url
        elif result_type == "knowledge_points":
            if request.part_number and task.get("is_series"):
                # 多P任务：更新指定分P的URL
                knowledge_points_urls = parse_urls(task.get("knowledge_points_result_url"))
                part_index = request.part_number - 1
                if 0 <= part_index < len(knowledge_points_urls):
                    knowledge_points_urls[part_index] = request.result_url
                    task["knowledge_points_result_url"] = json.dumps(knowledge_points_urls) if len(knowledge_points_urls) > 1 else knowledge_points_urls[0]
                else:
                    raise HTTPException(status_code=400, detail=f"无效的分P编号: {request.part_number}")
            else:
                # 单P任务：直接更新
                task["knowledge_points_result_url"] = request.result_url
        else:
            raise HTTPException(status_code=400, detail=f"不支持的结果类型: {result_type}")
        
        # 保存任务
        offline_video_service._save_task_to_db(task)
        
        return {
            "success": True,
            "message": f"{result_type}结果URL已更新"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新URL失败: {str(e)}")


def parse_urls(url_data):
    """解析URL数据（可能是字符串、JSON字符串或列表）"""
    import json
    if not url_data:
        return []
    if isinstance(url_data, str):
        try:
            if url_data.startswith('['):
                return json.loads(url_data)
            return [url_data]
        except:
            return [url_data]
    if isinstance(url_data, list):
        return url_data
    return []


@router.post("/sync-from-files")
async def sync_from_files():
    """
    从 results 目录同步 JSON 文件到数据库
    
    Returns:
        同步结果统计
    """
    try:
        result = offline_video_service.sync_from_files()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"同步失败: {str(e)}")


@router.delete("/tasks/{task_id}")
async def delete_task(task_id: str):
    """
    删除任务（从数据库）
    
    Args:
        task_id: 任务ID
        
    Returns:
        删除结果
    """
    try:
        task = offline_video_service.get_task(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="任务不存在")
        
        # 从数据库删除
        offline_video_service.delete_task(task_id)
        
        return {
            "success": True,
            "message": "任务已删除"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除任务失败: {str(e)}")


@router.post("/cache/clear")
async def clear_cache(task_id: Optional[str] = None):
    """
    清除任务缓存
    
    Args:
        task_id: 可选，如果指定则只清除该任务的缓存；否则清除所有缓存
        
    Returns:
        清除结果
    """
    try:
        result = offline_video_service.clear_cache(task_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"清除缓存失败: {str(e)}")


# ==================== Prompt 配置管理 ====================

class SavePromptRequest(BaseModel):
    """保存 Prompt 请求"""
    prompt: str


@router.get("/prompt")
async def get_prompt():
    """
    获取当前的知识点生成 Prompt
    
    Returns:
        当前 prompt 配置
    """
    try:
        prompt = prompt_config_service.get_prompt()
        return {
            "success": True,
            "prompt": prompt
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取 Prompt 失败: {str(e)}")


@router.post("/prompt")
async def save_prompt(request: SavePromptRequest):
    """
    保存知识点生成 Prompt
    
    Args:
        request: 包含新 prompt 的请求
        
    Returns:
        保存结果
    """
    try:
        success = prompt_config_service.save_prompt(request.prompt)
        
        if success:
            return {
                "success": True,
                "message": "Prompt 已保存"
            }
        else:
            raise HTTPException(status_code=500, detail="保存失败")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"保存 Prompt 失败: {str(e)}")


@router.post("/prompt/reset")
async def reset_prompt():
    """
    重置 Prompt 为默认值
    
    Returns:
        重置结果
    """
    try:
        success = prompt_config_service.reset_to_default()
        
        if success:
            return {
                "success": True,
                "message": "Prompt 已重置为默认值",
                "prompt": prompt_config_service.get_prompt()
            }
        else:
            raise HTTPException(status_code=500, detail="重置失败")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"重置 Prompt 失败: {str(e)}")


# ==================== 练习提示词配置管理 ====================

class SaveExercisePromptRequest(BaseModel):
    """保存练习提示词请求"""
    subject: str  # math/programming
    locale: str  # zh
    prompt: str


@router.get("/exercise-prompt")
async def get_exercise_prompt(subject: str = "math", locale: str = "zh"):
    """
    获取练习生成提示词
    
    Args:
        subject: 学科类型 (math/programming)
        locale: 语言环境 (仅支持 zh)
        
    Returns:
        当前提示词配置
    """
    try:
        prompt = prompt_config_service.get_exercise_prompt(subject=subject, locale=locale)
        return {
            "success": True,
            "subject": subject,
            "locale": locale,
            "prompt": prompt
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取练习提示词失败: {str(e)}")


@router.get("/exercise-prompt/all")
async def get_all_exercise_prompts():
    """
    获取所有练习提示词配置
    
    Returns:
        所有提示词配置
    """
    try:
        prompts = prompt_config_service.get_all_exercise_prompts()
        return {
            "success": True,
            "prompts": prompts
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取所有练习提示词失败: {str(e)}")


@router.post("/exercise-prompt")
async def save_exercise_prompt(request: SaveExercisePromptRequest):
    """
    保存练习生成提示词
    
    Args:
        request: 包含学科、语言和提示词的请求
        
    Returns:
        保存结果
    """
    try:
        if request.subject not in ['math', 'programming']:
            raise HTTPException(status_code=400, detail="subject 必须是 'math' 或 'programming'")
        if request.locale != 'zh':
            raise HTTPException(status_code=400, detail="locale 仅支持 'zh'")
        
        success = prompt_config_service.save_exercise_prompt(
            subject=request.subject,
            locale=request.locale,
            prompt=request.prompt
        )
        
        if success:
            return {
                "success": True,
                "message": f"练习提示词已保存 ({request.subject}/{request.locale})"
            }
        else:
            raise HTTPException(status_code=500, detail="保存失败")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"保存练习提示词失败: {str(e)}")


@router.post("/exercise-prompt/reset")
async def reset_exercise_prompt(subject: str = "math", locale: str = "zh"):
    """
    重置练习提示词为默认值
    
    Args:
        subject: 学科类型 (math/programming)
        locale: 语言环境 (仅支持 zh)
        
    Returns:
        重置结果
    """
    try:
        if subject not in ['math', 'programming']:
            raise HTTPException(status_code=400, detail="subject 必须是 'math' 或 'programming'")
        if locale != 'zh':
            raise HTTPException(status_code=400, detail="locale 仅支持 'zh'")
        
        success = prompt_config_service.reset_exercise_prompt(subject=subject, locale=locale)
        
        if success:
            return {
                "success": True,
                "message": f"练习提示词已重置为默认值 ({subject}/{locale})",
                "prompt": prompt_config_service.get_exercise_prompt(subject=subject, locale=locale)
            }
        else:
            raise HTTPException(status_code=500, detail="重置失败")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"重置练习提示词失败: {str(e)}")


class GetVodPsignRequest(BaseModel):
    """获取VOD播放签名请求"""
    file_id: str
    app_id: Optional[int] = None
    expire_time: Optional[int] = None  # 过期时间（秒）


@router.post("/vod/psign")
async def get_vod_psign(request: GetVodPsignRequest):
    """
    获取腾讯云点播播放签名（psign）
    
    Args:
        request: 包含 file_id 的请求
        
    Returns:
        播放签名和相关信息
    """
    try:
        psign = vod_sign_service.generate_play_sign(
            file_id=request.file_id,
            app_id=request.app_id,
            expire_time=request.expire_time
        )
        
        if not psign:
            raise HTTPException(status_code=500, detail="生成播放签名失败")
        
        app_id = request.app_id or vod_sign_service.sub_app_id
        
        return {
            "success": True,
            "psign": psign,
            "app_id": app_id,
            "file_id": request.file_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

