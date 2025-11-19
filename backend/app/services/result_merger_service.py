"""
Service for merging analysis results from multiple audio chunks
"""
from typing import List, Dict, Any


class ResultMergerService:
    """Service for merging chunked analysis results"""
    
    def merge_transcripts(
        self,
        chunk_results: List[Dict[str, Any]],
        chunks_info: List[Dict[str, Any]]
    ) -> str:
        """
        Merge transcripts from multiple chunks
        
        Args:
            chunk_results: List of ASR results from each chunk
            chunks_info: List of chunk information (start_time, end_time, etc.)
            
        Returns:
            Merged transcript string
        """
        merged_transcript = []
        
        for i, (result, chunk_info) in enumerate(zip(chunk_results, chunks_info)):
            transcript = result.get('text', '')
            start_time = chunk_info.get('start_time', 0)  # 使用 get 方法提供默认值
            
            if transcript:
                # Add chunk marker for debugging
                if i > 0:
                    merged_transcript.append(f"\n[Chunk {i+1} - {start_time:.0f}s]\n")
                merged_transcript.append(transcript)
        
        full_transcript = ''.join(merged_transcript)
        print(f"📝 Merged transcript length: {len(full_transcript)} characters")
        return full_transcript
    
    def merge_knowledge_points(
        self,
        chunk_results: List[Dict[str, Any]],
        chunks_info: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Merge knowledge points from multiple chunks with time offset adjustment
        
        Args:
            chunk_results: List of analysis results from each chunk
            chunks_info: List of chunk information (start_time, end_time, etc.)
            
        Returns:
            Merged list of knowledge points with adjusted timestamps
        """
        merged_points = []
        
        for i, (result, chunk_info) in enumerate(zip(chunk_results, chunks_info)):
            chunk_points = result.get('knowledge_points', [])
            start_offset = chunk_info.get('start_time', 0)  # 使用 get 方法提供默认值
            
            print(f"📦 Processing Chunk {i+1}: offset={start_offset:.1f}s, points={len(chunk_points)}")
            
            for point in chunk_points:
                # Adjust timestamps by adding chunk start time
                adjusted_point = point.copy()
                
                # Helper function to parse and adjust time
                def adjust_time_field(time_value, offset):
                    """Parse time string and add offset, return MM:SS format"""
                    if isinstance(time_value, str):
                        if ':' in time_value:
                            parts = time_value.split(':')
                            seconds = int(parts[0]) * 60 + int(parts[1])
                        else:
                            seconds = int(time_value)
                    else:
                        seconds = int(time_value)
                    
                    adjusted_seconds = seconds + offset
                    minutes = int(adjusted_seconds // 60)
                    secs = int(adjusted_seconds % 60)
                    return f"{minutes}:{secs:02d}"
                
                # Adjust all time-related fields
                if 'time' in adjusted_point:
                    adjusted_point['time'] = adjust_time_field(adjusted_point['time'], start_offset)
                
                if 'timestamp' in adjusted_point:
                    adjusted_point['timestamp'] = adjust_time_field(adjusted_point['timestamp'], start_offset)
                
                # 🔧 重要：调整 start_time 和 end_time（知识点的开始和结束时间）
                original_start = adjusted_point.get('start_time', '')
                original_end = adjusted_point.get('end_time', '')
                
                if 'start_time' in adjusted_point:
                    adjusted_point['start_time'] = adjust_time_field(adjusted_point['start_time'], start_offset)
                
                if 'end_time' in adjusted_point:
                    adjusted_point['end_time'] = adjust_time_field(adjusted_point['end_time'], start_offset)
                
                # Log time adjustment for first point in each chunk
                if point == chunk_points[0]:
                    print(f"  ⏱️  Example: '{original_start}' → '{adjusted_point.get('start_time', '')}' (offset +{start_offset:.0f}s)")
                
                # Add chunk index for debugging
                adjusted_point['_chunk_index'] = i
                adjusted_point['_chunk_start_time'] = start_offset
                
                merged_points.append(adjusted_point)
        
        # 🔧 按时间排序合并后的知识点
        def time_to_seconds(time_str):
            """Convert time string to seconds for sorting"""
            try:
                if isinstance(time_str, str) and ':' in time_str:
                    parts = time_str.split(':')
                    return int(parts[0]) * 60 + int(parts[1])
            except:
                pass
            return 0
        
        merged_points.sort(key=lambda p: time_to_seconds(p.get('start_time', '00:00')))
        
        print(f"💡 Merged {len(merged_points)} knowledge points from {len(chunk_results)} chunks")
        print(f"✅ Knowledge points sorted by time")
        
        # Log first and last point times for verification
        if merged_points:
            first_time = merged_points[0].get('start_time', 'N/A')
            last_time = merged_points[-1].get('start_time', 'N/A')
            print(f"  📍 Time range: {first_time} → {last_time}")
        
        return merged_points
    
    def merge_analysis_results(
        self,
        asr_results: List[Dict[str, Any]],
        analysis_results: List[Dict[str, Any]],
        chunks_info: List[Dict[str, Any]],
        original_video_info: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Merge all analysis results from chunks into final result
        
        Args:
            asr_results: List of ASR results from each chunk
            analysis_results: List of LLM analysis results from each chunk
            chunks_info: List of chunk information
            original_video_info: Original video information
            
        Returns:
            Merged analysis result in standard format
        """
        print(f"🔄 Merging results from {len(chunks_info)} chunks...")
        
        # Merge transcripts
        full_transcript = self.merge_transcripts(asr_results, chunks_info)
        
        # Merge knowledge points
        all_knowledge_points = self.merge_knowledge_points(analysis_results, chunks_info)
        
        # Calculate total duration
        total_duration = chunks_info[-1]['end_time'] if chunks_info else 0
        
        # Build merged result
        merged_result = {
            'success': True,
            'result': {
                'transcript': full_transcript,
                'knowledge_points': all_knowledge_points,
                'video_info': {
                    **original_video_info,
                    'duration': total_duration,
                    'was_chunked': True,
                    'num_chunks': len(chunks_info),
                    'chunk_duration': chunks_info[0]['duration'] if chunks_info else 0,
                }
            },
            'chunks_info': [
                {
                    'chunk_index': c.get('chunk_index', 0),
                    'start_time': c.get('start_time', 0),
                    'end_time': c.get('end_time', 0),
                    'duration': c.get('duration', 0)
                }
                for c in chunks_info
            ]
        }
        
        print(f"✅ Merge complete:")
        print(f"  - Transcript: {len(full_transcript)} chars")
        print(f"  - Knowledge points: {len(all_knowledge_points)}")
        print(f"  - Total duration: {total_duration:.1f}s")
        
        return merged_result


# Global instance
result_merger = ResultMergerService()

