"""
Audio splitting service for parallel processing
"""
import os
import subprocess
from pathlib import Path
from typing import List, Dict, Any, Tuple
import asyncio


class AudioSplitterService:
    """Service for splitting long audio files into chunks for parallel processing"""
    
    def __init__(self, chunk_duration_seconds: int = 300):
        """
        Initialize audio splitter
        
        Args:
            chunk_duration_seconds: Duration of each chunk in seconds (default 300 = 5 minutes)
        """
        self.chunk_duration = chunk_duration_seconds
        print(f"🎵 AudioSplitterService initialized (chunk size: {chunk_duration_seconds}s)")
    
    def get_audio_duration(self, audio_path: str) -> float:
        """
        Get audio file duration in seconds using FFprobe
        
        Args:
            audio_path: Path to audio file
            
        Returns:
            Duration in seconds
        """
        try:
            cmd = [
                'ffprobe',
                '-v', 'error',
                '-show_entries', 'format=duration',
                '-of', 'default=noprint_wrappers=1:nokey=1',
                audio_path
            ]
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=True
            )
            
            duration = float(result.stdout.strip())
            print(f"📊 Audio duration: {duration:.2f}s ({duration/60:.1f} minutes)")
            return duration
            
        except Exception as e:
            print(f"⚠️ Failed to get audio duration: {str(e)}")
            raise Exception(f"Failed to get audio duration: {str(e)}")
    
    def split_audio(self, audio_path: str, output_dir: str = None) -> List[Dict[str, Any]]:
        """
        Split audio file into chunks
        
        Args:
            audio_path: Path to input audio file
            output_dir: Directory to store output chunks (same as input if not specified)
            
        Returns:
            List of chunk info dictionaries with keys:
                - chunk_path: Path to chunk file
                - chunk_index: Index of chunk (0-based)
                - start_time: Start time in seconds
                - end_time: End time in seconds
                - duration: Duration in seconds
        """
        # Get audio duration
        total_duration = self.get_audio_duration(audio_path)
        
        # Check if splitting is needed
        if total_duration <= self.chunk_duration:
            print(f"✅ Audio is short enough ({total_duration:.1f}s), no splitting needed")
            return [{
                'chunk_path': audio_path,
                'chunk_index': 0,
                'start_time': 0,
                'end_time': total_duration,
                'duration': total_duration,
                'is_original': True
            }]
        
        # Calculate number of chunks
        num_chunks = int((total_duration + self.chunk_duration - 1) / self.chunk_duration)
        print(f"✂️ Splitting audio into {num_chunks} chunks ({self.chunk_duration}s each)")
        
        # Prepare output directory
        if output_dir is None:
            output_dir = os.path.dirname(audio_path)
        os.makedirs(output_dir, exist_ok=True)
        
        # Get base filename without extension
        base_name = os.path.splitext(os.path.basename(audio_path))[0]
        ext = os.path.splitext(audio_path)[1]
        
        chunks = []
        
        for i in range(num_chunks):
            start_time = i * self.chunk_duration
            end_time = min(start_time + self.chunk_duration, total_duration)
            duration = end_time - start_time
            
            # Generate output filename
            chunk_filename = f"{base_name}_chunk{i:03d}{ext}"
            chunk_path = os.path.join(output_dir, chunk_filename)
            
            # Use FFmpeg to extract chunk
            try:
                cmd = [
                    'ffmpeg',
                    '-i', audio_path,
                    '-ss', str(start_time),
                    '-t', str(duration),
                    '-c', 'copy',  # Copy codec (no re-encoding, faster)
                    '-y',  # Overwrite output file
                    chunk_path
                ]
                
                print(f"✂️ Extracting chunk {i+1}/{num_chunks}: {start_time:.1f}s - {end_time:.1f}s")
                
                subprocess.run(
                    cmd,
                    capture_output=True,
                    check=True
                )
                
                chunks.append({
                    'chunk_path': chunk_path,
                    'chunk_index': i,
                    'start_time': start_time,
                    'end_time': end_time,
                    'duration': duration,
                    'is_original': False
                })
                
                print(f"✅ Chunk {i+1} saved: {chunk_path}")
                
            except subprocess.CalledProcessError as e:
                print(f"❌ Failed to extract chunk {i}: {str(e)}")
                raise Exception(f"Failed to split audio at chunk {i}: {str(e)}")
        
        print(f"✅ Audio split into {len(chunks)} chunks")
        return chunks
    
    def cleanup_chunks(self, chunks: List[Dict[str, Any]]):
        """
        Clean up temporary chunk files
        
        Args:
            chunks: List of chunk info dictionaries
        """
        cleaned_count = 0
        for chunk in chunks:
            # Don't delete the original file
            if chunk.get('is_original', False):
                continue
            
            chunk_path = chunk['chunk_path']
            try:
                if os.path.exists(chunk_path):
                    os.remove(chunk_path)
                    cleaned_count += 1
                    print(f"🗑️ Deleted chunk: {chunk_path}")
            except Exception as e:
                print(f"⚠️ Failed to delete chunk {chunk_path}: {str(e)}")
        
        print(f"🧹 Cleaned up {cleaned_count} chunk files")
    
    async def process_chunks_parallel(
        self,
        chunks: List[Dict[str, Any]],
        process_func,
        max_parallel: int = 3
    ) -> List[Any]:
        """
        Process chunks in parallel with a limit on concurrent tasks
        
        Args:
            chunks: List of chunk info dictionaries
            process_func: Async function to process each chunk, signature: async def(chunk_info) -> result
            max_parallel: Maximum number of parallel tasks
            
        Returns:
            List of results in the same order as chunks
        """
        semaphore = asyncio.Semaphore(max_parallel)
        
        async def process_with_semaphore(chunk_info, index):
            async with semaphore:
                start = chunk_info.get('start_time', 0)
                end = chunk_info.get('end_time', 0)
                print(f"🚀 Processing chunk {index + 1}/{len(chunks)}: {start:.1f}s - {end:.1f}s")
                result = await process_func(chunk_info)
                print(f"✅ Chunk {index + 1} processed")
                return result
        
        # Create tasks for all chunks
        tasks = [
            process_with_semaphore(chunk, i)
            for i, chunk in enumerate(chunks)
        ]
        
        # Run all tasks in parallel (but limited by semaphore)
        print(f"🚀 Starting parallel processing of {len(chunks)} chunks (max {max_parallel} concurrent)")
        results = await asyncio.gather(*tasks)
        print(f"✅ All {len(chunks)} chunks processed")
        
        return results


# Global instance
audio_splitter = AudioSplitterService()

