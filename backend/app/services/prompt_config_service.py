"""
Prompt 配置管理服务
"""
import os
import json
from typing import Optional, Dict


class PromptConfigService:
    """管理知识点和练习生成的 Prompt 配置"""
    
    def __init__(self):
        # 配置文件路径
        self.config_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'config')
        self.config_file = os.path.join(self.config_dir, 'prompt_config.json')
        self.exercise_config_file = os.path.join(self.config_dir, 'exercise_prompt_config.json')
        
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
    
    # ==================== 练习提示词管理 ====================
    
    def _get_default_exercise_prompts(self) -> Dict[str, Dict[str, str]]:
        """获取默认的练习提示词"""
        return {
            'math': {
                'zh': """你是一位资深的数学教师，需要根据以下视频知识点生成一道练习题。

知识点名称：{knowledge_point_name}
知识点内容：{transcript_segment}

请生成一道练习题，要求：
1. 题型：随机选择【选择题】或【填空题】其中之一
2. 难度：适配中考/高考水平，有一定区分度
3. 题目要结合视频中讲解的具体知识点
4. 题目要有实际应用价值，不要过于简单
5. **数学公式必须使用 LaTeX 格式，用 $ 包裹**
6. 提供详细的解析和解题步骤

**LaTeX 公式规范（重要！）**：
- ✅ 正确格式：在 JSON 中，所有反斜杠必须转义为双反斜杠 \\\\
- ✅ 行内公式：$\\\\frac{{1}}{{2}}$、$\\\\sin x$、$\\\\pi$
- ✅ 块级公式：$$\\\\int_0^1 x dx$$
- ✅ 常用符号：$\\\\alpha$、$\\\\beta$、$\\\\sum$、$\\\\lim_{{x \\\\to 0}}$
- ✅ 分数：$\\\\frac{{分子}}{{分母}}$
- ✅ 根号：$\\\\sqrt{{x}}$、$\\\\sqrt[3]{{x}}$
- ✅ 上下标：$x^2$、$x_i$、$x_{{ij}}$（多字符下标需要大括号）
- ❌ 错误格式：\\frac{{1}}{{2}}（单反斜杠）、\\(...\\)、\\[...\\]

请以 JSON 格式返回，格式如下：

**选择题格式：**
{{
  "type": "multiple_choice",
  "title": "知识点练习：[知识点名称]",
  "description": "根据视频内容，完成以下练习题",
  "difficulty": "intermediate",
  "question": "题目内容（公式示例：已知函数 $f(x) = \\\\frac{{x^2 + 1}}{{x - 1}}$，求 $\\\\lim_{{x \\\\to 1}} f(x)$ 的值）",
  "choices": [
    {{"label": "A", "content": "$\\\\frac{{1}}{{2}}$"}},
    {{"label": "B", "content": "$1$"}},
    {{"label": "C", "content": "$2$"}},
    {{"label": "D", "content": "不存在"}}
  ],
  "answer_type": "single",
  "solution": "D",
  "hints": [
    "提示1：首先检查函数在 $x = 1$ 处是否连续",
    "提示2：注意分母为零的情况，需要使用极限的定义",
    "提示3：可以分别计算左极限 $\\\\lim_{{x \\\\to 1^-}}$ 和右极限 $\\\\lim_{{x \\\\to 1^+}}$"
  ]
}}

**填空题格式：**
{{
  "type": "fill_blank",
  "title": "知识点练习：[知识点名称]",
  "description": "根据视频内容，完成以下练习题",
  "difficulty": "intermediate",
  "question": "计算极限 $\\\\lim_{{x \\\\to 0}} \\\\frac{{\\\\sin x - x}}{{x^3}}$ 的值为 ___ 。",
  "blanks": 1,
  "answer_type": "text",
  "solution": "$-\\\\frac{{1}}{{6}}$",
  "hints": [
    "提示1：使用泰勒级数展开 $\\\\sin x = x - \\\\frac{{x^3}}{{6}} + O(x^5)$",
    "提示2：代入后化简分子",
    "提示3：约分并取极限"
  ]
}}

**关键要点**：
1. JSON 中的反斜杠必须双写：\\\\ 而不是 \\
2. 公式必须用 $ 包裹，否则无法渲染
3. 多字符的上下标要用大括号：$x_{{ij}}$ 而不是 $x_ij$
4. 所有 choices、solution、hints 中的公式都要遵循相同规范

只返回 JSON，不要其他说明文字。"""
            },
            'programming': {
                'zh': """你是一位专业的编程教学专家。请根据视频内容为知识点生成一道编程练习题。

知识点：{knowledge_point_name}
视频标题：{video_title}

请根据知识点难度选择合适的题型并生成练习题。必须严格按照以下JSON格式返回：

{{
  "type": "题型（fill_blank/guided_steps/code_choice/complete之一）",
  "title": "练习题标题",
  "description": "题目描述（50字以内）",
  "difficulty": "难度（beginner/intermediate/advanced）",
  "language": "编程语言（python/javascript等）",
  "starter_code": "初始代码模板",
  "solution": "参考答案",
  "hints": ["提示1", "提示2"]
}}

**题型选择规则**：
1. fill_blank（填空）：适合简单语法、单一概念（如变量赋值、基本运算）
2. guided_steps（分步引导）：适合需要实现完整函数的任务（如编写函数、实现算法）
3. code_choice（代码选择）：适合比较不同实现、理解逻辑
4. complete（完整编程）：适合综合应用、高级任务

**题型特定字段**：
- fill_blank: starter_code中用 "___" 标记填空位置，在hints中说明每个空填什么
- guided_steps: 在hints中列出3-5个步骤，每步说明要完成什么
- code_choice: 在hints中提供3-4个代码选项，标注正确答案
- complete: 提供基本框架，hints给出思路提示

**要求**：
1. 题目必须与视频内容和知识点直接相关
2. 难度适中，适合初学者
3. 代码简洁，不超过20行
4. 提示清晰，帮助理解不直接给答案
5. 只输出JSON，不要其他内容
6. 确保JSON格式正确，可以被解析"""
            }
        }
    
    def get_exercise_prompt(self, subject: str = 'math', locale: str = 'zh') -> str:
        """
        获取练习生成提示词
        
        Args:
            subject: 学科类型 (math/programming)
            locale: 语言环境 (仅支持 zh)
            
        Returns:
            提示词文本（模板字符串，需要格式化）
        """
        try:
            if os.path.exists(self.exercise_config_file):
                with open(self.exercise_config_file, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                    prompts = config.get('prompts', {})
                    subject_prompts = prompts.get(subject, {})
                    prompt = subject_prompts.get(locale)
                    if prompt:
                        return prompt
        except Exception as e:
            print(f"⚠️ 读取练习提示词配置失败: {e}")
        
        # 返回默认提示词
        default_prompts = self._get_default_exercise_prompts()
        return default_prompts.get(subject, {}).get(locale, '')
    
    def save_exercise_prompt(self, subject: str, locale: str, prompt: str) -> bool:
        """
        保存练习提示词配置
        
        Args:
            subject: 学科类型 (math/programming)
            locale: 语言环境 (仅支持 zh)
            prompt: 新的提示词文本
            
        Returns:
            是否成功
        """
        try:
            # 读取现有配置
            config = {}
            if os.path.exists(self.exercise_config_file):
                with open(self.exercise_config_file, 'r', encoding='utf-8') as f:
                    config = json.load(f)
            
            # 更新配置
            if 'prompts' not in config:
                config['prompts'] = {}
            if subject not in config['prompts']:
                config['prompts'][subject] = {}
            
            config['prompts'][subject][locale] = prompt
            config['updated_at'] = self._get_current_time()
            
            # 保存配置
            with open(self.exercise_config_file, 'w', encoding='utf-8') as f:
                json.dump(config, f, ensure_ascii=False, indent=2)
            
            print(f"✅ 练习提示词配置已保存: {subject}/{locale}")
            return True
        except Exception as e:
            print(f"❌ 保存练习提示词配置失败: {e}")
            return False
    
    def reset_exercise_prompt(self, subject: str, locale: str) -> bool:
        """
        重置练习提示词为默认值
        
        Args:
            subject: 学科类型 (math/programming)
            locale: 语言环境 (仅支持 zh)
            
        Returns:
            是否成功
        """
        default_prompts = self._get_default_exercise_prompts()
        default_prompt = default_prompts.get(subject, {}).get(locale, '')
        if default_prompt:
            return self.save_exercise_prompt(subject, locale, default_prompt)
        return False
    
    def get_all_exercise_prompts(self) -> Dict[str, Dict[str, str]]:
        """
        获取所有练习提示词配置
        
        Returns:
            所有提示词配置字典
        """
        try:
            if os.path.exists(self.exercise_config_file):
                with open(self.exercise_config_file, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                    prompts = config.get('prompts', {})
                    # 合并默认值（如果配置中没有）
                    default_prompts = self._get_default_exercise_prompts()
                    for subject in default_prompts:
                        if subject not in prompts:
                            prompts[subject] = {}
                        for locale in default_prompts[subject]:
                            if locale not in prompts[subject]:
                                prompts[subject][locale] = default_prompts[subject][locale]
                    return prompts
        except Exception as e:
            print(f"⚠️ 读取所有练习提示词配置失败: {e}")
        
        return self._get_default_exercise_prompts()


# 全局单例
prompt_config_service = PromptConfigService()

