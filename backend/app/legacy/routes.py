from typing import Optional
from fastapi import APIRouter, Request, HTTPException, Response, UploadFile, File, Form, Depends
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
from fastapi.templating import Jinja2Templates
import os
import asyncio
import traceback
import json
import json_repair
from collections import deque
import logging
import redis.asyncio as redis
import aiohttp
# import requests
from src.llm.call_llm import llm_client
# from apollo import get_plan_step_length, redis_host, redis_port, redis_db, redis_password
from src.learn_plan import generate_learning_plan_stream, generate_mock_learning_plan_stream
from src.tasks import generate_task
from src.llm.parsers import parse_task
from src.prompts import get_prompt
import time
from src.prompts.assistant_system_prompt import get_assistant_system_prompt
from src.utils.bilibili_retrive import retrive,retrive_rerank
from src.utils.youtube_retrive import retrive_youtube_rerank
from src.utils.web_serach import web_search
from src.utils.search_XNG import searxng_web_search, searxng_image_search
from src.utils.image_chat import image_chat
from src.utils.google_search import serper_web_search,retrive_serper_rerank,serper_image_search
from src.utils.duckduck import duckduckgo_image_search,duckduckgo_video_search
from src.utils.jina import batch_fetch_jina_summary
from src.prompts.extract_entity import get_extract_keywords_prompt
import time
from log import logger
from src.prompts.chatone import CHAT1_UPDATE_ZH,CHAT1_UPDATE_EN,CHAT1_SYSTEM_ZH,CHAT1_SYSTEM_EN,CHAT1_SYSTEM_ZH_TMP,CHAT1_SYSTEM_EN_TMP
from src.prompts.answer import ANSWER_PROMPT_EN,ANSWER_PROMPT_ZH,ANSWER_SYSTEM_PROMPT_EN,ANSWER_SYSTEM_PROMPT_ZH
from src.utils.summary import summarize_document
from src.utils.document_processor import process_content, process_document, search_documents, get_all_document_summaries_by_chat_id
from sqlalchemy.orm import Session
from src import SessionLocal
import tempfile
import shutil
# from app.constants import PLAN_STEP_LEN
PLAN_STEP_LEN=os.getenv('PLAN_STEP_LEN')
# logger = logging.getLogger('routes')
router = APIRouter()
# Redis连接配置
REDIS_URL = "redis://:07HlNuCjz9O12a6WIARDGwcq4ZgU58M3@cgk1.clusters.zeabur.com:32710"
redis_client = None
# Helper function to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
        
async def get_redis_client():
    """获取Redis客户端连接"""
    global redis_client
    if redis_client is None:
        # redis_client = redis.from_url(REDIS_URL, decode_responses=True)
        redis_client = redis.Redis(
    host=os.getenv('REDIS_HOST',"localhost"),
    port=os.getenv('REDIS_PORT',6379),
    db=0,           # 默认数据库为 0
    password=os.getenv('REDIS_PASSWORD',None),  # 如果 Redis 服务器需要密码，请设置为相应密码
    decode_responses=True  # 自动将 byte 类型转换为字符串
)
    logger.info(f"Redis连接成功, host: {os.getenv('REDIS_HOST','localhost')}, port: {os.getenv('REDIS_PORT',6379)}, db: 0")
    return redis_client

async def process_step_references(step_data, chat_id,doc_references=None):
    """
    处理步骤中的references字段，将编号替换为对应的文档内容或链接
    
    Args:
        step_data: 步骤数据字典
        chat_id: 聊天ID
        
    Returns:
        处理后的步骤数据
    """
    if 'references' not in step_data or not step_data['references']:
        return step_data
    if step_data['references'] and len(step_data['references']) > 0 and isinstance(step_data['references'][0], dict):
        logger.info(f"[Process References] references已经处理过，跳过转换")
        return step_data
    try:
        if doc_references is None:
            redis_conn = await get_redis_client()
            doc_ref_key = f"chat_doc_references:{chat_id}"
            doc_references_str = await redis_conn.get(doc_ref_key)
        else:
            doc_references_str = doc_references
        
        if not doc_references_str:
            logger.warning(f"[Process References] 未找到文档引用映射, chat_id: {chat_id}")
            return step_data
        
        doc_references = json.loads(doc_references_str)
        processed_references = []
        seen_urls = set()
        seen_doc_ids = set()
        
        # 检查是否已经处理过（如果第一个元素是dict说明已处理）
        if step_data['references'] and len(step_data['references']) > 0 and isinstance(step_data['references'][0], dict):
            logger.info(f"[Process References] references已经处理过，跳过转换")
            return step_data
        for ref_num in step_data['references']:
            ref_key = str(ref_num)
            if ref_key in doc_references:
                doc_info = doc_references[ref_key]
                
                if doc_info['type'] == 'uploaded_document':
                    # 对于上传文档，提供文档ID和摘要
                    processed_references.append({
                        "type": "uploaded_document",
                        "doc_id": doc_info['doc_id'],
                        "content": doc_info.get('content', '')
                    })
                elif doc_info['type'] == 'web_search_result':
                    url = doc_info.get('url')
                    if url and url not in seen_urls:
                        # 对于搜索结果，提供URL和标题
                        processed_references.append({
                            "type": "web_search_result",
                            "url": url,
                            "summary": doc_info.get('summary', '')
                        })
                        seen_urls.add(url)
            else:
                logger.warning(f"[Process References] 未找到引用编号 {ref_num} 的文档信息")
        
        # 替换原来的references数组
        step_data['references'] = processed_references
        logger.info(f"[Process References] 处理了 {len(processed_references)} 个文档引用")
        
    except Exception as e:
        logger.error(f"[Process References] 处理引用失败: {e}", exc_info=True)
    
    return step_data

# Global variables remain the same
MAX_HISTORY_TURNS = 5
conversation_history = deque(maxlen=MAX_HISTORY_TURNS * 2)

async def get_system_prompt(chat_id=None):
    """
    获取特定聊天会话的系统提示词，如果不存在则返回默认提示词
    
    Args:
        chat_id (str, optional): 聊天会话ID
        
    Returns:
        str: 系统提示词
    """
    if not chat_id:
        return get_assistant_system_prompt(None)
        
    redis_conn = await get_redis_client()
    prompt_key = f"chat_system_prompt:{chat_id}"
    
    # 尝试从Redis获取
    system_prompt = await redis_conn.get(prompt_key)
    if system_prompt:
        return system_prompt
    
    # 不存在则返回默认提示词
    return get_assistant_system_prompt(None)

async def update_assistant_system_prompt(task_json_str: str, chat_id=None):
    """
    更新 AI 助手 System Prompt。
    根据传入的 task_json (通常由 task_generate 生成) 更新上下文。
    
    Args:
        task_json_str (str): 任务数据的JSON字符串
        chat_id (str, optional): 聊天会话ID，如果提供则将提示词存储到Redis
    """
    if not task_json_str:
        print("[System Prompt] 更新失败: task_json_str 为空。")
        return

    try:
        task_data = json.loads(task_json_str)
        new_prompt = get_assistant_system_prompt(task_data)
        
        # 如果有聊天ID，保存到Redis
        if chat_id:
            redis_conn = await get_redis_client()
            prompt_key = f"chat_system_prompt:{chat_id}"
            await redis_conn.set(prompt_key, new_prompt)
            print(f"[System Prompt] 已更新并保存到Redis, chat_id: {chat_id}")
        
    except json.JSONDecodeError as e:
        print(f"[System Prompt] 更新失败: 解析 task_json 时出错: {e}")
    except Exception as e:
        print(f"[System Prompt] 更新时发生未知错误: {e}")

@router.get("/", response_class=HTMLResponse)
async def index(request: Request):
    """课程对话页面 - 新的首页"""
    from fastapi import FastAPI
    app: FastAPI = request.app
    templates: Jinja2Templates = app.state.templates
    return templates.TemplateResponse("course-chat.html", {"request": request})

@router.get("/learning", response_class=HTMLResponse)
async def learning_platform(request: Request):
    """学习平台主页面"""
    from fastapi import FastAPI
    app: FastAPI = request.app
    templates: Jinja2Templates = app.state.templates
    return templates.TemplateResponse("index.html", {"request": request})

@router.post('/api/course/summary')
async def generate_course_summary(request: Request):
    """生成课程摘要API"""
    try:
        body = await request.json()
        conversation_history = body.get('conversation_history', [])
        
        if not conversation_history:
            raise HTTPException(status_code=400, detail="对话历史不能为空")
        
        # 提取用户的学习需求
        user_messages = [msg['content'] for msg in conversation_history if msg['role'] == 'user']
        combined_goal = ' '.join(user_messages)
        
        # 生成课程摘要
        summary_prompt = f"""
        基于以下用户对话，生成一个个性化的课程摘要：

        用户需求：{combined_goal}

        请生成一个包含以下信息的课程摘要：
        1. 课程标题（简洁明了）
        2. 课程描述（2-3句话说明课程内容和目标）
        3. 预计学习时长
        4. 难度等级
        5. 主要学习主题（4-6个要点）

        请以JSON格式返回，格式如下：
        {{
            "title": "课程标题",
            "description": "课程描述",
            "duration": "预计时长",
            "difficulty": "难度等级", 
            "topics": ["主题1", "主题2", "主题3", "主题4"]
        }}
        """
        
        # 调用LLM生成摘要
        try:
            summary_response = await llm_client.get_completion(summary_prompt)
            
            # 尝试解析JSON响应
            import re
            json_match = re.search(r'\{.*\}', summary_response, re.DOTALL)
            if json_match:
                summary_data = json.loads(json_match.group())
                return summary_data
            else:
                raise ValueError("无法解析LLM响应")
                
        except Exception as e:
            logger.warning(f"LLM生成课程摘要失败: {e}")
            # 返回默认摘要
            return {
                "title": "个性化学习计划",
                "description": "基于您的学习需求定制的专属课程，结合理论学习与实践练习，帮助您达成学习目标。",
                "duration": "4-6 周",
                "difficulty": "适中",
                "topics": [
                    "基础概念理解与掌握",
                    "核心技能训练与提升", 
                    "实际项目练习与应用",
                    "进阶知识拓展与深化"
                ]
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"生成课程摘要失败: {e}",exc_info=True)
        raise HTTPException(status_code=500, detail="生成课程摘要时发生错误")

@router.post('/api/chat/stream')
async def handle_chat_stream(request: Request):
    body = await request.json()
    
    if not body:
        raise HTTPException(status_code=400, detail="Invalid request body")
    
    user_message = body.get('message', '').strip()
    if not user_message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    
    # 获取对话历史（如果有的话）
    conversation_hist = body.get('conversation_history', [])
    chat_id = body.get('id')  # 获取聊天ID
    
    async def generate_sse():
        try:
            # 如果有对话历史，使用传入的历史；否则使用全局历史
            # if conversation_hist:
                # 对于课程对话页面，使用专门的系统提示
