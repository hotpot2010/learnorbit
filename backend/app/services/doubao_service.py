"""
豆包 AI 服务
用于生成视频大纲 - 使用百家 LLM 接口
"""
import os
import aiohttp
import json
from typing import Optional, Dict, Any


class DoubaoService:
    """豆包 AI 服务类（使用百家接口）"""
    
    def __init__(self):
        """初始化豆包服务"""
        # 使用百家 LLM 接口
        self.api_key = os.getenv('BAIJIA_API_KEY', 'sk-7BfuPhPxtPMjaAJn86vR2g')
        self.base_url = os.getenv('BAIJIA_BASE_URL', 'https://llm.baijia.com/v1/chat/completions')
        self.model = os.getenv('BAIJIA_MODEL', 'claude-4.5-sonnet')
        
        print(f"🤖 Doubao Service initialized")
        print(f"📍 Using Baijia LLM API: {self.base_url}")
        print(f"🤖 Model: {self.model}")
    
    async def generate_outline(
        self,
        transcript: str,
        prompt: str,
        user_id: str = "bilibili_analyzer"
    ) -> str:
        """
        使用百家 LLM 接口生成视频大纲
        
        Args:
            transcript: 视频逐字稿
            prompt: 分析提示词
            user_id: 用户 ID (未使用，保留兼容性)
            
        Returns:
            生成的大纲文本
        """
        print(f"🤖 Generating outline with Baijia LLM...")
        print(f"📝 Transcript length: {len(transcript)} chars")
        print(f"📋 Prompt length: {len(prompt)} chars")
        
        # 构建消息 - OpenAI 兼容格式
        system_message = "你是一个专业的视频内容分析助手，擅长从视频逐字稿中提取关键信息并生成结构化的内容大纲。"
        
        user_message = f"""请根据以下视频逐字稿，{prompt}

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
            
            print(f"🔗 Connecting to: {self.base_url}")
            
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
                            print(f"📡 Response status: {response.status} (attempt {attempt + 1}/{max_retries})")
                            
                            if response.status != 200:
                                error_text = await response.text()
                                print(f"❌ API error response: {error_text[:500]}")
                                
                                # 如果不是最后一次尝试，等待后重试
                                if attempt < max_retries - 1:
                                    import asyncio
                                    await asyncio.sleep(2 ** attempt)  # 指数退避
                                    continue
                                
                                raise Exception(f"百家 API 调用失败，状态码：{response.status}，响应：{error_text[:200]}")
                            
                            # 解析响应
                            response_text = await response.text()
                            response_json = json.loads(response_text)
                            
                            print(f"✅ API response received")
                            
                            # 提取内容 - OpenAI 兼容格式
                            if 'choices' not in response_json:
                                print(f"⚠️ Unexpected response format: {response_json}")
                                raise Exception(f"API响应格式错误: 缺少 choices 字段")
                            
                            try:
                                content = response_json['choices'][0]['message']['content']
                                
                                if content is None:
                                    raise Exception("API返回的content为None")
                                
                                # 清理可能的 markdown 代码块标记
                                content = content.replace('```json\n', '').replace('\n```', '').replace('```json', '').replace('```', '').strip()
                                
                                print(f"✅ Outline generated ({len(content)} chars)")
                                print(f"📝 Preview: {content[:200]}...")
                                
                                return content
                                
                            except (KeyError, IndexError, TypeError) as e:
                                print(f"❌ Error extracting content: {e}")
                                print(f"Response: {response_json}")
                                raise Exception(f"解析API响应失败: {str(e)}")
                        
                        # 成功则退出重试循环
                        break
                        
                except aiohttp.ClientError as e:
                    print(f"⚠️ Network error (attempt {attempt + 1}/{max_retries}): {e}")
                    if attempt < max_retries - 1:
                        import asyncio
                        await asyncio.sleep(2 ** attempt)
                        continue
                    raise
                    
        except Exception as e:
            print(f"❌ Baijia LLM API error: {e}")
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

