"""
豆包 AI 服务
用于生成视频大纲 - 使用百家 LLM 接口
"""
import os
import aiohttp
import json
from typing import Optional, Dict, Any

# 安全的打印函数
def safe_print(msg: str):
    """安全的打印，避免 Windows 控制台编码问题"""
    try:
        print(msg)
    except (ValueError, OSError):
        import logging
        logging.info(msg)


class DoubaoService:
    """豆包 AI 服务类（使用百家接口）"""
    
    def __init__(self):
        """初始化豆包服务"""
        # 使用转发服务
        from dotenv import load_dotenv
        load_dotenv()
        
        # 转发服务地址（默认本地，生产环境可通过环境变量配置）
        proxy_base_url = os.getenv('API_PROXY_URL', 'http://localhost:8001')
        self.base_url = f"{proxy_base_url}/open-api/llm/chat"
        
        # API Key 在转发服务中配置，这里保留用于兼容
        self.api_key = os.getenv('BAIJIA_API_KEY', 'sk-7BfuPhPxtPMjaAJn86vR2g')
        self.model = os.getenv('BAIJIA_MODEL', 'claude-4.5-sonnet')
        
        safe_print(f"🤖 Doubao Service initialized")
        safe_print(f"📍 Using Baijia LLM API: {self.base_url}")
        safe_print(f"🤖 Model: {self.model}")
    
    async def generate_outline(
        self,
        transcript: str = "",
        prompt: str = "",
        custom_prompt: str = "",
        user_id: str = "bilibili_analyzer"
    ) -> str:
        """
        使用百家 LLM 接口生成视频大纲
        
        Args:
            transcript: 视频逐字稿
            prompt: 分析提示词（兼容旧参数）
            custom_prompt: 自定义提示词（与 VolcanoService 统一）
            user_id: 用户 ID (未使用，保留兼容性)
            
        Returns:
            生成的大纲文本
        """
        # 统一参数：优先使用 custom_prompt，否则使用 prompt
        actual_prompt = custom_prompt or prompt
        
        safe_print(f"🤖 Generating outline with Baijia LLM...")
        safe_print(f"📝 Transcript length: {len(transcript)} chars")
        safe_print(f"📋 Prompt length: {len(actual_prompt)} chars")
        
        # 构建消息 - OpenAI 兼容格式
        system_message = "你是一个专业的视频内容分析助手，擅长从视频逐字稿中提取关键信息并生成结构化的内容大纲。"
        
        user_message = f"""请根据以下视频逐字稿，{actual_prompt}

视频逐字稿：
{transcript}

请按照要求生成详细的分析结果。"""
        
        messages = [
            {"role": "system", "content": system_message},
            {"role": "user", "content": user_message}
        ]
        
        try:
            # 调用百家 LLM API（非流式）
            timeout = aiohttp.ClientTimeout(total=120, connect=30, sock_read=90)
            
            safe_print(f"🔗 Connecting to: {self.base_url}")
            
            # 构建请求数据
            request_data = {
                "model": self.model,
                "messages": messages
            }
            
            # 构建请求头
            headers = {
                'User-Agent': 'Bilibili-Video-Analyzer/1.0.0',
                'Content-Type': 'application/json',
                'Connection': 'keep-alive',
                'Authorization': f'Bearer {self.api_key}'
            }
            
            # 发起请求（带重试机制）
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    async with aiohttp.ClientSession(timeout=timeout) as session:
                        async with session.post(
                            self.base_url,
                            json=request_data,
                            headers=headers
                        ) as response:
                            safe_print(f"📡 Response status: {response.status} (attempt {attempt + 1}/{max_retries})")
                            
                            if response.status != 200:
                                error_text = await response.text()
                                safe_print(f"❌ API error response: {error_text[:500]}")
                                
                                # 如果不是最后一次尝试，等待后重试
                                if attempt < max_retries - 1:
                                    import asyncio
                                    await asyncio.sleep(2 ** attempt)  # 指数退避
                                    continue
                                
                                raise Exception(f"百家 API 调用失败，状态码：{response.status}，响应：{error_text[:200]}")
                            
                            # 解析响应
                            response_text = await response.text()
                            response_json = json.loads(response_text)
                            
                            safe_print(f"✅ API response received")
                            
                            # 提取内容 - OpenAI 兼容格式
                            if 'choices' not in response_json:
                                safe_print(f"⚠️ Unexpected response format: {response_json}")
                                raise Exception(f"API响应格式错误: 缺少 choices 字段")
                            
                            try:
                                content = response_json['choices'][0]['message']['content']
                                
                                if content is None:
                                    raise Exception("API返回的content为None")
                                
                                # 清理可能的 markdown 代码块标记
                                content = content.replace('```json\n', '').replace('\n```', '').replace('```json', '').replace('```', '').strip()
                                
                                safe_print(f"✅ Outline generated ({len(content)} chars)")
                                safe_print(f"📝 Preview: {content[:200]}...")
                                
                                return content
                                
                            except (KeyError, IndexError, TypeError) as e:
                                safe_print(f"❌ Error extracting content: {e}")
                                safe_print(f"Response: {response_json}")
                                raise Exception(f"解析API响应失败: {str(e)}")
                        
                        # 成功则退出重试循环
                        break
                        
                except aiohttp.ClientError as e:
                    safe_print(f"⚠️ Network error (attempt {attempt + 1}/{max_retries}): {e}")
                    if attempt < max_retries - 1:
                        import asyncio
                        await asyncio.sleep(2 ** attempt)
                        continue
                    raise
                    
        except Exception as e:
            safe_print(f"❌ Baijia LLM API error: {e}")
            import traceback
            traceback.print_exc()
            raise Exception(f"生成大纲失败: {str(e)}")
    
    async def generate_outline_non_stream(
        self,
        transcript: str,
        prompt: str,
        user_id: str = "bilibili_analyzer"
    ) -> str:
        """
        使用豆包生成视频大纲（非流式，如果有非流式端点）
        
        Args:
            transcript: 视频逐字稿
            prompt: 分析提示词
            user_id: 用户 ID
            
        Returns:
            生成的大纲文本
        """
        # 如果有非流式端点，可以在这里实现
        # 目前回退到流式方法
        return await self.generate_outline(transcript, prompt, user_id)


# 创建全局实例
doubao_service = DoubaoService()
