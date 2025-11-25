"""
代理IP服务
从指定接口获取代理IP列表，并提供代理IP轮换功能
"""
import os
import aiohttp
import asyncio
import time
from typing import List, Dict, Optional, Tuple, Any
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

# 安全的打印函数
def safe_print(msg: str):
    """安全的打印，避免 Windows 控制台编码问题"""
    try:
        print(msg)
    except (ValueError, OSError):
        import logging
        logging.info(msg)


class ProxyService:
    """代理IP服务类"""
    
    def __init__(self):
        """初始化代理服务"""
        # 代理IP获取接口配置
        self.proxy_api_url = os.getenv(
            'PROXY_API_URL',
            'http://dl.pcdaili.com:800/user/webapi/getip.php'
        )
        self.proxy_cdk = os.getenv(
            'PROXY_CDK',
            'B0F4D14883EE13A1F4F331FF92894555'
        )
        self.proxy_num = int(os.getenv('PROXY_NUM', '40'))  # 获取的代理数量
        self.proxy_filter = int(os.getenv('PROXY_FILTER', '1'))  # 过滤参数
        self.proxy_lasthour = int(os.getenv('PROXY_LASTHOUR', '2'))  # 最近N小时
        self.proxy_area = os.getenv('PROXY_AREA', '')  # 地区过滤
        
        # 代理IP列表
        self.proxies: List[Dict[str, Any]] = []
        self.current_proxy_index = 0
        self.proxy_last_update = None
        self.proxy_update_interval = 300  # 5分钟更新一次代理列表
        
        # 失败的代理IP记录（IP:PORT -> 失败时间）
        self.failed_proxies: Dict[str, datetime] = {}
        self.failed_proxy_retry_interval = 600  # 10分钟后重试失败的代理
        
        safe_print(f"🔧 ProxyService initialized")
        safe_print(f"📍 Proxy API: {self.proxy_api_url}")
        safe_print(f"🔑 CDK: {self.proxy_cdk[:10]}...")
    
    def _build_proxy_api_url(self) -> str:
        """构建代理IP获取接口URL"""
        params = {
            'cdk': self.proxy_cdk,
            'num': self.proxy_num,
            'filter': self.proxy_filter,
            'lasthour': self.proxy_lasthour,
        }
        if self.proxy_area:
            params['area'] = self.proxy_area
        
        query_string = '&'.join([f"{k}={v}" for k, v in params.items()])
        return f"{self.proxy_api_url}?{query_string}"
    
    async def fetch_proxies(self) -> List[Dict[str, Any]]:
        """
        从API获取代理IP列表
        
        Returns:
            代理IP列表，格式: [{'ip': '1.2.3.4', 'port': '8080'}, ...]
        """
        try:
            url = self._build_proxy_api_url()
            safe_print(f"📡 Fetching proxies from: {url}")
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=30)) as response:
                    if response.status != 200:
                        safe_print(f"❌ Failed to fetch proxies: HTTP {response.status}")
                        return []
                    
                    text = await response.text()
                    safe_print(f"📥 Proxy API response: {text[:200]}...")
                    
                    # 解析响应（假设返回格式为 IP:PORT 每行一个）
                    proxies = []
                    lines = text.strip().split('\n')
                    
                    for line in lines:
                        line = line.strip()
                        if not line or line.startswith('-1') or '错误' in line or '失败' in line:
                            continue
                        
                        # 解析 IP:PORT 格式
                        if ':' in line:
                            parts = line.split(':')
                            if len(parts) >= 2:
                                ip = parts[0].strip()
                                port = parts[1].strip()
                                # 移除可能的额外信息（如协议、用户名等）
                                if '@' in ip:
                                    ip = ip.split('@')[-1]
                                if '/' in port:
                                    port = port.split('/')[0]
                                
                                if ip and port:
                                    proxies.append({
                                        'ip': ip,
                                        'port': port,
                                        'proxy_url': f"http://{ip}:{port}",
                                        'socks5_url': f"socks5://{ip}:{port}",
                                    })
                    
                    safe_print(f"✅ Fetched {len(proxies)} proxies")
                    return proxies
                    
        except Exception as e:
            safe_print(f"❌ Error fetching proxies: {e}")
            import traceback
            traceback.print_exc()
            return []
    
    async def get_proxies(self, force_refresh: bool = False) -> List[Dict[str, Any]]:
        """
        获取代理IP列表（带缓存）
        
        Args:
            force_refresh: 是否强制刷新
            
        Returns:
            代理IP列表
        """
        now = datetime.now()
        
        # 检查是否需要更新
        if force_refresh or not self.proxies or not self.proxy_last_update:
            proxies = await self.fetch_proxies()
            if proxies:
                self.proxies = proxies
                self.proxy_last_update = now
                self.current_proxy_index = 0
                safe_print(f"✅ Updated proxy list: {len(proxies)} proxies")
        elif self.proxy_last_update:
            elapsed = (now - self.proxy_last_update).total_seconds()
            if elapsed > self.proxy_update_interval:
                safe_print(f"🔄 Proxy list expired ({elapsed:.0f}s), refreshing...")
                proxies = await self.fetch_proxies()
                if proxies:
                    self.proxies = proxies
                    self.proxy_last_update = now
                    self.current_proxy_index = 0
        
        # 过滤掉失败的代理（如果已经过了重试时间，可以重新使用）
        available_proxies = []
        for proxy in self.proxies:
            proxy_key = f"{proxy['ip']}:{proxy['port']}"
            if proxy_key in self.failed_proxies:
                failed_time = self.failed_proxies[proxy_key]
                elapsed = (now - failed_time).total_seconds()
                if elapsed < self.failed_proxy_retry_interval:
                    continue  # 跳过还在冷却期的失败代理
                else:
                    # 移除过期的失败记录
                    del self.failed_proxies[proxy_key]
            available_proxies.append(proxy)
        
        return available_proxies
    
    async def get_next_proxy(self, mark_failed: bool = False) -> Optional[str]:
        """
        获取下一个可用的代理IP（轮换）
        
        Args:
            mark_failed: 是否标记当前代理为失败
            
        Returns:
            代理URL（如 http://1.2.3.4:8080），如果没有可用代理则返回None
        """
        # 如果标记为失败，记录当前代理
        if mark_failed and self.proxies:
            current_proxy = self.proxies[self.current_proxy_index]
            proxy_key = f"{current_proxy['ip']}:{current_proxy['port']}"
            self.failed_proxies[proxy_key] = datetime.now()
            safe_print(f"❌ Marked proxy as failed: {proxy_key}")
        
        # 获取可用代理列表
        available_proxies = await self.get_proxies()
        
        if not available_proxies:
            safe_print("⚠️  No available proxies")
            return None
        
        # 轮换到下一个代理
        self.current_proxy_index = (self.current_proxy_index + 1) % len(available_proxies)
        proxy = available_proxies[self.current_proxy_index]
        
        safe_print(f"🔄 Using proxy {self.current_proxy_index + 1}/{len(available_proxies)}: {proxy['ip']}:{proxy['port']}")
        return proxy['proxy_url']
    
    def get_current_proxy(self) -> Optional[str]:
        """
        获取当前代理（不轮换）
        
        Returns:
            当前代理URL，如果没有则返回None
        """
        if not self.proxies:
            return None
        
        proxy = self.proxies[self.current_proxy_index]
        return proxy['proxy_url']
    
    def mark_proxy_failed(self, proxy_url: Optional[str]):
        """
        标记代理为失败
        
        Args:
            proxy_url: 代理URL（如 http://1.2.3.4:8080）
        """
        if not proxy_url:
            return
        
        # 从URL中提取IP和端口
        try:
            # 移除协议前缀
            if '://' in proxy_url:
                proxy_url = proxy_url.split('://', 1)[1]
            # 提取IP:PORT
            if ':' in proxy_url:
                ip, port = proxy_url.split(':', 1)
                proxy_key = f"{ip}:{port}"
                self.failed_proxies[proxy_key] = datetime.now()
                safe_print(f"❌ Marked proxy as failed: {proxy_key}")
        except Exception as e:
            safe_print(f"⚠️  Error marking proxy as failed: {e}")


# 创建全局实例
proxy_service = ProxyService()