#                 system_prompt = """你是一个专业的学习顾问AI助手。你的任务是通过对话了解用户的学习需求，包括：
# 1. 学习目标和兴趣领域
# 2. 当前技能水平  
# 3. 期望的学习时长
# 4. 学习方式偏好
# 5. 具体想要掌握的技能

# 请通过自然的对话方式获取这些信息，不要一次性问太多问题。根据用户的回答，逐步深入了解细节。
# 当你认为已经充分了解用户需求时，请在回复末尾加上："[READY_TO_GENERATE]"标记。

# 请保持对话自然、友好，给出具体的引导性问题。"""
            system_prompt = await get_system_prompt(chat_id)  # 根据聊天ID获取系统提示
            messages = [{"role": "system", "content": system_prompt}]
            messages.extend(conversation_hist)
            messages.append({"role": "user", "content": user_message})
            # else:
            #     # 对于学习平台页面，使用全局对话历史
            #     conversation_history.append({"role": "user", "content": user_message})
            #     messages = [{"role": "system", "content": current_system_prompt}]
            #     messages.extend(list(conversation_history))
            
            assistant_response = ""
            
            async for chunk in llm_client.stream_chat(messages):
                if chunk:
                    assistant_response += chunk
                    yield f"data: {json.dumps({'chunk': chunk})}\n\n"
            
            # # 只有在使用全局历史时才更新
            # if not conversation_hist:
            #     conversation_history.append({"role": "assistant", "content": assistant_response})
            
            yield f"data: {json.dumps({'done': True})}\n\n"
            
        except Exception as e:
            logger.error(f"Stream chat error: {e}",exc_info=True)
            error_message = f"处理请求时发生错误: {str(e)}"
            yield f"data: {json.dumps({'error': error_message})}\n\n"
    
    return StreamingResponse(
        generate_sse(), 
        media_type='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
            'Connection': 'keep-alive'
        }
    )

@router.get('/api/learning/plan/stream')
async def stream_learning_plan(
    learning_goal: str = None,
    use_mock: str = "false",
    course_content: str = None
):
    if not learning_goal:
        raise HTTPException(status_code=400, detail="Missing learning goal")
    
    use_mock_bool = use_mock.lower() == 'true'
    
    async def generate_plan_stream():
        try:
            if use_mock_bool:
                async_gen = generate_mock_learning_plan_stream(learning_goal, course_content)
            else:
                async_gen = generate_learning_plan_stream(learning_goal, course_content)
            
            async for step in async_gen:
                step_payload = json.dumps({"step": step})
                yield f"data: {step_payload}\n\n"
            
            done_payload = json.dumps({"done": True})
            yield f"data: {done_payload}\n\n"
                    
        except Exception as e:
            logger.error(f"Error in learning plan stream: {e}",exc_info=True)
            error_payload = json.dumps({"error": f"Failed to generate learning plan: {str(e)}"})
            yield f"data: {error_payload}\n\n"
    
    return StreamingResponse(
        generate_plan_stream(),
        media_type='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
            'Connection': 'keep-alive'
        }
    )

