"""
知识点提取服务
支持长文本分段和并行处理
"""
import asyncio
import json
import os
from typing import List, Dict, Any
from dotenv import load_dotenv
from .volcano_service import VolcanoService
from .doubao_service import DoubaoService

# 显式加载环境变量
load_dotenv()


class KnowledgePointExtractor:
    """知识点提取器"""
    
    def __init__(self):
        # 通过环境变量选择 LLM 服务（默认：volcano）
        llm_provider = os.getenv('LLM_PROVIDER', 'volcano')
        
        print(f"🔍 [DEBUG] KnowledgePointExtractor LLM_PROVIDER = '{llm_provider}'")
        
        if llm_provider == 'baijia':
            self.llm_service = DoubaoService()
        else:
            self.llm_service = VolcanoService()
        
        self.max_segment_length = 8000  # 每段最大字符数
        
    def split_transcript_by_time(
        self,
        transcript_with_timestamps: str,
        max_chars: int = 8000
    ) -> List[Dict[str, Any]]:
        """
        按时间戳分段逐字稿
        
        Args:
            transcript_with_timestamps: 带时间戳的逐字稿
            max_chars: 每段最大字符数
            
        Returns:
            分段列表，每段包含 {text, start_time, end_time}
        """
        lines = transcript_with_timestamps.strip().split('\n')
        segments = []
        current_segment = []
        current_chars = 0
        segment_start_time = None
        segment_end_time = None
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # 提取时间戳: [MM:SS - MM:SS] 文本
            if line.startswith('[') and ']' in line:
                try:
                    time_part = line[1:line.index(']')]
                    text_part = line[line.index(']')+1:].strip()
                    
                    if ' - ' in time_part:
                        start_time, end_time = time_part.split(' - ')
                        
                        # 如果当前段为空，设置起始时间
                        if segment_start_time is None:
                            segment_start_time = start_time.strip()
                        
                        segment_end_time = end_time.strip()
                        
                        # 添加到当前段
                        current_segment.append(line)
                        current_chars += len(line)
                        
                        # 如果超过最大长度，保存当前段
                        if current_chars >= max_chars:
                            if current_segment:
                                segments.append({
                                    'text': '\n'.join(current_segment),
                                    'start_time': segment_start_time,
                                    'end_time': segment_end_time,
                                    'char_count': current_chars
                                })
                                
                                current_segment = []
                                current_chars = 0
                                segment_start_time = None
                                segment_end_time = None
                                
                except Exception as e:
                    print(f"⚠️ Error parsing line: {e}, line: {line[:100]}")
                    continue
        
        # 保存最后一段
        if current_segment:
            segments.append({
                'text': '\n'.join(current_segment),
                'start_time': segment_start_time,
                'end_time': segment_end_time,
                'char_count': current_chars
            })
        
        print(f"📊 Split transcript into {len(segments)} segments")
        for i, seg in enumerate(segments):
            start_time = seg.get('start_time', 'N/A')
            end_time = seg.get('end_time', 'N/A')
            print(f"  Segment {i+1}: {seg['char_count']} chars, {start_time} - {end_time}")
        
        return segments
    
    async def extract_knowledge_points_from_segment(
        self,
        segment: Dict[str, Any],
        segment_index: int,
        locale: str = 'zh'
    ) -> List[Dict[str, Any]]:
        """
        从单个分段提取知识点
        
        Args:
            segment: 分段内容
            segment_index: 分段索引
            
        Returns:
            知识点列表
        """
        print(f"\n🔍 Processing segment {segment_index + 1}")
        start_time = segment.get('start_time', 'N/A')
        end_time = segment.get('end_time', 'N/A')
        print(f"   Time range: {start_time} - {end_time}")
        print(f"   Characters: {segment['char_count']}")
        
        # 根据语言环境构建 prompt
        if locale == 'en':
            prompt = f"""Please analyze the following educational video transcript segment and extract the 【knowledge points】.

**Knowledge Point Definition**:
A knowledge point is a complete concept, skill, or topic explained in the video, which should:
- Be a relatively independent and complete learning unit
- Have clear start and end, including concept introduction, explanation, and summary
- Not be scattered details or transitional content
- Usually correspond to a content module that can be learned and understood independently

**Extraction Requirements**:
1. Only extract clear and complete knowledge points, exclude casual talk, transitions, and repetitive content
2. Each knowledge point must include accurate start and end times
3. Knowledge point names should be concise and clear (within 10 words), summarizing the core content
4. **Important: Each knowledge point should correspond to a video segment of at least 30 seconds**, avoid splitting knowledge points too finely
5. If a concept is explained in a short time (less than 30 seconds), merge it into adjacent knowledge points or as a sub-part of a larger knowledge point
6. Arrange in chronological order
7. Output in JSON format

**Note Field Requirements**:
For each knowledge point, generate a concise study note with the following requirements:
1. Use Markdown format
2. Content should be concise and clear, within 100 words
3. Highlight core points and key concepts
4. You can use emojis to enhance readability
5. Well-organized and easy to understand
6. The note should be directly related to the transcript segment corresponding to this knowledge point

Transcript Segment (Time Range: {start_time} - {end_time}):
{segment['text']}

Please output in the following JSON format:
{{
  "knowledge_points": [
    {{
      "name": "Knowledge Point Name",
      "start_time": "MM:SS",
      "end_time": "MM:SS",
      "note": "Concise study note in Markdown format (within 100 words, highlighting core points and key concepts)"
    }}
  ]
}}

Note:
- Output only JSON, no other explanatory text
- If there are no clear knowledge points, return an empty array
- Ensure each knowledge point duration (end_time - start_time) is at least 30 seconds
- Each note should be a complete, well-formatted Markdown text"""
        else:
            prompt = f"""请分析以下教学视频的逐字稿片段，提取其中的【知识点】。

**知识点定义**：
知识点是指视频中讲解的一个完整概念、技能或主题，应该：
- 是一个相对独立、完整的学习单元
- 有明确的开始和结束，包含概念介绍、讲解和总结
- 不是零散的细节或过渡性内容
- 通常对应一个可以单独学习和理解的内容模块

**提取要求**：
1. 只提取明确、完整的知识点，不要包含闲聊、过渡语、重复内容
2. 每个知识点必须包含准确的开始和结束时间
3. 知识点名称要简洁明确（10字以内），能概括该知识点的核心内容
4. **重要：每个知识点对应的视频片段时长应不少于30秒**，避免将知识点拆分过细
5. 如果某个概念讲解时间很短（少于30秒），应将其合并到相邻的知识点中，或作为更大知识点的子部分
6. 按时间顺序排列
7. 以 JSON 格式输出

**笔记字段要求**：
为每个知识点生成一份简洁的学习笔记，要求如下：
1. 使用 Markdown 格式
2. 内容简洁清晰，100字以内
3. 突出核心要点和关键概念
4. 可以使用 emoji 增强可读性
5. 条理清晰，易于理解
6. 笔记内容应与该知识点对应的逐字稿片段直接相关

逐字稿片段（时间范围：{start_time} - {end_time}）：
{segment['text']}

请以以下 JSON 格式输出：
{{
  "knowledge_points": [
    {{
      "name": "知识点名称",
      "start_time": "MM:SS",
      "end_time": "MM:SS",
      "note": "简洁的学习笔记（Markdown格式，100字以内，突出核心要点和关键概念）"
    }}
  ]
}}

注意：
- 只输出 JSON，不要其他说明文字
- 如果没有明确的知识点，返回空数组
- 确保每个知识点的时长（end_time - start_time）至少30秒
- 每个笔记应该是完整、格式良好的 Markdown 文本"""
        
        try:
            # 打印实际调用的 prompt（用于调试）
            print(f"\n{'='*70}")
            print(f"📋 Knowledge Point Extraction Prompt (Segment {segment_index + 1}, locale={locale})")
            print(f"{'='*70}")
            print(prompt)
            print(f"{'='*70}\n")
            
            # 调用火山引擎 LLM
            response = await self.llm_service.generate_outline(
                transcript=segment['text'],
                custom_prompt=prompt
            )
            
            # 清理和解析 JSON 响应（处理可能的 markdown 代码块）
            import re
            cleaned_response = response.strip()
            
            # 移除 markdown 代码块标记
            if '```json' in cleaned_response:
                match = re.search(r'```json\s*(.*?)\s*```', cleaned_response, re.DOTALL)
                if match:
                    cleaned_response = match.group(1)
            elif '```' in cleaned_response:
                match = re.search(r'```\s*(.*?)\s*```', cleaned_response, re.DOTALL)
                if match:
                    cleaned_response = match.group(1)
            
            # 提取第一个完整的 JSON 对象（从 { 到对应的 }）
            cleaned_response = cleaned_response.strip()
            if cleaned_response.startswith('{'):
                # 找到匹配的右花括号
                brace_count = 0
                json_end = -1
                for i, char in enumerate(cleaned_response):
                    if char == '{':
                        brace_count += 1
                    elif char == '}':
                        brace_count -= 1
                        if brace_count == 0:
                            json_end = i + 1
                            break
                
                if json_end > 0:
                    cleaned_response = cleaned_response[:json_end]
            
            # 解析 JSON
            result = json.loads(cleaned_response)
            knowledge_points = result.get('knowledge_points', [])
            
            # 验证知识点格式
            valid_points = []
            for point in knowledge_points:
                if isinstance(point, dict) and 'name' in point and 'start_time' in point and 'end_time' in point:
                    # 确保 note 字段存在，如果不存在则设置为空字符串
                    if 'note' not in point:
                        point['note'] = ''
                    valid_points.append(point)
                else:
                    print(f"⚠️ Invalid knowledge point format: {point}")
            
            print(f"✅ Extracted {len(valid_points)} knowledge points from segment {segment_index + 1} (locale={locale})")
            
            return valid_points
            
        except json.JSONDecodeError as e:
            print(f"⚠️ JSON parse error in segment {segment_index + 1} (locale={locale}): {e}")
            print(f"   Response (first 500 chars): {response[:500]}")
            return []
        except Exception as e:
            print(f"❌ Error processing segment {segment_index + 1} (locale={locale}): {e}")
            import traceback
            traceback.print_exc()
            return []
    
    async def extract_knowledge_points(
        self,
        transcript_with_timestamps: str,
        locale: str = 'zh'
    ) -> List[Dict[str, Any]]:
        """
        从完整逐字稿提取知识点（支持长文本分段和并行处理）
        
        Args:
            transcript_with_timestamps: 带时间戳的逐字稿
            
        Returns:
            知识点列表
        """
        print(f"\n{'='*70}")
        print(f"📚 Starting Knowledge Point Extraction")
        print(f"{'='*70}")
        print(f"📝 Total transcript length: {len(transcript_with_timestamps)} chars")
        
        # 1. 分段
        segments = self.split_transcript_by_time(
            transcript_with_timestamps,
            max_chars=self.max_segment_length
        )
        
        if not segments:
            print("⚠️ No segments to process")
            return []
        
        # 2. 并行处理所有分段
        print(f"\n🚀 Processing {len(segments)} segments in parallel... (locale={locale})")
        
        tasks = [
            self.extract_knowledge_points_from_segment(segment, i, locale)
            for i, segment in enumerate(segments)
        ]
        
        segment_results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # 3. 汇总结果
        all_knowledge_points = []
        for i, result in enumerate(segment_results):
            if isinstance(result, Exception):
                print(f"⚠️ Segment {i+1} failed: {result}")
            elif isinstance(result, list):
                all_knowledge_points.extend(result)
        
        # 4. 去重（基于名称和时间范围）
        unique_points = self._deduplicate_knowledge_points(all_knowledge_points)
        
        print(f"\n{'='*70}")
        print(f"✅ Knowledge Point Extraction Complete")
        print(f"   Total extracted: {len(all_knowledge_points)}")
        print(f"   After deduplication: {len(unique_points)}")
        print(f"{'='*70}\n")
        
        return unique_points
    
    def _deduplicate_knowledge_points(
        self,
        knowledge_points: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        去重知识点
        
        Args:
            knowledge_points: 知识点列表
            
        Returns:
            去重后的知识点列表
        """
        seen = set()
        unique = []
        
        for point in knowledge_points:
            # 使用名称 + 开始时间作为唯一标识
            key = (point.get('name', ''), point.get('start_time', ''))
            
            if key not in seen and point.get('name'):
                seen.add(key)
                unique.append(point)
        
        # 按时间排序
        unique.sort(key=lambda p: self._time_to_seconds(p.get('start_time', '00:00')))
        
        return unique
    
    def _time_to_seconds(self, time_str: str) -> int:
        """将时间字符串转换为秒数"""
        try:
            parts = time_str.strip().split(':')
            if len(parts) == 2:
                minutes, seconds = parts
                return int(minutes) * 60 + int(seconds)
        except:
            pass
        return 0

