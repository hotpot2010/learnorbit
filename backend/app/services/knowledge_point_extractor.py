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
        segment_index: int
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
        
        # 构建优化的 prompt
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

逐字稿片段（时间范围：{start_time} - {end_time}）：
{segment['text']}

请以以下 JSON 格式输出：
{{
  "knowledge_points": [
    {{
      "name": "知识点名称",
      "start_time": "MM:SS",
      "end_time": "MM:SS"
    }}
  ]
}}

注意：
- 只输出 JSON，不要其他说明文字
- 如果没有明确的知识点，返回空数组
- 确保每个知识点的时长（end_time - start_time）至少30秒"""
        
        try:
            # 调用火山引擎 LLM
            response = await self.llm_service.generate_outline(
                transcript=segment['text'],
                custom_prompt=prompt
            )
            
            # 解析 JSON 响应
            result = json.loads(response)
            knowledge_points = result.get('knowledge_points', [])
            
            print(f"✅ Extracted {len(knowledge_points)} knowledge points from segment {segment_index + 1}")
            
            return knowledge_points
            
        except json.JSONDecodeError as e:
            print(f"⚠️ JSON parse error in segment {segment_index + 1}: {e}")
            print(f"   Response: {response[:200]}")
            return []
        except Exception as e:
            print(f"❌ Error processing segment {segment_index + 1}: {e}")
            return []
    
    async def extract_knowledge_points(
        self,
        transcript_with_timestamps: str
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
        print(f"\n🚀 Processing {len(segments)} segments in parallel...")
        
        tasks = [
            self.extract_knowledge_points_from_segment(segment, i)
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