@router.post('/api/task/generate')
async def generate_task_api(request: Request, db: Session = Depends(get_db)):
    body = await request.json()
    title = body.get('title', '未知任务')
    logger.info(f"[任务生成] 请求参数: {title}")
    task_description = body.get('description', '')
    use_mock = body.get('use_mock', False)
    course_content = body.get('course_content')
    current_step_context = body.get('current_step_context')
    animation_type = body.get('animation_type')
    videos = body.get('videos',[])
    search_keyword = body.get('search_keyword', '')
    type=body.get('type','')
    difficulty=body.get('difficulty','')
    chat_id = body.get('id')  # 获取聊天ID
    previous_steps_context = body.get('previous_steps_context') # 获取已学步骤上下文
    logger.info(f"[任务生成] 动画类型: {animation_type}")
    force_regenerate = body.get('force_regenerate', False)
    lang = body.get('lang', 'en')
    retrive_enabled = body.get('retrive_enabled', False)
    references = body.get('references', [])
    if not task_description or not search_keyword:
        raise HTTPException(status_code=400, detail="任务描述和搜索关键词不能为空")
    logger.info(f"[任务生成] 参数:{retrive_enabled},{chat_id}")
    # 搜索相关文档
    document_context = ""
    doc_references = {} # [!code add]
    doc_count = 0 # [!code add]
    if chat_id and retrive_enabled:
        try:
            search_results = await search_documents(task_description, chat_id, top_k=3, db_session=db)
            if search_results:
                context_addition, doc_count, doc_references = _format_search_results_for_context(
                    search_results, lang, doc_count, doc_references
                )
                document_context += context_addition
                logger.info(f"[任务生成] 找到 {len(search_results)} 条相关文档")
        except Exception as e:
            logger.warning(f"[任务生成] 文档搜索失败: {e}", exc_info=True)
    
    logger.info(f"[任务生成] 参数 - use_mock: {use_mock}, force_regenerate: {force_regenerate}, animation_type: {animation_type}")
    
    # 如果不是强制重新生成，先检查缓存（包括mock模式）
    if not force_regenerate:
        try:
            step_name = f"步骤{body.get('step', '')}: {title}"

            cache_dir = os.path.join(os.path.dirname(__file__), '..', 'cache')
            filename = f"{step_name.replace(' ', '_').replace(':', '_')}.json"
            filepath = os.path.join(cache_dir, filename)
            
            logger.info(f"[缓存查询] 缓存文件路径: {filepath}")
            
            if os.path.exists(filepath):
                logger.info(f"[缓存查询] 缓存文件存在，正在读取...")
                with open(filepath, 'r', encoding='utf-8') as f:
                    cache_data = json.load(f)
                
                cached_task = cache_data.get('task_data')
                created_at = cache_data.get('created_at', 0)

                if cached_task:
                    try:
                        task_json_str = json.dumps(cached_task)
                        await update_assistant_system_prompt(task_json_str, chat_id)  # 添加chat_id参数
                        logger.info(f"[生成任务] 已更新助手系统提示")
                    except Exception as e:
                        logger.error(f"调用 update_assistant_system_prompt 时出错: {e}")
                    
                    return {'success': True, 'task': cached_task, 'from_cache': True}
                else:
                    logger.info(f"[缓存查询] 缓存文件中无有效任务数据")
            else:
                logger.info(f"[缓存查询] 未找到缓存文件: {filename}")
        except Exception as e:
            logger.info(f"[缓存查询] 缓存检查失败: {e}")
    else:
        logger.info(f"[缓存查询] 跳过缓存检查 (force_regenerate=True)")
    
    try:
        logger.info(f"[生成任务] 正在生成新任务：{task_description}")
        if use_mock:
            logger.info(f"[生成任务] 使用Mock模式生成")
        if course_content:
            logger.info(f"[生成任务] 使用课程内容参考")
        if current_step_context:
            logger.info(f"[生成任务] 当前步骤上下文：{current_step_context}")
        if animation_type:
            logger.info(f"[生成任务] 动画类型：{animation_type}")
        if type:
            logger.info(f"[生成任务] 任务类型：{type}")
        if difficulty:
            logger.info(f"[生成任务] 难度等级：{difficulty}")
        if document_context:
            logger.info(f"[生成任务] 包含文档上下文")

        tasks = [
            generate_task(task_description, use_mock, course_content, current_step_context, animation_type, type, difficulty, lang=lang, previous_steps_context=previous_steps_context, document_context=document_context)
        ]
        if search_keyword:
            redis_conn = await get_redis_client()
            category_key = f"chat_plan_category:{chat_id}"
            category = await redis_conn.get(category_key) or "other"
            if category == "coding":
                code_search_keyword ="site:leetcode.com OR site:stackoverflow.com "+ search_keyword
            else:
                code_search_keyword = search_keyword
            # tasks.append(web_search(search_keyword))
            tasks.append(searxng_web_search(code_search_keyword,lang=lang))
            # tasks.append(searxng_image_search(search_keyword, num_results=10, lang=lang))
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # 检查任务生成是否失败
        if isinstance(results[0], Exception):
            logger.error(f"[任务生成] 生成任务失败: {results[0]}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"任务生成失败: {str(results[0])}")
        
        # 处理 web 搜索异常
        if len(results) > 1:
            if isinstance(results[1], Exception):
                logger.warning(f"[Web搜索] 初次搜索失败: {results[1]}，尝试备用搜索")
                try:
                    results[1] = await searxng_web_search(search_keyword,lang=lang)
                except Exception as e:
                    logger.error(f"[Web搜索] 备用搜索也失败: {e}")
                    results[1] = {"results": [], "query": search_keyword}
            elif not results[1].get('results'):
                try:
                    results[1] = await searxng_web_search(search_keyword,lang=lang)
                except Exception as e:
                    logger.error(f"[Web搜索] 备用搜索失败: {e}")
                    results[1] = {"results": [], "query": search_keyword}
        
        task_data = results[0]
        ppt_contents=task_data.get('ppt_content',[]).copy()
        
        # 筛选出需要搜索图片的section（image_search_term不为空）
        sections_with_images = []  # 存储 (index, ppt_content) 元组
        for idx, ppt_content in enumerate(ppt_contents):
            image_search_term = ppt_content.get('image_search_term', '').strip()
            if image_search_term:  # 只处理非空的搜索词
                sections_with_images.append((idx, ppt_content))
        
        logger.info(f"[图片搜索] 共 {len(ppt_contents)} 个section，其中 {len(sections_with_images)} 个需要搜索图片")
        
        # 获取更多图片用于打分筛选（只对需要图片的section）
        if sections_with_images:
            images_task = [
                searxng_image_search(ppt_content.get('image_search_term', ''), num_results=20, lang=lang) 
                for idx, ppt_content in sections_with_images
            ]
            images_results = await asyncio.gather(*images_task, return_exceptions=True)
        else:
            images_results = []
        
        # 对每个需要图片的section进行打分并筛选前5
        scored_ppt_contents = ppt_contents.copy()  # 复制原始内容
        
        for (section_idx, ppt_content), images_result in zip(sections_with_images, images_results):
            # 处理异常情况
            if isinstance(images_result, Exception):
                logger.warning(f"[图片搜索] Section {section_idx} ({ppt_content.get('section_title', 'Unknown')}) 搜索失败: {images_result}")
                images_result = {"images": [], "total": 0}
            
            images_list = images_result.get('images', [])
            if images_list:
                # 获取ppt_content的描述文本用于打分
                description = ppt_content.get('content', '') or ppt_content.get('section_title', '')
                
                # 对每张图片进行打分
                scoring_tasks = []
                for img in images_list:
                    # 使用thumbnail或img_src作为图片URL
                    img_url = img.get('thumbnail') or img.get('img_src')
                    if img_url:
                        scoring_tasks.append(image_chat([img_url], description))
                    else:
                        scoring_tasks.append(asyncio.sleep(0, result=0))  # 占位，返回0分
                
                # 并发执行所有打分任务
                scores = await asyncio.gather(*scoring_tasks, return_exceptions=True)
                
                # 将分数与图片关联，处理异常情况
                images_with_scores = []
                for img, score in zip(images_list, scores):
                    # 如果打分出错，给默认分数0
                    if isinstance(score, Exception):
                        logger.warning(f"[图片打分] Section {section_idx} 打分失败: {score}")
                        score = 0
                    images_with_scores.append({
                        **img,
                        'score': score
                    })
                
                # 先过滤掉分数低于5分的图片，然后按分数降序排序，取前5
                images_with_scores = [img for img in images_with_scores if img.get('score', 0) >= 5]
                images_with_scores.sort(key=lambda x: x.get('score', 0), reverse=True)
                top_images = images_with_scores[:5]
                
                logger.info(f"[图片打分] Section {section_idx} ({ppt_content.get('section_title', 'Unknown')}): 从 {len(images_list)} 张图片中筛选出 {len(top_images)} 张合格图片(≥5分)，分数: {[img.get('score') for img in top_images]}")
                
                # 更新images_result
                images_result['images'] = top_images
                images_result['total'] = len(top_images)
            else:
                logger.info(f"[图片搜索] Section {section_idx} ({ppt_content.get('section_title', 'Unknown')}) 未找到图片")
                images_result = {"images": [], "total": 0}
            
            # 将打分后的图片结果合并到对应的section
            scored_ppt_contents[section_idx] = {**ppt_content, **images_result}
        
        task_data['ppt_content']=scored_ppt_contents
        logger.info(f"[生成任务] 生成任务完成：{task_data}")

        if task_data and videos:
            task_data['videos'] = videos
        # if task_data and search_keyword:
        #     web_res = results[1] if len(results) > 1 else None
        #     if not web_res['results']:
        #         web_res = await serper_web_search(search_keyword,lang=lang)
        #     task_data['web_res'] = web_res
        task_data['search_keyword'] = search_keyword
        if task_data and task_data.get('references'):
            task_data=await process_step_references(task_data, chat_id,json.dumps(doc_references,ensure_ascii=False))
        else:
            task_data['references'] = references
        task_data['web_res'] = results[1] if len(results) > 1 else None
        
        # 添加图片搜索结果
        if len(results) > 2 and results[2]:
            image_search_result = results[2]
            if image_search_result.get('images'):
                # 格式化图片数据，只保留必要的字段
                formatted_images = []
                for img in image_search_result['images']:
                    formatted_images.append({
                        'url': img.get('img_src', ''),
                        'thumbnail': img.get('thumbnail', ''),
                        'title': img.get('title', ''),
                        'source': img.get('source', ''),
                        'page_url': img.get('url', '')  # 图片所在页面的URL
                    })
                task_data['images'] = formatted_images
                logger.info(f"[生成任务] 添加了 {len(formatted_images)} 张图片到任务")
            else:
                task_data['images'] = []
        else:
            task_data['images'] = []
        if task_data:
            try:
                task_json_str = json.dumps(task_data)
                await update_assistant_system_prompt(task_json_str, chat_id)  # 添加chat_id参数
                logger.info(f"[生成任务] 已更新助手系统提示")
            except TypeError as e:
                logger.error(f"无法序列化 task_data 为 JSON: {e}",exc_info=True)
            except Exception as e:
                logger.error(f"调用 update_assistant_system_prompt 时出错: {e}",exc_info=True)
        
        return {'success': True, 'task': task_data}
    except Exception as e:
        logger.error(f"生成任务时出错: {e}",exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/api/task/cache/save')
async def save_task_cache(request: Request):
    """保存任务到缓存"""
    try:
        body = await request.json()
        step_name = body.get('step_name', '')
        task_data = body.get('task_data')
        
        if not step_name or not task_data:
            raise HTTPException(status_code=400, detail="步骤名称和任务数据不能为空")
        
        cache_dir = os.path.join(os.path.dirname(__file__), '..', 'cache')
        os.makedirs(cache_dir, exist_ok=True)
        
        filename = f"{step_name.replace(' ', '_').replace(':', '_')}.json"
        filepath = os.path.join(cache_dir, filename)
        
        cache_data = {
            'step_name': step_name,
            'task_data': task_data,
            'created_at': time.time()
        }
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(cache_data, f, ensure_ascii=False, indent=2)
        
        print(f"[缓存保存] 步骤 '{step_name}' 已保存到 {filename}")
        return {'success': True, 'message': f'任务已缓存到 {filename}'}
        
    except Exception as e:
        logger.error(f"保存任务缓存失败: {e}",exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/api/task/cache/load')
async def load_task_cache(step_name: str):
    """从缓存加载任务"""
    try:
        if not step_name:
            raise HTTPException(status_code=400, detail="步骤名称不能为空")
        
        cache_dir = os.path.join(os.path.dirname(__file__), '..', 'cache')
        filename = f"{step_name.replace(' ', '_').replace(':', '_')}.json"
        filepath = os.path.join(cache_dir, filename)
        
        if not os.path.exists(filepath):
            return {'success': False, 'message': '未找到缓存文件'}
        
        with open(filepath, 'r', encoding='utf-8') as f:
            cache_data = json.load(f)
        
        print(f"[缓存加载] 从 {filename} 加载步骤 '{step_name}'")
        return {
            'success': True, 
            'task_data': cache_data.get('task_data'),
            'created_at': cache_data.get('created_at')
        }
        
    except Exception as e:
        logger.error(f"加载任务缓存失败: {e}",exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/api/task/cache/list')
async def list_task_cache():
    """列出所有缓存的任务"""
    try:
        cache_dir = os.path.join(os.path.dirname(__file__), '..', 'cache')
        
        if not os.path.exists(cache_dir):
            return {'success': True, 'cached_tasks': []}
        
        cached_tasks = []
        for filename in os.listdir(cache_dir):
            if filename.endswith('.json'):
                filepath = os.path.join(cache_dir, filename)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        cache_data = json.load(f)
                    
                    cached_tasks.append({
                        'filename': filename,
                        'step_name': cache_data.get('step_name', filename[:-5]),
                        'created_at': cache_data.get('created_at', 0)
                    })
                except Exception as e:
                    logger.warning(f"读取缓存文件 {filename} 失败: {e}")
        
        cached_tasks.sort(key=lambda x: x['created_at'], reverse=True)
        
        return {'success': True, 'cached_tasks': cached_tasks}
        
    except Exception as e:
        logger.error(f"列出任务缓存失败: {e}",exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/api/task/evaluate')
async def evaluate_task_api(request: Request):
    """API endpoint to evaluate user's task submission."""
    body = await request.json()
    if not body:
        raise HTTPException(status_code=400, detail="无效的请求数据")

    task_type = body.get('task_type')
    user_submission = body.get('submission')
    task_data = body.get('task_data')

    if not all([task_type, user_submission is not None, task_data]):
        raise HTTPException(status_code=400, detail="缺少必要的评估参数")

    result = {"correct": False, "error_reason": "未能完成评估"}

    try:
        if task_type == 'quiz':
            questions = task_data.get('questions', [])
            correct_answers = [q.get('answer') for q in questions]
            user_answers = user_submission

            print(f"[评估测验] 正确答案: {correct_answers}")
            print(f"[评估测验] 用户提交: {user_answers}")

            if len(user_answers) != len(correct_answers):
                print("[评估测验] 错误: 答案数量不匹配")
                raise HTTPException(status_code=400, detail="提交的答案数量与问题数量不匹配")

            all_correct_flag = True
            incorrect_indices = []
            for i, correct_ans in enumerate(correct_answers):
                user_ans = user_answers[i] if i < len(user_answers) else None
                is_item_correct = str(user_ans).strip().lower() == str(correct_ans).strip().lower()
                if not is_item_correct:
                    all_correct_flag = False
                    incorrect_indices.append(i)
            
            is_correct = all_correct_flag
            result = {"is_correct": is_correct}
            if not is_correct:
                result["incorrect_indices"] = incorrect_indices
                result["error_reason"] = "部分或全部答案错误。"
                
            print(f"[评估测验] 最终结果: {is_correct}, 错误索引: {incorrect_indices}")
            
        elif task_type == 'coding':
            print("[评估代码] 开始使用 LLM 进行评估...")
            task_info = task_data['task']
            problem_description = task_info.get('description', '')
            if not problem_description:
                print("[评估代码] 错误: 任务数据缺少描述")
                raise HTTPException(status_code=400, detail="任务数据缺少必要的描述信息")
            
            # 获取任务模式，默认为 complete
            task_mode = task_info.get('mode', 'complete')
            print(f"[评估代码] 任务模式: {task_mode}")
            
            # 根据模式准备评估所需的额外数据
            evaluation_data = {
                "problem_description": problem_description,
                "user_code": user_submission,
                "task_mode": task_mode
            }
            
            # 为不同模式添加特定数据
            if task_mode == "fill_blank":
                evaluation_data["task_data"] = {
                    "blanks": task_info.get('blanks', [])
                }
            elif task_mode == "guided_steps":
                # 前端应该提供 current_step 信息
                current_step = body.get('current_step', 1)
                evaluation_data["task_data"] = {
                    "current_step": current_step,
                    "steps": task_info.get('steps', [])
                }
            elif task_mode == "code_choice":
                evaluation_data["task_data"] = {
                    "question": task_info.get('question', ''),
                    "code_options": task_info.get('code_options', []),
                    "correct_option_id": task_info.get('correct_option_id', 1)
                }
            
            evaluation_result = await llm_client.evaluate_code_submission(**evaluation_data)
            result = evaluation_result
            print(f"[评估代码] LLM评估结果: {result}")
            
            print(f"[评估代码] 用户提交 ({task_mode} 模式):")
            print(user_submission)

        else:
            print(f"[评估错误] 不支持的任务类型: {task_type}")
            raise HTTPException(status_code=400, detail="不支持的任务类型")
            
        print(f"[评估完成] 返回结果: {result}")
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"评估任务时出错: {e}",exc_info=True)
        raise HTTPException(status_code=500, detail="评估过程中发生内部错误")

@router.post('/api/ai/suggest_questions')
async def suggest_questions_api(request: Request):
    """
    推荐问题API
    根据任务标题和描述生成推荐问题
    """
    try:
        body = await request.json()
        task_title = body.get('task_title', '')
        task_description = body.get('task_description', '')
        lang=body.get("lang","en")
        
        # 检查是否为错误纠正场景
        user_submission = body.get('user_submission')
        error_reason = body.get('error_reason')
        
        if not task_title or not task_description:
            raise HTTPException(status_code=400, detail="缺少必要的参数：task_title 和 task_description")
        
        # 根据是否有用户提交选择不同的方法
        if user_submission:
            # 错误纠正场景
            questions = await llm_client.suggest_questions_for_error(
                task_title, task_description, user_submission, error_reason,
                lang=lang
            )
        else:
            # 新任务场景
            questions = await llm_client.suggest_questions(task_title, task_description,lang=lang)
        
        return {"questions": questions}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"推荐问题生成失败: {str(e)}",exc_info=True)
        raise HTTPException(status_code=500, detail="推荐问题生成失败")

@router.post('/api/user/evaluate_ability')
async def evaluate_ability_api(request: Request):
    return {"info": "暂时屏蔽"}

@router.get('/api/courses/list')
async def get_courses_list():
    """获取可用课程列表"""
    try:
        courses_dir = os.path.join(os.path.dirname(__file__), '..', 'classes')
        courses = []
        
        if os.path.exists(courses_dir):
            for filename in os.listdir(courses_dir):
                filepath = os.path.join(courses_dir, filename)
                if os.path.isfile(filepath):
                    course_data = parse_course_file(filepath, filename)
                    if course_data:
                        courses.append(course_data)
        
        return {
            'success': True,
            'courses': courses
        }
    
    except Exception as e:
        logger.error(f"获取课程列表失败: {e}",exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

def parse_course_file(filepath, filename):
    """解析课程文件并提取信息"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        course_info = {
            'id': filename,
            'filename': filename,
            'title': get_course_title(filename, content),
            'subtitle': get_course_subtitle(filename, content),
            'description': get_course_description(filename, content),
            'type': get_course_type(filename, content),
            'duration': estimate_course_duration(content),
            'steps': count_course_steps(content),
            'difficulty': get_course_difficulty(filename, content),
            'learning_goal': get_course_learning_goal(filename, content),
            'content': content
        }
        
        return course_info
    
    except Exception as e:
        logger.error(f"解析课程文件 {filename} 失败: {e}",exc_info=True)
        return None

def get_course_title(filename, content):
    """从文件名或内容中提取课程标题"""
    titles = {
        'q-learning': 'Q-Learning强化学习',
        'web-development': 'Web前端开发',
        'data-analysis': 'Python数据分析',
        'mobile-app-dev': '移动应用开发'
    }
    return titles.get(filename, filename.replace('-', ' ').title())

def get_course_subtitle(filename, content):
    """获取课程副标题"""
    subtitles = {
        'q-learning': '从迷宫游戏学习强化学习算法',
        'web-development': '从HTML到现代前端框架',
        'data-analysis': '掌握数据科学核心技能',
        'mobile-app-dev': 'React Native跨平台开发'
    }
    return subtitles.get(filename, '机器学习基础课程')

def get_course_description(filename, content):
    """获取课程描述"""
    descriptions = {
        'q-learning': '通过迷宫游戏实例，深入理解Q-Learning算法的工作原理，学习状态、动作、奖励的概念，掌握Q-table更新机制和神经网络优化方法。',
        'web-development': '从零开始学习Web前端开发，掌握HTML、CSS、JavaScript三大技术栈，学会构建响应式网站和现代化Web应用。',
        'data-analysis': '使用Python进行数据分析，学习NumPy、Pandas、Matplotlib等核心库，掌握数据清洗、可视化和机器学习基础应用。',
        'mobile-app-dev': '学习React Native跨平台移动开发，从基础组件到完整应用开发，掌握移动应用设计、开发、测试和发布全流程。'
    }
    return descriptions.get(filename, '学习机器学习和人工智能的基础概念和应用')

def get_course_type(filename, content):
    """获取课程类型"""
    if 'q-learning' in filename.lower() or '强化学习' in content:
        return 'ai'
    elif 'web-development' in filename.lower() or 'HTML' in content or 'CSS' in content:
        return 'programming'
    elif 'data-analysis' in filename.lower() or 'NumPy' in content or 'Pandas' in content:
        return 'ml'
    elif 'mobile-app-dev' in filename.lower() or 'React Native' in content:
        return 'programming'
    elif 'programming' in filename.lower() or 'python' in content.lower():
        return 'programming'
    elif 'algorithm' in filename.lower() or '算法' in content:
        return 'algorithm'
    elif 'machine' in filename.lower() or 'ml' in filename.lower():
        return 'ml'
    return 'default'

def estimate_course_duration(content):
    """估算课程时长"""
    lines = content.split('\n')
    sections = len([line for line in lines if line.strip() and line[0].isdigit()])
    return f"{max(2, sections)} 小时"

def count_course_steps(content):
    """统计课程步骤数"""
    lines = content.split('\n')
    steps = len([line for line in lines if line.strip() and line[0].isdigit()])
    return max(1, steps)

def get_course_difficulty(filename, content):
    """获取课程难度"""
    difficulties = {
        'q-learning': '中级',
        'web-development': '初级',
        'data-analysis': '中级',
        'mobile-app-dev': '中级'
    }
    return difficulties.get(filename, '初级')

def get_course_learning_goal(filename, content):
    """获取学习目标描述"""
    goals = {
        'q-learning': '学习Q-Learning强化学习算法，通过迷宫游戏理解智能体如何在环境中学习最优策略',
        'web-development': '掌握Web前端开发技术，学会使用HTML、CSS、JavaScript构建现代化网站',
        'data-analysis': '学习Python数据分析技术，掌握数据处理、可视化和机器学习基础应用',
        'mobile-app-dev': '学习React Native移动应用开发，掌握跨平台应用开发技能'
    }
    return goals.get(filename, f'学习{filename}相关知识') 

async def call_example_callback(plan_data, chat_id,callback_url=''):
    """调用example_callback接口"""
    if not callback_url:
        logger.info(f"[回调] 没有回调URL")
        return
    callback_data = {
        "id": chat_id,
        "plan": plan_data
    }
    retry_num=3
    while retry_num>0:
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(callback_url, json=callback_data) as response:
                    if response.status == 200:
                        logger.info(f"[回调] 成功调用example_callback, chat_id: {chat_id}")
                        break
                    else:
                        logger.error(f"[回调] 调用example_callback失败, status: {response.status}")
                        retry_num-=1
                        await asyncio.sleep(1)
        except Exception as e:
            logger.error(f"[回调] 调用example_callback出错: {e}",exc_info=True)
            retry_num-=1
            await asyncio.sleep(1)
    if retry_num<=0:
        logger.error(f"[回调] 调用example_callback失败, chat_id: {chat_id}",exc_info=True)

async def is_plan_complete(plan_data, chat_id=None):
    """检查计划是否完整"""
    if not chat_id:
        # 如果没有chat_id，则使用旧的判断逻辑
        if not plan_data or "plan" not in plan_data:
            return False
        
        plan_steps = plan_data["plan"]
        if not plan_steps:
            return False
        
        # 检查是否有基本的步骤结构
        for step in plan_steps:
            if not all(key in step for key in ["step", "title", "description"]):
                return False
        if len(plan_steps) >= int(PLAN_STEP_LEN):
            return True
        else:
            return False
    else:
        # 使用Redis状态判断
        try:
            redis_conn = await get_redis_client()
            plan_status_key = f"chat_plan_status:{chat_id}"
            plan_status = await redis_conn.get(plan_status_key)
            
            # 如果状态为"complete"，说明计划生成完成
            return plan_status == "complete"
        except Exception as e:
            logger.error(f"[计划完整性检查] 检查Redis状态失败: {e}", exc_info=True)
            # 如果出错，回退到旧的判断逻辑
            return await is_plan_complete(plan_data)

async def should_update_plan(messages, current_plan,chat_id=None):
    """判断是否应该更新计划"""
    if not messages:
        return False
    
    if not current_plan or not await is_plan_complete(current_plan,chat_id):
        return False
    else:
        return True

async def extract_learning_goal(messages):
    """从消息中提取学习目标"""
    # 简单实现：使用第一条用户消息作为学习目标
    for message in messages:
        if message.get("role") == "user":
            return message.get("content", "")
    return ""

async def background_plan_task(chat_id, messages, is_update=False,callback_url='',current_plan_str=None,advise=None):
    """后台计划生成/更新任务"""
    try:
        start_time = time.time()
        redis_conn = await get_redis_client()
        plan_key = f"chat_plan:{chat_id}"
        advise_object=json.loads(advise)
        if is_update:
            # 更新计划
            logger.info(f"[后台任务] 开始更新计划, chat_id: {chat_id}")
            
            # 获取当前计划
            # current_plan_str = await redis_conn.get(plan_key)
            if not current_plan_str:
                logger.info(f"[后台任务] 未找到现有计划，转为创建计划")
                is_update = False
            else:
                current_plan = json.loads(current_plan_str)
                learning_goal = json.dumps(messages)
                if len(advise_object["should_update"])==0 or advise_object["reason"]=="":
                    await call_example_callback(current_plan, chat_id,callback_url)
                    return
                # 生成更新
                # from app.learn_plan import generate_plan_update_stream
                updated_plan = current_plan.copy()
                cnt=0
                async for update_item in generate_learning_plan_stream(learning_goal,current_plan=current_plan_str,is_update=True,advise=advise):
                    if 'updates' in update_item:
                        update_item=update_item.get("updates")[0]
                    step_number = update_item.get("step_number")
                    step_data = update_item.get("step_data")
                    if step_number and step_data:
                        # 更新对应的步骤
                        for i, step in enumerate(updated_plan["plan"]):
                            if step.get("step") == step_number:
                                step_data["videos"]=await retrive_rerank(step_data.get('search_keyword', ''))
                                logger.info("*"*100)
                                logger.info(step_data)
                                logger.info("*"*100)
                                updated_plan["plan"][i] = step_data
                                logger.info(f"[后台任务] 更新步骤 {step_number}")
                                cnt+=1
                                # 每一步更新后立即保存到Redis
                                try:
                                    await redis_conn.set(plan_key, json.dumps(updated_plan, ensure_ascii=False))
                                    logger.info(f"[后台任务] 步骤更新已保存到Redis: {step_number}")
                                except Exception as e:
                                    logger.error(f"[后台任务] 保存步骤更新到Redis失败: {e}")
                                break
                
                # logger.info(f"[后台任务] 计划更新完成, ")
                end_time=time.time()
                logger.info(f"[后台任务] 计划更新完成,更新步骤数: {cnt}, 耗时: {end_time-start_time} 秒") 
                # 调用回调
                await call_example_callback(updated_plan, chat_id,callback_url)
                   
                return
        
        if not is_update:
            # 创建新计划
            logger.info(f"[后台任务] 开始创建新计划, chat_id: {chat_id}")
            
            learning_goal = json.dumps(messages)
            if not learning_goal:
                logger.info(f"[后台任务] 无法提取学习目标")
                return
            
            # 生成新计划
            new_plan = {"plan": []}
            async for step in generate_learning_plan_stream(learning_goal):
                new_plan["plan"].append(step)
                logger.info(f"[后台任务] 生成步骤: {step.get('title', '')}")
                step["videos"]=await retrive_rerank(step.get('search_keyword', ''))
                logger.info("*"*100)
                logger.info(step)
                logger.info("*"*100)
                # 每一步完成后立即保存到Redis
                try:
                    await redis_conn.set(plan_key, json.dumps(new_plan, ensure_ascii=False))
                    logger.info(f"[后台任务] 步骤已保存到Redis: {step.get('title', '')}")
                except Exception as e:
                    logger.error(f"[后台任务] 保存步骤到Redis失败: {e}")
            
            # logger.info(f"[后台任务] 新计划生成完成")
            
            # 调用回调
            end_time=time.time()
            logger.info(f"[后台任务] 新计划生成完成, 生成步骤数: {len(new_plan['plan'])}, 耗时: {end_time-start_time} 秒")  
            await call_example_callback(new_plan, chat_id,callback_url)
  
    except asyncio.CancelledError:
        logger.warning(f"后台任务 {chat_id} 被取消。")
        await call_example_callback(current_plan, chat_id,callback_url)
    except Exception as e:
            # 在任务内部捕获并记录异常
        logger.error(f"后台任务 {chat_id} 内部发生异常: {e}", exc_info=True)
        await call_example_callback(current_plan, chat_id,callback_url)

@router.post('/api/chat1/stream')
async def chat_with_plan_generation(request: Request,db: Session = Depends(get_db)):
    """
    新的聊天接口，支持流式回复和后台计划生成/更新
    
    接收参数: {id, messages}
    功能:
    1. 流式返回聊天回复
    2. 后台异步生成/更新学习计划
    3. 完成后调用example_callback接口
    """
    try:
        body = await request.json()
        chat_id = body.get('id')
        messages = body.get('messages', [])
        callback_url = body.get('url', '')
        lang = body.get('lang')
        if not lang:
            # 根据最后一条用户消息自动识别语言（含中文字符则为中文）
            last_user_content = ''
            for m in reversed(messages):
                if m.get('role') == 'user':
                    last_user_content = m.get('content', '')
                    break
            has_chinese = any('\u4e00' <= ch <= '\u9fff' for ch in last_user_content)
            lang = 'zh' if has_chinese else 'en'
        
        if not chat_id:
            raise HTTPException(status_code=400, detail="缺少必要参数: id")
        
        if not messages:
            raise HTTPException(status_code=400, detail="缺少必要参数: messages")
        
        logger.info(f"[Chat1 Stream] 接收请求, chat_id: {chat_id}, 消息数: {len(messages)}")
        
        # 检查是否需要更新计划
        redis_conn = await get_redis_client()
        plan_key = f"chat_plan:{chat_id}"
        plan_status_key = f"chat_plan_status:{chat_id}"
        plan_status = await redis_conn.get(plan_status_key)
        current_plan_str = await redis_conn.get(plan_key)
        current_plan = json.loads(current_plan_str) if current_plan_str else None
        is_update = await should_update_plan(messages, current_plan,chat_id)
        logger.info(f"[Chat1 Stream] 计划操作类型: {'更新' if is_update else '创建'}")
        
        # 启动后台计划任务
        # asyncio.create_task(background_plan_task(chat_id, messages, is_update,callback_url,current_plan_str=current_plan_str))
        
        # 生成聊天回复
        # 确定基础系统提示
        base_system_prompt = CHAT1_SYSTEM_ZH if lang == 'zh' else CHAT1_SYSTEM_EN
        
        data_processing_task = None
        
        if is_update and current_plan and len([m for m in messages if m.get('role') == 'user'])>1:
            # 简化学习计划以减少token使用
            simplified_plan = []
            step_prefix = "步骤" if lang == 'zh' else "Step"
            title_prefix = "标题" if lang == 'zh' else "Title"
            type_prefix = "类型" if lang == 'zh' else "Type"
            difficulty_prefix = "难度" if lang == 'zh' else "Difficulty"
            desc_prefix = "描述" if lang == 'zh' else "Description"
            for step in current_plan.get('plan', []):
                simplified_plan.append(
                    f"{step_prefix} {step.get('step')}: {title_prefix}: {step.get('title', '')} | {type_prefix}: {step.get('type', '')} | {difficulty_prefix}: {step.get('difficulty', '')} | {desc_prefix}: {step.get('description', '')}"
                )
            
            simplified_plan_str = "\n".join(simplified_plan)
            
            # 获取更新提示模板
            update_prompt_template = CHAT1_UPDATE_ZH if lang == 'zh' else CHAT1_UPDATE_EN
            
            # 替换基础系统提示为更新提示，而不是简单拼接
            system_prompt = update_prompt_template.format(current_plan=simplified_plan_str)
        elif len([m for m in messages if m.get('role') == 'user'])>1:
            prompt_template=CHAT1_SYSTEM_ZH_TMP if lang == 'zh' else CHAT1_SYSTEM_EN_TMP
            system_prompt=prompt_template
        else:
            # 如果不是更新，使用基础系统提示
            system_prompt = base_system_prompt
            
            async def process_data():
                """处理数据搜索和入库"""
                db_session = db
                try:
                    category = None
                    # 从messages中提取学习目标
                    learning_goal = "\n".join([message.get("content", "") for message in messages if message.get("role") == "user"])
                    # for message in messages:
                    #     if message.get("role") == "user":
                    #         learning_goal = message.get("content", "")
                    #         break
                    
                    # 识别类别
                    category = await identify_learning_category(learning_goal, lang)
                    logger.info(f"[Chat1 Stream] 识别到学习类别: {category}")
                    
                    # 将类别信息保存到Redis，后续可能会用到
                    category_key = f"chat_plan_category:{chat_id}"
                    await redis_conn.set(category_key, category)
                    
                    search_keywords = await llm_client.get_completion(get_extract_keywords_prompt(messages))
                    logger.info(f"[Chat1 Stream] 参考内容搜索关键词: {search_keywords}")
                    if category == "coding":
                        context_search_keywords ="site:leetcode.com OR site:stackoverflow.com "+ search_keywords
                    else:
                        context_search_keywords = search_keywords
                    context_search_results = await searxng_web_search(context_search_keywords, lang=lang)
                    if not context_search_results['results']:
                        context_search_results = await searxng_web_search(search_keywords, lang=lang)
                    context_search_results_summary = await batch_fetch_jina_summary([(r['url'], r['content'], r['title']) for i, r in enumerate(context_search_results.get('results', [])) if i < 4])
                    
                    tasks = []
                    logger.info(f"[Chat1 Stream] 参考内容处理开始")
                    for r in context_search_results_summary:
                        data = r.get('data', {})
                        if data and data.get('text') and data.get('url'):
                            tasks.append(process_content(data['text'], chat_id, db_session, data['url'], commit=False))
                    
                    if tasks:
                        await asyncio.gather(*tasks)
                        db_session.commit()
                        logger.info(f"[Chat1 Stream] 参考内容处理完成")
                    else:
                        logger.info(f"[Chat1 Stream] 无参考内容处理")
                except Exception as e:
                    logger.error(f"[Chat1 Stream] 数据处理失败: {e}", exc_info=True)
                    db_session.rollback()
                finally:
                    db_session.close()

            # 创建数据处理任务
            data_processing_task = asyncio.create_task(process_data())

        chat_messages=[{"role":"system","content":system_prompt}]
        chat_messages.extend(messages)
        
        logger.info(f"[Chat1 Stream] 开始生成聊天回复")
        
        assistant_response = ""
        llm_response_task = llm_client.chat_completion(chat_messages)

        if data_processing_task:
            results = await asyncio.gather(llm_response_task, data_processing_task)
            res = results[0]
        else:
            res = await llm_response_task
        
        assistant_response=res.choices[0].message.content
        if not is_update:
            assistant_response=dict(response=assistant_response,updateSteps=[],reason="")
        else:
            assistant_response=json_repair.loads(assistant_response)
        logger.info(f"[Chat1 Stream] 聊天回复生成完成: {assistant_response}")
        
        return JSONResponse(assistant_response,
                        media_type='application/json',
                        headers={
                            'Cache-Control': 'no-cache',
                            'X-Accel-Buffering': 'no',
                            'Connection': 'keep-alive'
                        }
                        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Chat1 Stream] 处理请求失败: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/api/example_callback')
async def example_callback(request: Request):
    """示例回调接口，接收完整的计划数据"""
    try:
        body = await request.json()
        chat_id = body.get('id')
        plan_data = body.get('plan')
        
        logger.info(f"[Example Callback] 接收到回调, chat_id: {chat_id}")
        logger.info(f"[Example Callback] 计划包含 {len(plan_data.get('plan', []))} 个步骤")
        logger.info(f"[Example Callback] 计划: {plan_data}")
        # 这里可以添加实际的处理逻辑，比如通知前端、发送邮件等
        # res=requests.post('http://localhost:5000/api/task/generate',json=plan_data.get('plan',[])[0])
        # logger.info(f"[Example Callback] 生成任务: {res}")
        return {"success": True, "message": "回调处理成功"}
    
    except Exception as e:
        logger.error(f"[Example Callback] 处理回调失败: {e}")
        raise HTTPException(status_code=500, detail=str(e)) 

async def identify_learning_category(learning_goal, lang='en'):
    """
    识别学习目标属于的类别
    
    Args:
        learning_goal (str): 学习目标的描述
        lang (str): 语言，'en'或'zh'
        
    Returns:
        str: 学习类别，可能的值包括:
            - coding: 编程、计算机科学、软件开发、算法
            - data_science: 数据科学、机器学习、人工智能、数据分析
            - language: 语言学习、翻译、写作
            - math: 数学、统计学、逻辑学
            - science: 自然科学、物理、化学、生物学
            - humanities: 人文学科、历史、哲学、文学
            - business: 商业、管理、经济、金融
            - art: 艺术、设计、音乐、创作
            - health: 健康、医学、心理学、体育
            - other: 其他类别
    """
    try:
        # 准备提示词
        if lang == 'zh':
            prompt = f"""
            请分析以下学习目标，识别它属于哪个类别，并只返回一个类别关键词:
            
            学习目标: {learning_goal}
            
            请从以下类别中选择一个最匹配的:
            - coding: 编程、计算机科学、软件开发、算法、前端、后端、全栈开发
            - data_science: 数据科学、机器学习、人工智能、数据分析、大数据
            - language: 语言学习、翻译、写作、沟通技巧
            - math: 数学、统计学、逻辑学、数学分析
            - science: 自然科学、物理、化学、生物学、天文学、地理学
            - humanities: 人文学科、历史、哲学、文学、社会学、心理学
            - business: 商业、管理、经济、金融、市场营销、创业
            - art: 艺术、设计、音乐、绘画、摄影、创作
            - health: 健康、医学、营养学、体育、健身
            - other: 其他不属于上述类别的内容
            
            只返回一个类别关键词，例如 "coding" 或 "art"，无需解释。
            """
        else:
            prompt = f"""
            Please analyze the following learning goal and identify which category it belongs to by returning only a category keyword:
            
            Learning goal: {learning_goal}
            
            Please select one category that matches the best:
            - coding: programming, computer science, software development, algorithms, frontend, backend, full-stack
            - data_science: data science, machine learning, artificial intelligence, data analysis, big data
            - language: language learning, translation, writing, communication skills
            - math: mathematics, statistics, logic, mathematical analysis
            - science: natural sciences, physics, chemistry, biology, astronomy, geography
            - humanities: humanities, history, philosophy, literature, sociology, psychology
            - business: business, management, economics, finance, marketing, entrepreneurship
            - art: art, design, music, painting, photography, creative works
            - health: health, medicine, nutrition, sports, fitness
            - other: any content not belonging to the above categories
            
            Return only one category keyword, such as "coding" or "art", without explanation.
            """
        
        # 调用LLM识别类别
        response = await llm_client.get_completion(prompt)
        category = response.strip().lower()
        
        # 验证返回的类别是否有效
        valid_categories = ["coding", "data_science", "language", "math", "science", "humanities", "business", "art", "health", "other"]
        if category not in valid_categories:
            # 如果返回的类别无效，尝试匹配最相近的类别
            for valid_cat in valid_categories:
                if valid_cat in category:
                    return valid_cat
            return "other"  # 默认返回other
        
        return category
        
    except Exception as e:
        logger.error(f"类别识别失败: {e}", exc_info=True)
        return "other"  # 出错时默认返回other

def _format_search_results_for_context(search_results, lang: str, doc_count: int, doc_references: dict):
    """
    Formats search results into a numbered context string and updates document references.
    """
    if not search_results:
        return "", doc_count, doc_references

    context_parts = []
    
    # Add search result guidance
    if lang == 'zh':
        search_guidance = f"\n\n=== 网络搜索结果 ===\n以下是根据学习目标搜索到的相关网络资源，请在生成学习计划时合理参考这些内容："
    else:
        search_guidance = f"\n\n=== Web Search Results ===\nThe following are relevant web resources found based on the learning objectives. Please refer to these contents appropriately when generating the learning plan:"
    context_parts.append(search_guidance)
    
    numbered_search_context = []
    for summary in search_results:
        if summary is None:
            continue
            
        doc_count += 1
        content = summary.get('parent_content', '')
        url = summary.get('metadata', {}).get('source', '')
        summ = summary.get('metadata', {}).get('summary', '')
        
        doc_references[str(doc_count)] = {
            "type": "web_search_result",
            "url": url,
            "summary": summ,
            "content": content
        }
        
        if lang == 'zh':
            numbered_search_context.append(f"\n[文档{doc_count}] \n内容摘要: {content}")
        else:
            numbered_search_context.append(f"\n[Document{doc_count}] \nContent Summary: {content}")
    
    context_parts.append("\n".join(numbered_search_context))
    logger.info(f"[Context Formatting] Formatted {len(numbered_search_context)} search results for context.")
    
    return "".join(context_parts), doc_count, doc_references

@router.post('/api/learning/plan/stream_generate')
async def stream_generate_plan(request: Request,db: Session = Depends(get_db)):
    """
    流式生成/更新学习计划API
    
    接收参数: {id, messages, is_update, current_plan, advise}
    功能:
    1. 流式返回生成/更新的学习计划步骤
    2. 每生成一个步骤就立即返回
    """
    try:
        body = await request.json()
        chat_id = body.get('id')
        messages = body.get('messages', [])
        retrive_enabled = body.get('retrive_enabled', False)
        # is_update = body.get('is_update', False)
        #TODO current_plan不应该依赖输入，实时从redis中查
        # current_plan_str = body.get('current_plan')
        redis_conn = await get_redis_client()
        plan_key = f"chat_plan:{chat_id}"
        current_plan_str = await redis_conn.get(plan_key)
        c_plan = json.loads(current_plan_str) if current_plan_str else None
        # is_update = await should_update_plan(messages, c_plan)
        is_update = await should_update_plan(messages, c_plan, chat_id)
        advise = body.get('advise', json.dumps({"updateSteps": [], "reason": ""},ensure_ascii=False))
        lang = body.get('lang', 'en')
        fn=retrive_rerank if lang == 'zh' else retrive_youtube_rerank        
        if not chat_id:
            raise HTTPException(status_code=400, detail="缺少必要参数: id")
        
        if not messages:
            raise HTTPException(status_code=400, detail="缺少必要参数: messages")
        
        # 准备上下文内容和文档引用映射
        context = ""
        context_search_results_summary=[]
        doc_count = 0  # 统一的文档编号计数器
        doc_references = {}  # 存储编号到文档信息的映射
        doc_ref_key = f"chat_doc_references:{chat_id}"
        
        if retrive_enabled:
            # 使用chat_id获取所有相关文档摘要
            all_summaries = await get_all_document_summaries_by_chat_id(chat_id, db)
            
            if all_summaries:
                # 添加上传文档指导语
                if lang == 'zh':
                    context = "=== 上传文档内容 ===\n以下是您上传的文档内容摘要，请在生成学习计划时优先参考："
                else:
                    context = "=== Uploaded Document Content ===\nThe following are summaries of your uploaded documents. Please prioritize these when generating the learning plan:"
                
                # 为上传的文档分配编号并存储映射关系
                numbered_doc_contexts = []
                for i, doc_info in enumerate(all_summaries):
                    doc_count += 1
                    # 存储文档引用映射
                    doc_references[str(doc_count)] = {
                        "type": "uploaded_document",
                        "doc_id": doc_info['doc_id'],
                        "summary": doc_info['summary'],
                        "content": doc_info.get('preview', ''),  # 如果有完整内容
                    }
                    
                    if lang == 'zh':
                        numbered_doc_contexts.append(f"\n[文档{doc_count}] \n内容摘要: {doc_info['summary']}")
                    else:
                        numbered_doc_contexts.append(f"\n[Document{doc_count}] \nContent Summary: {doc_info['summary']}")
                
                context += "\n".join(numbered_doc_contexts)
                logger.info(f"[Plan Stream] 使用 {len(all_summaries)} 个上传文档摘要作为编号上下文")
        else:
        # 使用searxng_web_search根据对话内容搜索相关文档，并使用jina_read获取摘要
        # 将摘要作为带编号的上下文
            # context_search_keywords = await llm_client.get_completion(get_extract_keywords_prompt(messages))
            # logger.info(f"[Plan Stream] 参考内容搜索关键词: {context_search_keywords}")
            # context_search_results = await searxng_web_search(context_search_keywords, lang=lang)
            # context_search_results_summary = await batch_fetch_jina_summary([(r['url'],r['content'],r['title']) for i,r in enumerate(context_search_results['results']) if i<4])
            search_keywords = await llm_client.get_completion(get_extract_keywords_prompt(messages))
            context_search_results_summary = await search_documents(search_keywords, chat_id,  db_session=db)
            context_addition, doc_count, doc_references = _format_search_results_for_context(
                context_search_results_summary, lang, doc_count, doc_references
            )
            context += context_addition
        
        # 添加统一的引用指导（如果有任何文档内容）
        if doc_count > 0:
            if lang == 'zh':
                reference_guidance = f"\n\n=== 引用指导 ===\n请在生成每个学习步骤时，添加一个references字段，使用数组格式记录主要参考了哪些编号的文档内容，例如：\"references\": [1, 3, 5]。如果某个步骤没有参考特定文档，则设置为空数组[]。"
            else:
                reference_guidance = f"\n\n=== Reference Guidelines ===\nWhen generating each learning step, please add a 'references' field using array format to indicate which numbered documents were mainly referenced, for example: \"references\": [1, 3, 5]. If a step doesn't reference specific documents, set it to an empty array []."
            
            context += reference_guidance
        
        # 将文档引用映射存储到Redis
        if doc_references:
            await redis_conn.set(doc_ref_key, json.dumps(doc_references, ensure_ascii=False), ex=3600)  # 1小时过期
            logger.info(f"[Plan Stream] 存储 {len(doc_references)} 个文档引用映射到Redis")
        else:
            logger.info(f"[Plan Stream] 没有文档引用映射")
        
        logger.info(f"[Plan Stream] 接收请求, chat_id: {chat_id}, 操作: {'更新' if is_update else '创建'}")
        logger.info(f"messages: {messages}")
        if is_update and not current_plan_str:
            logger.error(f"[Plan Stream] 更新计划时缺少current_plan参数")
            raise HTTPException(status_code=400, detail="更新计划时缺少current_plan参数")
        
        # 设置计划状态为生成中
        plan_status_key = f"chat_plan_status:{chat_id}"
        await redis_conn.set(plan_status_key, "generating")
        logger.info(f"[Plan Stream] 设置计划状态: generating, chat_id: {chat_id}")
        
        # 在创建新计划前，先识别学习类别
        category = None
        # if not is_update:
        #     # 从messages中提取学习目标
        #     learning_goal = "\n".join([message.get("content", "") for message in messages if message.get("role") == "user"])
        #     # for message in messages:
        #     #     if message.get("role") == "user":
        #     #         learning_goal = message.get("content", "")
        #     #         break
            
        #     # 识别类别
        #     category = await identify_learning_category(learning_goal, lang)
        #     logger.info(f"[Plan Stream] 识别到学习类别: {category}")
            
        #     # 将类别信息保存到Redis，后续可能会用到
        #     category_key = f"chat_plan_category:{chat_id}"
        #     await redis_conn.set(category_key, category)
        # else:
            # 在更新计划时，从Redis中获取之前识别的类别
        category_key = f"chat_plan_category:{chat_id}"
        category = await redis_conn.get(category_key) or "other"
        logger.info(f"[Plan Stream] 获取到已识别的学习类别: {category}")
        
        async def generate_plan_stream():
            try:
                start_time = time.time()
                redis_conn = await get_redis_client()
                plan_key = f"chat_plan:{chat_id}"
                
                # 尝试解析advise参数
                try:
                    advise_object = json.loads(advise)
                except json.JSONDecodeError:
                    logger.error(f"[Plan Stream] advise参数格式错误: {advise}")
                    advise_object = {"updateSteps": [], "reason": ""}
                    yield f"data: {json.dumps({'warning': 'advise参数格式错误，使用默认值'}, ensure_ascii=False)}\n\n"
                
                if is_update and current_plan_str:
                    # 尝试解析current_plan
                    try:
                        current_plan = json.loads(current_plan_str)
                    except json.JSONDecodeError:
                        logger.error(f"[Plan Stream] 无法解析current_plan")
                        yield f"data: {json.dumps({'error': '无法解析current_plan'}, ensure_ascii=False)}\n\n"
                        return
                    
                    # 更新计划
                    logger.info(f"[Plan Stream] 开始更新计划, chat_id: {chat_id}")
                    learning_goal = json.dumps(messages,ensure_ascii=False)
                    
                    # 检查是否需要更新
                    update_steps = advise_object.get("updateSteps", [])
                    update_reason = advise_object.get("reason", "")
                    logger.info(f"[Plan Stream] 更新步骤: {update_steps}, 更新原因: {update_reason}")
                    
                    if len(update_steps) == 0 or not update_reason:
                        logger.info(f"[Plan Stream] 无需更新计划")
                        yield f"data: {json.dumps({'message': '无需更新计划', 'done': True}, ensure_ascii=False)}\n\n"
                        return
                    
                    # 生成更新
                    updated_plan = current_plan.copy()
                    cnt = 0
                    try:
                        async for update_item in generate_learning_plan_stream(learning_goal, current_plan=current_plan_str, is_update=True, advise=json.dumps(dict(updateSteps=update_steps,reason=update_reason),ensure_ascii=False), lang=lang, context=context, category=category):
                            # 检查是否是introduction部分的更新
                            if "introduction" in update_item:
                                logger.info(f"[Plan Stream] 更新课程介绍 {update_item['introduction']}")
                                introduction = update_item["introduction"]
                                updated_plan["introduction"] = introduction
                                
                                # 保存到Redis
                                try:
                                    await redis_conn.set(plan_key, json.dumps(updated_plan, ensure_ascii=False))
                                    logger.info(f"[Plan Stream] 更新的课程介绍已保存到Redis")
                                except Exception as e:
                                    logger.error(f"[Plan Stream] 保存更新的课程介绍到Redis失败: {e}",exc_info=True)
                                logger.info(f"[Plan Stream] 更新的课程介绍: {introduction}")
                                # 流式返回更新的课程介绍
                                yield f"data: {json.dumps({'introduction': introduction}, ensure_ascii=False)}\n\n"
                                continue
                                
                            if 'updates' in update_item:
                                update_item = update_item.get("updates")[0]
                            
                            step_number = update_item.get("step_number")
                            step_data = update_item.get("step_data")
                            
                            if step_number and step_data:
                                # 更新对应的步骤
                                step_updated = False
                                for i, step in enumerate(updated_plan["plan"]):
                                    if str(step.get("step")) == str(step_number):
                                        current_step_context=step.get("previous_steps_context",[])
                                        try:
                                            # 获取视频推荐
                                            # videos = await retrive_rerank(step_data.get('search_keyword', ''))
                                            videos=await fn(step_data.get('search_keyword', ''))
                                            if isinstance(videos,list) and len(videos)==0:
                                                videos = await duckduckgo_video_search(step_data.get('search_keyword', ''), lang=lang)
                                            step_data["videos"] = videos
                                            logger.info(f"[Plan Stream] 步骤 {step_number} 获取到 {len(videos)} 个视频推荐")
                                        except Exception as e:
                                            logger.error(f"[Plan Stream] 获取视频推荐失败: {e}")
                                            step_data["videos"] = []
                                        step_data["lang"] = lang
                                        updated_plan["plan"][i] = step_data
                                        for j in range(i+1,len(updated_plan["plan"])):
                                            updated_plan["plan"][j]["previous_steps_context"][i] = {
                                                "title": step_data.get("title"),
                                                "description": step_data.get("description")
                                            }
                                        step_data["previous_steps_context"] = current_step_context
                                        logger.info(f"[Plan Stream] 更新步骤 {step_number}: {step_data}")
                                        logger.info(f"")
                                        cnt += 1
                                        step_updated = True
                                        
                                        # 保存到Redis
                                        try:
                                            await redis_conn.set(plan_key, json.dumps(updated_plan, ensure_ascii=False))
                                            logger.info(f"[Plan Stream] 步骤更新已保存到Redis: {step_number}")
                                        except Exception as e:
                                            logger.error(f"[Plan Stream] 保存步骤更新到Redis失败: {e}")
                                        
                                        # 处理文档引用，将编号替换为具体内容
                                        step_data = await process_step_references(step_data, chat_id)
                                        
                                        # 流式返回当前步骤
                                        yield f"data: {json.dumps({'step': step_data, 'step_number': step_number, 'total': len(updated_plan['plan'])}, ensure_ascii=False)}\n\n"
                                        break
                                
                                if not step_updated:
                                    logger.warning(f"[Plan Stream] 未找到要更新的步骤: {step_number}")
                                    yield f"data: {json.dumps({'warning': f'未找到要更新的步骤: {step_number}'}, ensure_ascii=False)}\n\n"
                    except Exception as e:
                        logger.error(f"[Plan Stream] 更新计划时发生错误: {e}", exc_info=True)
                        yield f"data: {json.dumps({'error': f'更新计划时发生错误: {str(e)}'}, ensure_ascii=False)}\n\n"
                        return
                    
                    end_time = time.time()
                    logger.info(f"[Plan Stream] 计划更新完成, 更新步骤数: {cnt}, 耗时: {end_time-start_time} 秒")
                    
                    # 设置计划状态为完成
                    await redis_conn.set(f"chat_plan_status:{chat_id}", "complete")
                    logger.info(f"[Plan Stream] 设置计划状态: complete, chat_id: {chat_id}")
                    
                    yield f"data: {json.dumps({'done': True, 'plan': updated_plan}, ensure_ascii=False)}\n\n"
                
                else:
                    # 创建新计划
                    logger.info(f"[Plan Stream] 开始创建新计划, chat_id: {chat_id}")
                    
                    learning_goal = json.dumps(messages,ensure_ascii=False)
                    if not learning_goal:
                        logger.info(f"[Plan Stream] 无法提取学习目标")
                        yield f"data: {json.dumps({'error': '无法提取学习目标'}, ensure_ascii=False)}\n\n"
                        return
                    
                    # 生成新计划
                    new_plan = {"plan": []}
                    step_count = 0
                    previous_steps_summary = []  # 用于存储历史步骤摘要
                    
                    try:
                        async for step in generate_learning_plan_stream(learning_goal, lang=lang, context=context, category=category):
                            # 检查是否是introduction部分
                            if "introduction" in step:
                                # logger.info(f"[Plan Stream] 生成课程介绍")
                                logger.info(f"[Plan Stream] 生成课程介绍: {step['introduction']}")
                                introduction = step["introduction"]
                                new_plan["introduction"] = introduction
                                
                                # 保存到Redis
                                try:
                                    await redis_conn.set(plan_key, json.dumps(new_plan, ensure_ascii=False))
                                    logger.info(f"[Plan Stream] 课程介绍已保存到Redis")
                                except Exception as e:
                                    logger.error(f"[Plan Stream] 保存课程介绍到Redis失败: {e}",exc_info=True)
                                
                                # 流式返回课程介绍
                                yield f"data: {json.dumps({'introduction': introduction}, ensure_ascii=False)}\n\n"
                                continue
                            
                            step_count += 1
                            
                            # 在步骤中注入历史上下文
                            step["previous_steps_context"] = previous_steps_summary.copy()

                            try:
                                # 获取视频推荐
                                search_keyword = step.get('search_keyword', '')
                                if search_keyword:
                                    # videos = await retrive_rerank(search_keyword)
                                    videos= await fn(search_keyword)
                                    if isinstance(videos,list) and len(videos)==0:
                                        videos = await duckduckgo_video_search(search_keyword, lang=lang)
                                    step["videos"] = videos
                                    logger.info(f"[Plan Stream] 步骤 {step_count} 获取到 {len(videos)} 个视频推荐")
                                else:
                                    step["videos"] = []
                                    logger.warning(f"[Plan Stream] 步骤 {step_count} 没有搜索关键词")
                            except Exception as e:
                                logger.error(f"[Plan Stream] 获取视频推荐失败: {e}", exc_info=True)
                                step["videos"] = []
                            step["lang"] = lang
                            new_plan["plan"].append(step)
                            logger.info(f"[Plan Stream] 生成步骤 {step_count}: {step}")

                            # 更新历史步骤摘要，为下一步做准备
                            previous_steps_summary.append({
                                "title": step.get("title"),
                                "description": step.get("description")
                            })
                            
                            # 保存到Redis
                            try:
                                await redis_conn.set(plan_key, json.dumps(new_plan, ensure_ascii=False))
                                logger.info(f"[Plan Stream] 步骤已保存到Redis: {step.get('title', '')}")
                            except Exception as e:
                                logger.error(f"[Plan Stream] 保存步骤到Redis失败: {e}",exc_info=True)
                            
                            # 处理文档引用，将编号替换为具体内容
                            step = await process_step_references(step, chat_id)
                            
                            # 流式返回当前步骤
                            yield f"data: {json.dumps({'step': step, 'step_number': step_count, 'total': step_count}, ensure_ascii=False)}\n\n"
                    except Exception as e:
                        logger.error(f"[Plan Stream] 生成计划时发生错误: {e}", exc_info=True)
                        yield f"data: {json.dumps({'error': f'生成计划时发生错误: {str(e)}'}, ensure_ascii=False)}\n\n"
                        return
                    
                    end_time = time.time()
                    logger.info(f"[Plan Stream] 新计划生成完成, 生成步骤数: {len(new_plan['plan'])}, 耗时: {end_time-start_time} 秒")
                    
                    # 设置计划状态为完成
                    await redis_conn.set(f"chat_plan_status:{chat_id}", "complete")
                    logger.info(f"[Plan Stream] 设置计划状态: complete, chat_id: {chat_id}")
                    
                    yield f"data: {json.dumps({'done': True, 'plan': new_plan}, ensure_ascii=False)}\n\n"
            
            except Exception as e:
                # 如果出错，也要将状态设置为完成，避免永久卡在"generating"状态
                try:
                    await redis_conn.set(f"chat_plan_status:{chat_id}", "failed")
                    logger.error(f"[Plan Stream] 计划生成失败，设置状态: failed, chat_id: {chat_id}")
                except:
                    pass
                    
                logger.error(f"[Plan Stream] 生成计划流时发生错误: {e}", exc_info=True)
                yield f"data: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"
        
        return StreamingResponse(
            generate_plan_stream(),
            media_type='text/event-stream',
            headers={
                'Cache-Control': 'no-cache',
                'X-Accel-Buffering': 'no',
                'Connection': 'keep-alive'
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Plan Stream] 处理请求失败: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/api/answer/stream')
async def answer_stream(request: Request):
    body = await request.json()
    text = body.get('question', '')
    context=body.get('context','')
    lang = body.get('lang', 'en')
    logger.info(f"[Answer Stream] 接收请求, lang: {lang}, question: {text}, context: {context}")
    system_prompt = ANSWER_SYSTEM_PROMPT_EN if lang == 'en' else ANSWER_SYSTEM_PROMPT_ZH
    prompt_template=ANSWER_PROMPT_EN if lang == 'en' else ANSWER_PROMPT_ZH
    messages = [{"role": "system", "content": system_prompt}, {"role": "user", "content": prompt_template.format(selected_text=context,user_query=text)}]
    async def generate_answer_stream():
        async for chunk in llm_client.stream_chat(messages):
            yield chunk
    return StreamingResponse(
        generate_answer_stream(),
        media_type='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
            'Connection': 'keep-alive'
        }
    )
async def search_web_logic(search_keyword: str, lang: str = 'en'):
    search_funcs = [
        lambda: web_search(search_keyword),
        lambda: serper_web_search(search_keyword,lang=lang),
        lambda: searxng_web_search(search_keyword,lang=lang)
    ]
    web_res = await try_search_functions(search_funcs)
    return web_res

@router.post('/api/web/search')
async def get_web_res(request: Request):
    body = await request.json()
    search_keyword = body.get('search_keyword', '')
    lang = body.get('lang', 'en')
    web_res = await search_web_logic(search_keyword,lang)
    # logger.info(f"[Web Search] 获取到 {len(web_res['results'])} 个结果")
    return JSONResponse(dict(web_res=web_res))


async def search_video_logic(search_keyword: str, lang: str = 'en'):
    """
    Core logic for searching videos. It tries a sequence of search functions
    based on the language and returns the first successful result.
    """
    if lang == "zh":
        search_funcs = [
            lambda: retrive_rerank(search_keyword),
            lambda: duckduckgo_video_search(search_keyword, lang=lang),
            lambda: retrive_serper_rerank(search_keyword, lang=lang)
        ]
    else:
        search_funcs = [
            lambda: duckduckgo_video_search(search_keyword, lang=lang),
            lambda: retrive_youtube_rerank(search_keyword,),
            lambda: retrive_serper_rerank(search_keyword,lang=lang)
        ]

    video_res = await try_search_functions(search_funcs)
    return video_res


@router.post('/api/video/search')
async def get_video_res(request: Request):
    body = await request.json()
    search_keyword = body.get('search_keyword', '')
    lang = body.get('lang', 'en')
    video_res = await search_video_logic(search_keyword, lang)
    return JSONResponse(dict(video_res=video_res))

@router.post('/api/image/search')
async def get_image_res(request: Request):
    body = await request.json()
    search_keyword = body.get('search_keyword', '')
    lang = body.get('lang', 'en')
    search_funcs = [
        lambda: duckduckgo_image_search(search_keyword, lang=lang),
        lambda: serper_image_search(search_keyword, lang=lang)
    ]
    image_res = await try_search_functions(search_funcs)
    return JSONResponse(dict(image_res=image_res))

async def try_search_functions(search_funcs):
    """尝试执行一系列搜索函数，返回第一个有结果的搜索结果"""
    video_res = []
    for search_func in search_funcs:
        video_res = await search_func()
        if isinstance(video_res, list) and len(video_res) > 0:
            break
    return video_res

@router.post('/api/task/update/execute')
async def update_task_api(request: Request):
    """
    基于用户反馈评估并可能更新任务内容
    
    接收:
    - task_data: 当前任务数据
    - suggestion: 用户的聊天消息/反馈
    - chat_id: 聊天ID (可选)
    - lang: 语言 (默认 "zh")
    - search_keyword: 搜索关键词 (可选)
    
    返回:
    - needUpdate: 布尔值，表示是否需要更新任务
    - task: 更新后的任务数据或原始任务数据
    """
    try:
        body = await request.json()
        task_data = body.get('task_data')
        suggestion = body.get('suggestion')
        search_keyword = body.get('search_keyword', task_data.get('search_keyword', ''))
        chat_id = body.get('chat_id')
        lang = body.get('lang', 'zh')
        
        logger.info(f"[任务更新] 收到请求 - 聊天ID: {chat_id}")
        
        if not task_data or not suggestion:
            raise HTTPException(status_code=400, detail="任务数据和用户消息不能为空")
        
        # 解析任务数据
        task_data_obj = json.loads(task_data) if isinstance(task_data, str) else task_data
        videos = task_data_obj.pop('videos', [])
        web_res = task_data_obj.pop('web_res', {})
        references = task_data_obj.pop('references', [])
        
        # 调用LLM评估是否需要更新任务
        result = await llm_client.update_task_based_on_feedback(task_data_obj, suggestion, lang)
        
        # 将videos和web_res添加回结果
        if 'task' in result and 'search_keyword' in result:
            if not result['search_keyword'] or result['search_keyword'] == search_keyword:
                result['task']['videos'] = videos
                result['task']['web_res'] = web_res
                result['task']['references'] = references
            else:
                video_results, web_results = await asyncio.gather(
                    search_video_logic(result['search_keyword'], lang),
                    search_web_logic(result['search_keyword'], lang)
                )
                result['task']['videos'] = video_results
                result['task']['web_res'] = web_results
                result['task']['references'] = references
            
        # 如果需要更新且提供了chat_id，更新系统提示
        if chat_id:
            try:
                task_json_str = json.dumps(result['task'])
                await update_assistant_system_prompt(task_json_str, chat_id)
                logger.info(f"[任务更新] 已更新助手系统提示 (chat_id: {chat_id})")
            except Exception as e:
                logger.error(f"调用 update_assistant_system_prompt 时出错: {e}", exc_info=True)
        
        return JSONResponse(dict(result=result))
    except Exception as e:
        logger.error(f"更新任务时出错: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/api/task/update/detect')
async def update_task_detect(request: Request):
    """
    根据用户反馈评估是否需要更新任务
    """
    try:
        body = await request.json()
        task_data = body.get('task_data')
        user_message = body.get('user_message')
        lang = body.get('lang', 'zh')
        chat_id = body.get('chat_id')
        logger.info(f"[任务更新检测] 收到请求 - 聊天ID: {chat_id}")
        
        if not task_data or not user_message:
            raise HTTPException(status_code=400, detail="任务数据和用户消息不能为空")
        
        # 解析任务数据
        task_data_obj = json.loads(task_data) if isinstance(task_data, str) else task_data
        videos = task_data_obj.pop('videos', [])
        web_res = task_data_obj.pop('web_res', {})
        
        prompt = get_prompt(
            prompt_type="task_update_detect",
            task_data=task_data_obj,
            user_message=user_message,
            lang=lang
        )
        result = await llm_client.chat_completion([{"role": "user", "content": prompt}])
        result = json_repair.loads(result.choices[0].message.content)
        return JSONResponse(dict(result=result))
    except Exception as e:
        logger.error(f"更新任务时出错: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))



@router.post('/api/documents/upload')
async def upload_document(
    file: Optional[UploadFile] = File(None),
    url: Optional[str] = Form(None),
    chat_id: str = Form(...),
    db: Session = Depends(get_db)
):
    """Upload a document or URL, process it, and store in DB and vector store"""
    try:
        if file and url:
            raise HTTPException(status_code=400, detail="Please provide either a file or a URL, not both")
        
        if not file and not url:
            raise HTTPException(status_code=400, detail="Please provide either a file or a URL")
        
        if file:
            # Handle file upload
            with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as temp_file:
                # Copy uploaded file to temporary file
                shutil.copyfileobj(file.file, temp_file)
                temp_file_path = temp_file.name
            
            # Process the document asynchronously with summaries
            result = await process_document(temp_file_path, chat_id, db)
            
            # Clean up the temporary file
            os.unlink(temp_file_path)
        else:
            # Handle URL submission
            if not url.startswith(('http://', 'https://')):
                raise HTTPException(status_code=400, detail="Invalid URL format. URL must start with http:// or https://")
            
            # Process the URL directly
            result = await process_document(url, chat_id, db)
        
        return JSONResponse(
            content={
                "success": True,
                "message": "Document processed and summarized successfully",
                "details": result
            },
            media_type="application/json",
            # 添加ensure_ascii=False确保中文字符不被转义
            # json_dumps_args={"ensure_ascii": False}
        )
    except Exception as e:
        logger.error(f"Error processing document: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error processing document: {str(e)}")

@router.get('/api/documents/search')
async def search_document_api(
    query: str,
    chat_id: str,
    top_k: int = 3,
    db: Session = Depends(get_db)
):
    """Search for documents by query"""
    try:
        results = await search_documents(query, chat_id, top_k, db)
        return JSONResponse(
            content={
                "success": True,
                "results": results
            },
            media_type="application/json",
            # 添加ensure_ascii=False确保中文字符不被转义
            # json_dumps_args={"ensure_ascii": False}
        )
    except Exception as e:
        logger.error(f"Error searching documents: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error searching documents: {str(e)}")

@router.get('/actuator/liveness-probe')
async def liveness_probe():
    """应用服务探活接口 - GET方法"""
    return Response(content="UP", media_type="text/plain")

@router.head('/actuator/liveness-probe')
async def liveness_probe_head():
    """应用服务探活接口 - HEAD方法"""
    return Response(content="UP", media_type="text/plain")

@router.post('/actuator/liveness-probe')
async def liveness_probe_post():
    """应用服务探活接口 - POST方法"""
    logger.info('get health request')
    logger.info('over health request')
    return Response(content="UP", media_type="text/plain")

