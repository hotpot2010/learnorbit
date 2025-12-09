"""
Prompt 配置管理服务
"""
import os
import json
from typing import Optional


class PromptConfigService:
    """管理知识点生成的 Prompt 配置"""
    
    def __init__(self):
        # 配置文件路径
        self.config_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'config')
        self.config_file = os.path.join(self.config_dir, 'prompt_config.json')
        
        # 确保配置目录存在
        os.makedirs(self.config_dir, exist_ok=True)
        
        # 默认 prompt（与之前实际使用的一致）
        self.default_prompt = """请分析以下教学视频的逐字稿片段，提取其中的【知识点】。

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

请以以下 JSON 格式输出：
{
  "knowledge_points": [
    {
      "name": "知识点名称",
      "start_time": "MM:SS",
      "end_time": "MM:SS",
      "note": "简洁的学习笔记（Markdown格式，100字以内，突出核心要点和关键概念）"
    }
  ]
}

注意：
- 只输出 JSON，不要其他说明文字
- 如果没有明确的知识点，返回空数组
- 确保每个知识点的时长（end_time - start_time）至少30秒
- 每个笔记应该是完整、格式良好的 Markdown 文本"""
    
    def get_prompt(self) -> str:
        """
        获取当前的 prompt 配置
        
        Returns:
            prompt 文本
        """
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                    return config.get('prompt', self.default_prompt)
        except Exception as e:
            print(f"⚠️ 读取 prompt 配置失败: {e}")
        
        return self.default_prompt
    
    def save_prompt(self, prompt: str) -> bool:
        """
        保存 prompt 配置
        
        Args:
            prompt: 新的 prompt 文本
            
        Returns:
            是否成功
        """
        try:
            config = {
                'prompt': prompt,
                'updated_at': self._get_current_time()
            }
            
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(config, f, ensure_ascii=False, indent=2)
            
            print(f"✅ Prompt 配置已保存: {self.config_file}")
            return True
        except Exception as e:
            print(f"❌ 保存 prompt 配置失败: {e}")
            return False
    
    def reset_to_default(self) -> bool:
        """
        重置为默认 prompt
        
        Returns:
            是否成功
        """
        return self.save_prompt(self.default_prompt)
    
    def _get_current_time(self) -> str:
        """获取当前时间字符串"""
        from datetime import datetime
        return datetime.now().isoformat()


# 全局单例
prompt_config_service = PromptConfigService()

