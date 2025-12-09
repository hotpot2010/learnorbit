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
from .prompt_config_service import prompt_config_service

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
        
        # 🔧 使用自定义 prompt（从配置文件读取）
        custom_prompt_template = prompt_config_service.get_prompt()
        
        #将逐字稿内容插入到 prompt 中
        transcript_content = f"""时间范围: {start_time} - {end_time}

逐字稿内容:
{segment['text']}"""
        
        # 组合完整 prompt
        prompt = f"{custom_prompt_template}\n\n{transcript_content}"
        
        print(f"📝 使用自定义 Prompt (前100字符): {custom_prompt_template[:100]}...")
        
        # 调用 LLM 提取知识点
        try:
            # 打印实际调用的 prompt（用于调试）
            print(f"\n{'='*70}")
            print(f"📋 Knowledge Point Extraction Prompt (Segment {segment_index + 1}, locale={locale})")
            print(f"{'='*70}")
            print(prompt[:500])  # 只打印前500字符
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

