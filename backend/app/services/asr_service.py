"""
ASR (Automatic Speech Recognition) 服务
用于视频音频识别转文字
"""
import json
import aiohttp
import asyncio
from typing import Optional
from ..models.asr import AsrCreate, AsrAsyncTaskResult, AsrAsyncTaskContentAttribute

# ASR 配置 - 使用转发服务
import os
from dotenv import load_dotenv

load_dotenv()

# 转发服务地址（默认本地，生产环境可通过环境变量配置）
PROXY_BASE_URL = os.getenv("API_PROXY_URL", "http://localhost:8001")
ASR_CREATE_URL = f"{PROXY_BASE_URL}/open-api/asr/create"
ASR_GET_URL = f"{PROXY_BASE_URL}/open-api/asr/get"

# 这些配置在转发服务中，这里保留用于兼容
ASR_APP_ID = 1728
ASR_APP_KEY = '09450965e796431cb730d04b7b784c76'


class AsrService:
    """ASR 服务类"""
    
    def __init__(self):
        """初始化 ASR 服务"""
        self.app_id = ASR_APP_ID
        self.app_key = ASR_APP_KEY
        
        # 重试配置
        self.max_retries = 3  # 最大重试次数
        self.retry_delays = [2, 5, 10]  # 重试延迟（秒），指数退避
        self.timeout = aiohttp.ClientTimeout(total=30, connect=10)  # 请求超时配置
    
    async def create_async_task(self, audio_url: str, biz_id: str = "bilibili") -> AsrAsyncTaskResult:
        """
        创建 ASR 异步任务（带重试机制）
        
        Args:
            audio_url: 音频文件 URL
            biz_id: 业务 ID
            
        Returns:
            ASR 任务结果
        """
        print(f"📝 Creating ASR task for audio: {audio_url}")
        
        asr_create = AsrCreate(
            appId=self.app_id,
            contentType=2,
            bizId=biz_id,
            content=json.dumps({'audioList': [audio_url]}, ensure_ascii=False),
            contentScenario=9,
            contentSource='bilibili',
            creator='learnorbit'
        )
        
        last_error = None
        
        for attempt in range(self.max_retries):
            try:
                print(f"🔄 ASR create task attempt {attempt + 1}/{self.max_retries}")
                
                async with aiohttp.ClientSession(timeout=self.timeout) as session:
                    async with session.post(
                        ASR_CREATE_URL,
                        json=asr_create.model_dump(),
                        headers={
                            'appId': str(self.app_id),
                            'appKey': self.app_key
                        }
                    ) as response:
                        if response.status == 200:
                            response_json = await response.json()
                            print(f"✅ ASR task created: {response_json}")
                            data = response_json.get("data", {})
                            
                            result = AsrAsyncTaskResult(
                                id=data.get('id', 0),
                                appId=data.get('appId', self.app_id),
                                contentScenario=data.get('contentScenario', 9),
                                bizId=data.get('bizId', biz_id),
                                contentType=data.get('contentType', 2),
                                contentHash=data.get('contentHash', ''),
                                originalContent=data.get('originalContent', ''),
                                content=data.get('content', ''),
                                contentAttribute=data.get('contentAttribute', ''),
                                finalContent=data.get('finalContent', ''),
                                contentSource=data.get('contentSource', 'bilibili'),
                                contentStatus=data.get('contentStatus', ''),
                                reviewStatus=data.get('reviewStatus', ''),
                                ext=data.get('ext', ''),
                                creator=data.get('creator', 'learnorbit'),
                                updater=data.get('updater', 'learnorbit'),
                                createTime=data.get('createTime', ''),
                                updateTime=data.get('updateTime', ''),
                                isDel=data.get('isDel', 0),
                                dimensionList=data.get('dimensionList', [])
                            )
                            
                            return result
                        else:
                            error_text = await response.text()
                            last_error = f"ASR 创建任务失败，状态码：{response.status}，响应：{error_text}"
                            print(f"❌ {last_error} (attempt {attempt + 1}/{self.max_retries})")
                            
                            # 如果是4xx错误（客户端错误），不重试
                            if 400 <= response.status < 500:
                                raise Exception(last_error)
                            
                            # 如果是5xx错误（服务器错误），继续重试
                            if attempt < self.max_retries - 1:
                                delay = self.retry_delays[min(attempt, len(self.retry_delays) - 1)]
                                print(f"⏳ 等待 {delay} 秒后重试...")
                                await asyncio.sleep(delay)
                                continue
                            else:
                                raise Exception(last_error)
                                
            except asyncio.TimeoutError as e:
                last_error = f"ASR 创建任务超时: {str(e)}"
                print(f"⏱️  {last_error} (attempt {attempt + 1}/{self.max_retries})")
                if attempt < self.max_retries - 1:
                    delay = self.retry_delays[min(attempt, len(self.retry_delays) - 1)]
                    print(f"⏳ 等待 {delay} 秒后重试...")
                    await asyncio.sleep(delay)
                    continue
                else:
                    raise Exception(last_error)
                    
            except aiohttp.ClientError as e:
                last_error = f"ASR 连接错误: {str(e)}"
                print(f"🔌 {last_error} (attempt {attempt + 1}/{self.max_retries})")
                if attempt < self.max_retries - 1:
                    delay = self.retry_delays[min(attempt, len(self.retry_delays) - 1)]
                    print(f"⏳ 等待 {delay} 秒后重试...")
                    await asyncio.sleep(delay)
                    continue
                else:
                    raise Exception(last_error)
                    
            except Exception as e:
                # 其他异常，如果是最后一次尝试，直接抛出
                if attempt == self.max_retries - 1:
                    raise
                # 否则等待后重试
                last_error = f"ASR 创建任务异常: {str(e)}"
                print(f"❌ {last_error} (attempt {attempt + 1}/{self.max_retries})")
                delay = self.retry_delays[min(attempt, len(self.retry_delays) - 1)]
                print(f"⏳ 等待 {delay} 秒后重试...")
                await asyncio.sleep(delay)
                continue
        
        # 如果所有重试都失败
        raise Exception(f"ASR 创建任务失败，已重试 {self.max_retries} 次。最后错误: {last_error}")
    
    async def get_task_result(self, task_id: int) -> AsrAsyncTaskResult:
        """
        获取 ASR 任务结果（带重试机制）
        
        Args:
            task_id: 任务 ID
            
        Returns:
            ASR 任务结果
        """
        print(f"🔍 Getting ASR task result: {task_id}")
        
        last_error = None
        
        for attempt in range(self.max_retries):
            try:
                async with aiohttp.ClientSession(timeout=self.timeout) as session:
                    async with session.get(
                        f"{ASR_GET_URL}?id={task_id}",
                        headers={
                            'appId': str(self.app_id),
                            'appKey': self.app_key
                        }
                    ) as response:
                        if response.status == 200:
                            response_json = await response.json()
                            
                            # 打印完整的响应以便调试
                            print(f"📊 ASR API Response: code={response_json.get('code')}, msg={response_json.get('msg')}")
                            
                            data = response_json.get("data", {})
                            
                            # 如果响应中有错误信息，打印出来
                            if response_json.get('code') != 0:
                                print(f"⚠️ ASR API returned error: code={response_json.get('code')}, msg={response_json.get('msg')}")
                            
                            # 打印数据字段的详细信息
                            if data:
                                print(f"📊 ASR Task Data: id={data.get('id')}, status={data.get('contentStatus')}, "
                                      f"contentAttribute_len={len(str(data.get('contentAttribute', '')))}, "
                                      f"finalContent_len={len(str(data.get('finalContent', '')))}, "
                                      f"ext={data.get('ext', '')}")
                            
                            print(f"✅ ASR task result retrieved")
                            
                            result = AsrAsyncTaskResult(
                                id=data.get('id', 0),
                                appId=data.get('appId', self.app_id),
                                contentScenario=data.get('contentScenario', 9),
                                bizId=data.get('bizId', 'bilibili'),
                                contentType=data.get('contentType', 2),
                                contentHash=data.get('contentHash', ''),
                                originalContent=data.get('originalContent', ''),
                                content=data.get('content', ''),
                                contentAttribute=data.get('contentAttribute', ''),
                                finalContent=data.get('finalContent', ''),
                                contentSource=data.get('contentSource', 'bilibili'),
                                contentStatus=data.get('contentStatus', ''),
                                reviewStatus=data.get('reviewStatus', ''),
                                ext=data.get('ext', ''),
                                creator=data.get('creator', 'learnorbit'),
                                updater=data.get('updater', 'learnorbit'),
                                createTime=data.get('createTime', ''),
                                updateTime=data.get('updateTime', ''),
                                isDel=data.get('isDel', 0),
                                dimensionList=data.get('dimensionList', [])
                            )
                            
                            return result
                        else:
                            error_text = await response.text()
                            last_error = f"ASR 获取结果失败，状态码：{response.status}，响应：{error_text}"
                            print(f"❌ {last_error} (attempt {attempt + 1}/{self.max_retries})")
                            
                            # 如果是4xx错误（客户端错误），不重试
                            if 400 <= response.status < 500:
                                raise Exception(last_error)
                            
                            # 如果是5xx错误（服务器错误），继续重试
                            if attempt < self.max_retries - 1:
                                delay = self.retry_delays[min(attempt, len(self.retry_delays) - 1)]
                                print(f"⏳ 等待 {delay} 秒后重试...")
                                await asyncio.sleep(delay)
                                continue
                            else:
                                raise Exception(last_error)
                                
            except asyncio.TimeoutError as e:
                last_error = f"ASR 获取结果超时: {str(e)}"
                print(f"⏱️  {last_error} (attempt {attempt + 1}/{self.max_retries})")
                if attempt < self.max_retries - 1:
                    delay = self.retry_delays[min(attempt, len(self.retry_delays) - 1)]
                    print(f"⏳ 等待 {delay} 秒后重试...")
                    await asyncio.sleep(delay)
                    continue
                else:
                    raise Exception(last_error)
                    
            except aiohttp.ClientError as e:
                last_error = f"ASR 连接错误: {str(e)}"
                print(f"🔌 {last_error} (attempt {attempt + 1}/{self.max_retries})")
                if attempt < self.max_retries - 1:
                    delay = self.retry_delays[min(attempt, len(self.retry_delays) - 1)]
                    print(f"⏳ 等待 {delay} 秒后重试...")
                    await asyncio.sleep(delay)
                    continue
                else:
                    raise Exception(last_error)
                    
            except Exception as e:
                # 其他异常，如果是最后一次尝试，直接抛出
                if attempt == self.max_retries - 1:
                    raise
                # 否则等待后重试
                last_error = f"ASR 获取结果异常: {str(e)}"
                print(f"❌ {last_error} (attempt {attempt + 1}/{self.max_retries})")
                delay = self.retry_delays[min(attempt, len(self.retry_delays) - 1)]
                print(f"⏳ 等待 {delay} 秒后重试...")
                await asyncio.sleep(delay)
                continue
        
        # 如果所有重试都失败
        raise Exception(f"ASR 获取结果失败，已重试 {self.max_retries} 次。最后错误: {last_error}")
    
    async def wait_for_completion(
        self,
        task_id: int,
        max_wait_time: int = 600,
        check_interval: int = 5
    ) -> AsrAsyncTaskResult:
        """
        等待 ASR 任务完成
        
        Args:
            task_id: 任务 ID
            max_wait_time: 最大等待时间（秒）
            check_interval: 检查间隔（秒）
            
        Returns:
            完成的 ASR 任务结果
        """
        elapsed = 0
        check_count = 0
        
        while elapsed < max_wait_time:
            check_count += 1
            print(f"⏳ Waiting for ASR task completion... ({elapsed}s elapsed, check #{check_count})")
            
            result = await self.get_task_result(task_id)
            
            # 打印当前状态以便调试
            print(f"📊 Current status: {result.contentStatus}")
            
            # 打印错误信息（如果有）
            if result.ext:
                try:
                    ext_data = json.loads(result.ext) if isinstance(result.ext, str) else result.ext
                    if isinstance(ext_data, dict) and 'error' in ext_data:
                        print(f"⚠️ ASR Error info: {ext_data.get('error')}")
                    elif isinstance(ext_data, dict) and 'message' in ext_data:
                        print(f"⚠️ ASR Message: {ext_data.get('message')}")
                    else:
                        print(f"⚠️ ASR Ext info: {result.ext}")
                except:
                    print(f"⚠️ ASR Ext (raw): {result.ext}")
            
            # 检查任务状态
            if result.contentStatus in ['SUCCESS', 'DONE']:
                print(f"✅ ASR task completed successfully")
                print(f"📄 Content attribute length: {len(result.contentAttribute) if result.contentAttribute else 0} chars")
                print(f"📄 Final content length: {len(result.finalContent) if result.finalContent else 0} chars")
                return result
            elif result.contentStatus == 'FAILED':
                error_msg = f"ASR 任务失败"
                if result.ext:
                    try:
                        ext_data = json.loads(result.ext) if isinstance(result.ext, str) else result.ext
                        if isinstance(ext_data, dict):
                            error_msg += f": {ext_data.get('error', ext_data.get('message', result.ext))}"
                        else:
                            error_msg += f": {result.ext}"
                    except:
                        error_msg += f": {result.ext}"
                raise Exception(error_msg)
            elif result.contentStatus == 'FAIL_BUT_CONTINUE':
                # FAIL_BUT_CONTINUE 状态：任务失败但可能仍有部分结果
                print(f"⚠️ ASR task failed but may have partial results")
                print(f"📄 Content attribute length: {len(result.contentAttribute) if result.contentAttribute else 0} chars")
                print(f"📄 Final content length: {len(result.finalContent) if result.finalContent else 0} chars")
                print(f"📄 Original content: {result.originalContent[:200] if result.originalContent else 'None'}...")
                print(f"📄 Content: {result.content[:200] if result.content else 'None'}...")
                
                # 检查是否有可用的结果
                if result.contentAttribute or result.finalContent:
                    print(f"✅ Found partial results, returning...")
                    return result
                else:
                    # 没有可用结果，尝试从其他字段获取错误信息
                    error_msg = f"ASR 任务失败（FAIL_BUT_CONTINUE），无可用结果"
                    
                    # 检查 originalContent 是否包含错误信息
                    if result.originalContent and 'error' in result.originalContent.lower():
                        error_msg += f"\n原始内容可能包含错误信息: {result.originalContent[:500]}"
                    
                    # 检查 content 是否包含错误信息
                    if result.content and 'error' in result.content.lower():
                        error_msg += f"\n内容可能包含错误信息: {result.content[:500]}"
                    
                    # 解析 ext 字段
                    if result.ext:
                        try:
                            ext_data = json.loads(result.ext) if isinstance(result.ext, str) else result.ext
                            if isinstance(ext_data, dict):
                                # 检查是否有其他错误相关字段
                                error_fields = ['error', 'message', 'reason', 'detail', 'description']
                                for field in error_fields:
                                    if field in ext_data:
                                        error_msg += f"\n{field}: {ext_data[field]}"
                                # 如果没有找到错误字段，至少显示 ext 内容
                                if not any(field in ext_data for field in error_fields):
                                    error_msg += f"\next 字段内容: {result.ext}"
                            else:
                                error_msg += f"\next 字段: {result.ext}"
                        except:
                            error_msg += f"\next 字段（原始）: {result.ext}"
                    
                    # 添加常见失败原因的提示
                    error_msg += "\n\n可能的原因："
                    error_msg += "\n1. 音频文件格式不支持（ASR服务可能不支持某些音频格式）"
                    error_msg += "\n2. 音频文件URL无法访问（虽然已上传到CDN，但可能URL有问题）"
                    error_msg += "\n3. 音频文件损坏或为空"
                    error_msg += "\n4. ASR服务对YouTube音频有特殊限制"
                    error_msg += "\n5. 音频文件过大或时长过长"
                    
                    raise Exception(error_msg)
            
            # 等待后继续检查
            await asyncio.sleep(check_interval)
            elapsed += check_interval
        
        raise Exception(f"ASR 任务超时（{max_wait_time}秒）")
    
    def extract_transcript(self, result: AsrAsyncTaskResult, with_timestamps: bool = True) -> str:
        """
        从 ASR 结果中提取逐字稿
        
        Args:
            result: ASR 任务结果
            with_timestamps: 是否包含时间戳（默认 True，用于知识点提取）
            
        Returns:
            逐字稿文本（带或不带时间戳）
        """
        print(f"📝 Extracting transcript from ASR result (with_timestamps={with_timestamps})...")
        
        try:
            # 解析 contentAttribute
            if result.contentAttribute:
                print(f"📄 ContentAttribute exists, parsing...")
                content_attr = json.loads(result.contentAttribute)
                
                # 检查是 dict 还是 list
                if isinstance(content_attr, dict):
                    print(f"📄 ContentAttribute is dict, keys: {list(content_attr.keys())}")
                    
                    # 优先尝试获取 communicationDetailList（带时间戳）
                    if with_timestamps and 'communicationDetailList' in content_attr:
                        details = content_attr['communicationDetailList']
                        print(f"📝 Found {len(details)} communication details")
                        transcript = "\n".join([
                            f"[{self._format_time(detail.get('begin', 0))} - {self._format_time(detail.get('end', 0))}] {detail.get('words', '')}"
                            for detail in details
                        ])
                        print(f"✅ Extracted from communicationDetailList: {len(transcript)} chars")
                        return transcript
                    
                    # 回退到 asrTaskResult（纯文本）
                    if 'asrTaskResult' in content_attr:
                        transcript = content_attr['asrTaskResult']
                        print(f"✅ Extracted from asrTaskResult: {len(transcript)} chars")
                        print(f"📝 Preview: {transcript[:200]}...")
                        return transcript
                
                elif isinstance(content_attr, list):
                    print(f"📄 ContentAttribute is list, length: {len(content_attr)}")
                    # 如果是 list，尝试从第一个元素提取
                    if len(content_attr) > 0:
                        first_item = content_attr[0]
                        print(f"📄 First item type: {type(first_item)}, keys: {list(first_item.keys()) if isinstance(first_item, dict) else 'N/A'}")
                        
                        # 如果第一个元素是 dict
                        if isinstance(first_item, dict):
                            # 优先尝试获取 communicationDetailList（带时间戳）
                            if with_timestamps and 'communicationDetailList' in first_item:
                                details = first_item['communicationDetailList']
                                if details:
                                    transcript = "\n".join([
                                        f"[{self._format_time(detail.get('begin', 0))} - {self._format_time(detail.get('end', 0))}] {detail.get('words', '')}"
                                        for detail in details
                                    ])
                                    if transcript:
                                        print(f"✅ Extracted from list[0].communicationDetailList: {len(transcript)} chars")
                                        print(f"📝 Preview: {transcript[:200]}...")
                                        return transcript
                            
                            # 回退到 asrTaskResult（纯文本）
                            if 'asrTaskResult' in first_item:
                                transcript = first_item['asrTaskResult']
                                print(f"✅ Extracted from list[0].asrTaskResult: {len(transcript)} chars")
                                print(f"📝 Preview: {transcript[:200]}...")
                                return transcript
                            
                            # 如果列表本身包含 words 字段（多个对话片段）
                            if with_timestamps:
                                transcript = "\n".join([
                                    f"[{self._format_time(item.get('begin', 0))} - {self._format_time(item.get('end', 0))}] {item.get('words', '')}"
                                    for item in content_attr if isinstance(item, dict) and 'words' in item
                                ])
                                if transcript:
                                    print(f"✅ Extracted from list items with words: {len(transcript)} chars")
                                    print(f"📝 Preview: {transcript[:200]}...")
                                    return transcript
            
            # 回退到 finalContent
            if result.finalContent:
                print(f"📄 Using finalContent: {len(result.finalContent)} chars")
                print(f"📝 Preview: {result.finalContent[:200]}...")
                return result.finalContent
            
            # 检查 content 是否是实际的文本内容（不是 audioList JSON）
            if result.content:
                # 如果 content 看起来像 audioList JSON，跳过
                if not (result.content.startswith('{') and 'audioList' in result.content):
                    print(f"📄 Using content: {len(result.content)} chars")
                    print(f"📝 Preview: {result.content[:200]}...")
                    return result.content
                else:
                    print(f"⚠️ Content is audioList JSON, not transcript")
            
            # 打印 ASR 结果的所有字段用于调试
            print(f"⚠️ Cannot extract transcript from ASR result")
            print(f"📊 ASR Result fields:")
            print(f"  - contentAttribute: {len(result.contentAttribute) if result.contentAttribute else 0} chars")
            print(f"  - finalContent: {len(result.finalContent) if result.finalContent else 0} chars")
            print(f"  - content: {len(result.content) if result.content else 0} chars")
            print(f"  - contentStatus: {result.contentStatus}")
            
            raise Exception("无法从 ASR 结果中提取逐字稿，请检查 ASR 任务状态")
            
        except Exception as e:
            print(f"⚠️ Error extracting transcript: {e}")
            import traceback
            traceback.print_exc()
            
            # 尝试返回 finalContent（如果有的话）
            if result.finalContent:
                print(f"⚠️ Returning finalContent as fallback")
                return result.finalContent
            
            raise Exception(f"无法提取 ASR 逐字稿: {str(e)}")
    
    def _format_time(self, milliseconds: int) -> str:
        """
        格式化时间（毫秒转 MM:SS）
        
        Args:
            milliseconds: 毫秒数
            
        Returns:
            格式化的时间字符串
        """
        seconds = milliseconds // 1000
        minutes = seconds // 60
        seconds = seconds % 60
        return f"{minutes:02d}:{seconds:02d}"





