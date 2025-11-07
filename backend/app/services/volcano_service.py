"""
火山引擎 LLM 服务
使用 volcenginesdkarkruntime 调用火山引擎的 Doubao 模型
"""
import os
import asyncio
from typing import Optional
from volcenginesdkarkruntime import AsyncArk
from dotenv import load_dotenv

# 加载环境变量（从项目根目录和backend目录）
load_dotenv()  # 从当前目录加载
# 尝试从 backend 目录加载（如果存在）
import pathlib
backend_env = pathlib.Path(__file__).parent.parent.parent / '.env'
if backend_env.exists():
    load_dotenv(backend_env)

def safe_print(text: str):
    """安全的打印函数，处理 Windows 控制台编码问题"""
    try:
        print(text)
    except (UnicodeEncodeError, ValueError):
        # 如果打印失败，尝试编码为 ASCII 或忽略错误
        try:
            print(text.encode('ascii', 'ignore').decode('ascii'))
        except:
            pass  # 完全忽略打印错误

class VolcanoService:
    """火山引擎 LLM 服务类"""
    
    def __init__(
        self,
        access_key: Optional[str] = None,
        secret_key: Optional[str] = None,
        model: Optional[str] = None
    ):
        """
        初始化火山引擎服务
        
        Args:
            access_key: 火山引擎 Access Key（可选，默认从环境变量读取）
            secret_key: 火山引擎 Secret Key（可选，默认从环境变量读取）
            model: 模型名称（可选，默认从环境变量读取）
        """
        # 优先级：传入参数 > 环境变量
        self.access_key = access_key or os.getenv("VOLC_ACCESS_KEY")
        self.secret_key = secret_key or os.getenv("VOLC_SECRET_KEY")
        self.model = model or os.getenv("VOLC_CHAT_MODEL")
        
        # 调试信息
        safe_print(f"🔧 Volcano Engine Config:")
        safe_print(f"  - Access Key: {self.access_key[:20]}..." if self.access_key else "  - Access Key: None")
        safe_print(f"  - Model: {self.model}")
        
        self.client = None
        self.initialization_error = None
        
        # 并发连接控制（参考源文件）
        self.connection_semaphore = asyncio.Semaphore(2)
        
        self._initialize_client()
    
    def _initialize_client(self):
        """初始化 AsyncArk 客户端"""
        if not self.access_key or not self.secret_key:
            self.initialization_error = "Missing Volcano Engine API credentials (VOLC_ACCESS_KEY or VOLC_SECRET_KEY)"
            safe_print(f"❌ {self.initialization_error}")
            return
        
        if not self.model:
            self.initialization_error = "Missing Volcano Engine model info (VOLC_CHAT_MODEL)"
            safe_print(f"❌ {self.initialization_error}")
            return
        
        try:
            self.client = AsyncArk(
                ak=self.access_key,
                sk=self.secret_key,
                timeout=120,
                max_retries=2
            )
            safe_print(f"✅ 火山引擎 AsyncArk 客户端初始化成功，模型: {self.model}")
        except Exception as e:
            self.initialization_error = f"Failed to initialize AsyncArk client: {e}"
            safe_print(f"❌ {self.initialization_error}")
    
    async def generate_outline(
        self,
        transcript: str,
        custom_prompt: str,
        max_retries: int = 3
    ) -> str:
        """
        使用火山引擎生成大纲/分析内容
        
        Args:
            transcript: 视频逐字稿（可以为空字符串，如果 custom_prompt 已包含完整上下文）
            custom_prompt: 自定义提示词
            max_retries: 最大重试次数
            
        Returns:
            LLM 生成的文本内容
            
        Raises:
            Exception: 如果服务未初始化或调用失败
        """
        if self.initialization_error:
            raise Exception(f"火山引擎服务未初始化: {self.initialization_error}")
        
        if not self.client:
            raise Exception("火山引擎客户端不可用")
        
        # 使用并发控制
        async with self.connection_semaphore:
            for attempt in range(max_retries):
                try:
                    safe_print(f"🔄 [火山引擎] 调用 LLM (尝试 {attempt + 1}/{max_retries})")
                    
                    # 构建消息
                    # 如果 transcript 非空，将其作为上下文；否则只使用 custom_prompt
                    if transcript and transcript.strip():
                        user_message = f"{custom_prompt}\n\n视频内容:\n{transcript}"
                    else:
                        user_message = custom_prompt
                    
                    messages = [{"role": "user", "content": user_message}]
                    
                    # 调用火山引擎 API（非流式）
                    response = await self.client.chat.completions.create(
                        model=self.model,
                        messages=messages,
                        stream=False
                    )
                    
                    # 提取响应内容
                    if response.choices and len(response.choices) > 0:
                        message = response.choices[0].message
                        if message and hasattr(message, 'content'):
                            content = message.content
                            safe_print(f"✅ [火山引擎] LLM 调用成功 (尝试 {attempt + 1})")
                            return content
                    
                    # 如果没有内容，抛出异常以便重试
                    raise Exception("火山引擎返回空响应")
                
                except asyncio.TimeoutError:
                    safe_print(f"⚠️ [火山引擎] 请求超时 (尝试 {attempt + 1}/{max_retries})")
                    if attempt == max_retries - 1:
                        raise Exception("火山引擎请求超时，已达最大重试次数")
                    await asyncio.sleep(2 ** attempt)  # 指数退避
                
                except Exception as e:
                    safe_print(f"⚠️ [火山引擎] 调用失败 (尝试 {attempt + 1}/{max_retries}): {str(e)}")
                    if attempt == max_retries - 1:
                        raise Exception(f"火山引擎调用失败: {str(e)}")
                    await asyncio.sleep(2 ** attempt)  # 指数退避
            
            # 理论上不会到达这里
            raise Exception("火山引擎调用失败，原因未知")
    
    async def chat_completion(
        self,
        messages: list,
        stream: bool = False
    ):
        """
        通用的聊天补全方法
        
        Args:
            messages: 消息列表 [{"role": "user", "content": "..."}]
            stream: 是否使用流式响应
            
        Returns:
            响应对象
        """
        if self.initialization_error:
            raise Exception(f"火山引擎服务未初始化: {self.initialization_error}")
        
        if not self.client:
            raise Exception("火山引擎客户端不可用")
        
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                stream=stream
            )
            return response
        except Exception as e:
            safe_print(f"❌ [火山引擎] chat_completion 调用失败: {e}")
            raise


# 全局火山引擎服务实例
volcano_service = VolcanoService()

