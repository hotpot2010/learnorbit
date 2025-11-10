"""
视频分析服务 - 使用LLM分析视频信息
生成学习目标、适用人群、核心特点
"""
import asyncio
import os
from typing import Dict, Any, List
from app.services.volcano_service import volcano_service
from app.services.doubao_service import doubao_service

# 安全的打印函数
def safe_print(msg: str):
    """安全的打印，避免 Windows 控制台编码问题"""
    try:
        print(msg)
    except (ValueError, OSError):
        import logging
        logging.info(msg)

class VideoAnalyzerService:
    """视频分析服务"""
    
    def __init__(self):
        # 通过环境变量选择 LLM 服务（默认：volcano）
        llm_provider = os.getenv('LLM_PROVIDER', 'volcano')
        
        if llm_provider == 'baijia':
            self.llm = doubao_service
            llm_name = "百家 LLM"
        else:
            self.llm = volcano_service
            llm_name = "火山引擎"
        
        safe_print(f"🤖 VideoAnalyzerService initialized ({llm_name})")
    
    async def analyze_video(self, video_info: Dict[str, Any]) -> Dict[str, Any]:
        """
        分析单个视频，生成学习建议
        
        Args:
            video_info: 视频信息，包含 title, description, author, duration, play 等
            
        Returns:
            分析结果，包含:
            - learning_objectives: 学习目标（列表）
            - target_audience: 适用人群
            - key_features: 核心特点（列表）
            - recommendation_score: 推荐分数（0-10）
            - analysis_summary: 分析摘要
        """
        try:
            title = video_info.get('title', '')
            description = video_info.get('description', '')
            author = video_info.get('author', '')
            duration = video_info.get('duration', '')
            play = video_info.get('play', 0)
            
            safe_print(f"🤖 分析视频: {title}")
            
            # 构建分析 prompt
            prompt = self._build_analysis_prompt(title, description, author, duration, play)
            
            # 调用火山引擎 LLM 进行分析
            # 注意：generate_outline 需要 transcript 和 custom_prompt 两个参数
            # 对于视频搜索分析，我们用空字符串作为 transcript，custom_prompt 包含所有信息
            analysis_text = await self.llm.generate_outline("", prompt)
            
            # 解析LLM返回的结果
            result = self._parse_analysis_result(analysis_text, video_info)
            
            safe_print(f"  ✓ 分析完成")
            return result
            
        except Exception as e:
            safe_print(f"❌ 视频分析失败: {e}")
            import traceback
            traceback.print_exc()
            return self._get_fallback_analysis(video_info)
    
    async def analyze_videos_batch(self, videos: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        批量分析多个视频（并行）
        
        Args:
            videos: 视频列表
            
        Returns:
            分析结果列表
        """
        safe_print(f"🤖 批量分析 {len(videos)} 个视频...")
        
        # 并行调用
        tasks = [self.analyze_video(video) for video in videos]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # 处理异常情况
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                safe_print(f"⚠️ 视频 {i+1} 分析失败: {result}")
                processed_results.append(self._get_fallback_analysis(videos[i]))
            else:
                processed_results.append(result)
        
        safe_print(f"✅ 批量分析完成")
        return processed_results
    
    def _build_analysis_prompt(
        self, 
        title: str, 
        description: str, 
        author: str, 
        duration: str, 
        play: int
    ) -> str:
        """构建LLM分析 prompt - 生成简化标签"""
        
        prompt = f"""请分析以下B站视频，生成简洁的学习标签。

**视频信息：**
- 标题：{title}
- 描述：{description or '无'}
- UP主：{author}
- 时长：{duration}
- 播放量：{play:,}

**分析要求：**
- 只输出JSON格式的标签，不需要任何分析依据或解释
- 直接根据视频信息判断即可

**请提供以下分析（使用简洁的标签）：**

1. **风格** - 从以下选择一个：轻松、严谨
2. **适用人群** - 从以下选择一个：新手、进阶、高级
3. **讲师** - 从以下选择一个：名师、大V、素人
4. **视频重点** - 从以下选择一个：教学、练习、项目、理论、综合
5. **学习目标** - 从以下选择最多2个：求职、升学、兴趣、技能提升、考证
6. **推荐分数** - 0-10分

**输出格式要求：**
严格按照以下JSON格式输出：

{{
  "style": "轻松",
  "target_audience": "新手",
  "instructor": "大V",
  "video_focus": "教学",
  "learning_goals": ["求职", "技能提升"],
  "recommendation_score": 8
}}

**选项说明：**
- style: 轻松、严谨（必须选一个）
- target_audience: 新手、进阶、高级（必须选一个）
- instructor: 名师、大V、素人（必须选一个）
- video_focus: 教学、练习、项目、理论、综合（必须选一个）
- learning_goals: 求职、升学、兴趣、技能提升、考证（最多选2个）
- recommendation_score: 0-10的整数

请确保输出是有效的JSON格式。
"""
        return prompt
    
    def _parse_analysis_result(self, analysis_text: str, video_info: Dict[str, Any]) -> Dict[str, Any]:
        """解析LLM返回的分析结果"""
        import json
        import re
        
        try:
            # 尝试提取JSON
            # 移除可能的markdown代码块标记
            cleaned_text = analysis_text.strip()
            if '```json' in cleaned_text:
                match = re.search(r'```json\s*(.*?)\s*```', cleaned_text, re.DOTALL)
                if match:
                    cleaned_text = match.group(1)
            elif '```' in cleaned_text:
                match = re.search(r'```\s*(.*?)\s*```', cleaned_text, re.DOTALL)
                if match:
                    cleaned_text = match.group(1)
            
            # 提取第一个完整的JSON对象（从 { 到对应的 }）
            cleaned_text = cleaned_text.strip()
            if cleaned_text.startswith('{'):
                # 找到匹配的右花括号
                brace_count = 0
                json_end = -1
                for i, char in enumerate(cleaned_text):
                    if char == '{':
                        brace_count += 1
                    elif char == '}':
                        brace_count -= 1
                        if brace_count == 0:
                            json_end = i + 1
                            break
                
                if json_end > 0:
                    cleaned_text = cleaned_text[:json_end]
            
            # 解析JSON
            analysis = json.loads(cleaned_text)
            
            # 合并视频信息和分析结果
            result = {
                **video_info,
                'style': analysis.get('style', '轻松'),
                'target_audience': analysis.get('target_audience', '新手'),
                'instructor': analysis.get('instructor', '素人'),
                'video_focus': analysis.get('video_focus', '教学'),
                'learning_goals': analysis.get('learning_goals', []),
                'recommendation_score': analysis.get('recommendation_score', 5),
            }
            
            return result
            
        except Exception as e:
            safe_print(f"⚠️ 解析分析结果失败: {e}")
            safe_print(f"原始返回: {analysis_text[:200]}")
            return self._get_fallback_analysis(video_info)
    
    def _get_fallback_analysis(self, video_info: Dict[str, Any]) -> Dict[str, Any]:
        """获取备用分析结果（当LLM分析失败时）"""
        return {
            **video_info,
            'style': '轻松',
            'target_audience': '新手',
            'instructor': '素人',
            'video_focus': '教学',
            'learning_goals': ['技能提升'],
            'recommendation_score': 6,
        }


# 创建全局实例
video_analyzer_service = VideoAnalyzerService()


# 测试代码
if __name__ == "__main__":
    async def test():
        service = VideoAnalyzerService()
        
        # 模拟视频信息
        video = {
            'title': 'Python基础教程-从入门到实战',
            'description': '本课程从零开始讲解Python编程，包括变量、函数、面向对象等内容',
            'author': '编程入门小助手',
            'duration': '45:30',
            'play': 1500000,
            'url': 'https://www.bilibili.com/video/BV1234567890',
        }
        
        result = await service.analyze_video(video)
        
        print("\n📋 分析结果:")
        print(f"标题: {result['title']}")
        print(f"\n学习目标:")
        for obj in result['learning_objectives']:
            print(f"  • {obj}")
        print(f"\n适用人群: {result['target_audience']}")
        print(f"\n核心特点:")
        for feature in result['key_features']:
            print(f"  • {feature}")
        print(f"\n推荐分数: {result['recommendation_score']}/10")
        print(f"\n推荐语: {result['analysis_summary']}")
    
    asyncio.run(test())

