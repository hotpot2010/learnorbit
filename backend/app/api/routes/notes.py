"""
笔记生成相关的 API 路由
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import sys
import os

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.services.volcano_service import VolcanoService
from app.services.doubao_service import DoubaoService
from dotenv import load_dotenv

# 显式加载环境变量
load_dotenv()

router = APIRouter()

# 通过环境变量选择 LLM 服务（默认：volcano）
llm_provider = os.getenv('LLM_PROVIDER', 'volcano')
print(f"🔍 [DEBUG] Notes API LLM_PROVIDER = '{llm_provider}'")

if llm_provider == 'baijia':
    llm_service = DoubaoService()
else:
    llm_service = VolcanoService()


class NoteGenerationRequest(BaseModel):
    """笔记生成请求模型"""
    knowledge_point_name: str
    transcript_segment: str
    video_title: Optional[str] = None
    video_url: Optional[str] = None  # 用于缓存键
    locale: Optional[str] = 'zh'  # 语言环境，默认为中文


class NoteGenerationResponse(BaseModel):
    """笔记生成响应模型"""
    success: bool
    note: Optional[str] = None
    error: Optional[str] = None
    from_cache: bool = False  # 是否来自缓存


class QuestionAnswerRequest(BaseModel):
    """问答请求模型"""
    question: str
    knowledge_point_name: str
    transcript_segment: str
    video_title: Optional[str] = None
    video_url: Optional[str] = None
    locale: Optional[str] = 'zh'  # 语言环境，默认为中文
    image_urls: Optional[list[str]] = None  # 附加的截图URLs


class QuestionAnswerResponse(BaseModel):
    """问答响应模型"""
    success: bool
    answer: Optional[str] = None
    error: Optional[str] = None


class ExerciseGenerationRequest(BaseModel):
    """练习生成请求模型"""
    knowledge_point_name: str
    transcript_segment: str
    video_title: Optional[str] = None
    video_url: Optional[str] = None
    locale: Optional[str] = 'zh'  # 语言环境，默认为中文
    subject: Optional[str] = 'math'  # 学科类型，默认为数学（math/programming）
    custom_prompt: Optional[str] = None  # 自定义 prompt（优先级最高）


class ExerciseGenerationResponse(BaseModel):
    """练习生成响应模型"""
    success: bool
    exercise: Optional[dict] = None
    error: Optional[str] = None
    from_cache: bool = False


@router.post("/generate", response_model=NoteGenerationResponse)
async def generate_note(request: NoteGenerationRequest):
    """
    为特定知识点生成笔记（支持缓存）
    
    Args:
        request: 包含知识点名称和对应逐字稿片段的请求
        
    Returns:
        生成的 Markdown 格式笔记
    """
    try:
        print(f"📝 Generating note for knowledge point: {request.knowledge_point_name}")
        print(f"📄 Transcript segment length: {len(request.transcript_segment)} chars")
        
        # 根据语言环境构建 prompt
        locale = request.locale or 'zh'
        if locale == 'en':
            prompt = f"""Please generate a concise study note for the knowledge point "{request.knowledge_point_name}".

Requirements:
1. Use Markdown format
2. Content should be concise and clear, within 100 words
3. Highlight core points and key concepts
4. You can use emojis to enhance readability
5. Well-organized and easy to understand

Please output the note content directly without any additional explanations."""
        else:
            prompt = f"""请为知识点「{request.knowledge_point_name}」生成一份简洁的学习笔记。

要求：
1. 使用 Markdown 格式
2. 内容简洁清晰，100字以内
3. 突出核心要点和关键概念
4. 可以使用 emoji 增强可读性
5. 条理清晰，易于理解

请直接输出笔记内容，不要包含任何额外说明。"""

        # 打印实际使用的prompt（用于调试）
        print(f"📋 Note Generation Prompt (locale={locale}):")
        print("=" * 70)
        print(prompt)
        print("=" * 70)
        print(f"📄 Transcript segment (first 200 chars): {request.transcript_segment[:200]}...")

        # 调用 LLM 生成笔记
        note_content = await llm_service.generate_outline(
            transcript=request.transcript_segment,
            custom_prompt=prompt
        )
        
        print(f"✅ Note generated successfully")
        print(f"📝 Note preview: {note_content[:100]}...")
        
        return NoteGenerationResponse(
            success=True,
            note=note_content,
            from_cache=False
        )
        
    except Exception as e:
        print(f"❌ Error generating note: {e}")
        import traceback
        traceback.print_exc()
        
        return NoteGenerationResponse(
            success=False,
            error=str(e),
            from_cache=False
        )


@router.post("/answer-question", response_model=QuestionAnswerResponse)
async def answer_question(request: QuestionAnswerRequest):
    """
    回答用户关于特定知识点的问题（支持图片）
    
    Args:
        request: 包含问题、知识点名称和上下文逐字稿的请求
        
    Returns:
        AI生成的回答
    """
    try:
        print(f"🤔 Answering question: {request.question}")
        print(f"📚 Knowledge point: {request.knowledge_point_name}")
        print(f"📄 Context length: {len(request.transcript_segment)} chars")
        
        if request.image_urls:
            print(f"🖼️ Images attached: {len(request.image_urls)}")
        
        # 根据语言环境构建 prompt
        locale = request.locale or 'zh'
        if locale == 'en':
            prompt_text = f"""Please answer the student's question concisely based on the video context.

Knowledge Point: {request.knowledge_point_name}
Question: {request.question}
Video Context: {request.transcript_segment}

Requirements:
1. Answer should be 30-100 words
2. Give the answer directly without explanatory prefixes
3. Language should be concise and clear
4. If images are provided, analyze them and incorporate the information into your answer
5. **For mathematical formulas, MUST use LaTeX format with $ delimiters**:
   - Inline formula: wrap with single $, e.g., $\\frac{{1}}{{2}}$ or $\\sin x$
   - Block formula: wrap with double $$, e.g., $$\\int_0^1 x dx$$
   - Common symbols: $\\pi$, $\\infty$, $\\alpha$, $\\sum$, $\\int$, etc.
   - Fractions: $\\frac{{numerator}}{{denominator}}$
   - Limits: $\\lim_{{x \\to 0}}$
   - Square roots: $\\sqrt{{x}}$ or $\\sqrt[n]{{x}}$
   - Superscripts: $x^2$, Subscripts: $x_i$
6. **NEVER use these incorrect formats**:
   - ❌ \\(...\\) or \\[...\\]
   - ❌ Plain LaTeX without $ delimiters
   - ❌ Unescaped backslashes in formulas

Output only the answer, nothing else."""
        else:
            prompt_text = f"""请根据视频内容简洁回答学生的问题。

知识点：{request.knowledge_point_name}
问题：{request.question}
视频内容：{request.transcript_segment}

要求：
1. 回答控制在30-100字
2. 直接给出答案，不要解释性前缀
3. 语言简洁明了
4. 如果提供了图片，请分析图片内容并结合到回答中
5. **数学公式必须使用 LaTeX 格式，用 $ 包裹**：
   - 行内公式：用单个 $ 包裹，例如 $\\frac{{1}}{{2}}$ 或 $\\sin x$
   - 块级公式：用双 $$ 包裹，例如 $$\\int_0^1 x dx$$
   - 常用符号：$\\pi$、$\\infty$、$\\alpha$、$\\sum$、$\\int$ 等
   - 分数：$\\frac{{分子}}{{分母}}$
   - 极限：$\\lim_{{x \\to 0}}$
   - 根号：$\\sqrt{{x}}$ 或 $\\sqrt[n]{{x}}$
   - 上标：$x^2$，下标：$x_i$
6. **绝对不要使用以下错误格式**：
   - ❌ \\(...\\) 或 \\[...\\]
   - ❌ 不加 $ 的纯 LaTeX 命令
   - ❌ 公式中的反斜杠未转义

只输出答案，不要其他内容。"""

        # 如果有图片，使用 vision 模型
        if request.image_urls and len(request.image_urls) > 0 and llm_provider == 'baijia':
            print(f"📸 Using vision model for image analysis")
            
            # 构建包含图片的消息
            content_parts = []
            
            # 添加所有图片
            for image_url in request.image_urls:
                content_parts.append({
                    "type": "image_url",
                    "image_url": {
                        "url": image_url
                    }
                })
            
            # 添加文本提示
            content_parts.append({
                "type": "text",
                "text": prompt_text
            })
            
            messages = [
                {
                    "role": "user",
                    "content": content_parts
                }
            ]
            
            # 调用视觉模型
            answer = await llm_service._call_baijia(
                messages=messages,
                force_json=False,
                model="doubao/Doubao-Seed-1-6-vision"
            )
        else:
            # 没有图片，使用普通模型
            answer = await llm_service.generate_outline(
                transcript=request.transcript_segment,
                custom_prompt=prompt_text
            )
        
        print(f"✅ Answer generated successfully")
        print(f"💬 Answer preview: {answer[:100]}...")
        
        return QuestionAnswerResponse(
            success=True,
            answer=answer
        )
        
    except Exception as e:
        print(f"❌ Error answering question: {e}")
        import traceback
        traceback.print_exc()
        
        return QuestionAnswerResponse(
            success=False,
            error=str(e)
        )


@router.post("/generate-exercise", response_model=ExerciseGenerationResponse)
async def generate_exercise(request: ExerciseGenerationRequest):
    """
    为特定知识点生成编程练习题
    
    Args:
        request: 包含知识点名称和上下文逐字稿的请求
        
    Returns:
        AI生成的练习题（JSON格式，包含题型、题干、代码等）
    """
    try:
        print(f"💪 Generating exercise for: {request.knowledge_point_name}")
        print(f"📄 Context length: {len(request.transcript_segment)} chars")
        print(f"📚 Subject: {request.subject or 'math'}")
        
        # 如果提供了自定义 prompt，直接使用
        if request.custom_prompt:
            prompt = request.custom_prompt
            print(f"✅ Using custom prompt from request")
        else:
            # 根据学科和语言环境构建 prompt
            locale = request.locale or 'zh'
            subject = request.subject or 'math'
            
            if subject == 'math':
                # 数学题型 prompt
                if locale == 'en':
                    prompt = f"""You are an experienced mathematics teacher. Please generate a math exercise based on the following video knowledge point.

Knowledge Point Name: {request.knowledge_point_name}
Knowledge Point Content: {request.transcript_segment}

Please generate an exercise with the following requirements:
1. Exercise Type: Randomly choose either [Multiple Choice] or [Fill in the Blank]
2. Difficulty: Suitable for middle/high school level with appropriate differentiation
3. The question should be directly related to the specific knowledge point explained in the video
4. The question should have practical application value, not too simple
5. **Mathematical formulas MUST use LaTeX format, wrapped with $**
6. Provide detailed analysis and solution steps

**LaTeX Formula Guidelines (Critical!):**
- ✅ Correct format: In JSON, all backslashes must be escaped as double backslashes \\\\
- ✅ Inline formula: $\\\\frac{{1}}{{2}}$, $\\\\sin x$, $\\\\pi$
- ✅ Block formula: $$\\\\int_0^1 x dx$$
- ✅ Common symbols: $\\\\alpha$, $\\\\beta$, $\\\\sum$, $\\\\lim_{{x \\\\to 0}}$
- ✅ Fractions: $\\\\frac{{numerator}}{{denominator}}$
- ✅ Square roots: $\\\\sqrt{{x}}$, $\\\\sqrt[3]{{x}}$
- ✅ Super/subscripts: $x^2$, $x_i$, $x_{{ij}}$ (multi-char subscript needs braces)
- ❌ Wrong format: \\frac{{1}}{{2}} (single backslash), \\(...\\), \\[...\\]

Please return in JSON format as follows:

**Multiple Choice Format:**
{{
  "type": "multiple_choice",
  "title": "Knowledge Point Practice: [Knowledge Point Name]",
  "description": "Complete the following exercise based on the video content",
  "difficulty": "intermediate",
  "question": "Given function $f(x) = \\\\frac{{x^2 + 1}}{{x - 1}}$, find the value of $\\\\lim_{{x \\\\to 1}} f(x)$",
  "choices": [
    {{"label": "A", "content": "$\\\\frac{{1}}{{2}}$"}},
    {{"label": "B", "content": "$1$"}},
    {{"label": "C", "content": "$2$"}},
    {{"label": "D", "content": "Does not exist"}}
  ],
  "answer_type": "single",
  "solution": "D",
  "hints": [
    "Hint 1: First check if the function is continuous at $x = 1$",
    "Hint 2: Note the zero denominator case, use the definition of limits",
    "Hint 3: Calculate left limit $\\\\lim_{{x \\\\to 1^-}}$ and right limit $\\\\lim_{{x \\\\to 1^+}}$ separately"
  ]
}}

**Fill in the Blank Format:**
{{
  "type": "fill_blank",
  "title": "Knowledge Point Practice: [Knowledge Point Name]",
  "description": "Complete the following exercise based on the video content",
  "difficulty": "intermediate",
  "question": "Calculate the limit $\\\\lim_{{x \\\\to 0}} \\\\frac{{\\\\sin x - x}}{{x^3}}$ = ___ .",
  "blanks": 1,
  "answer_type": "text",
  "solution": "$-\\\\frac{{1}}{{6}}$",
  "hints": [
    "Hint 1: Use Taylor series expansion $\\\\sin x = x - \\\\frac{{x^3}}{{6}} + O(x^5)$",
    "Hint 2: Substitute and simplify the numerator",
    "Hint 3: Cancel common factors and take the limit"
  ]
}}

**Key Points**:
1. Backslashes in JSON must be doubled: \\\\ not \\
2. Formulas must be wrapped with $, otherwise they won't render
3. Multi-character subscripts need braces: $x_{{ij}}$ not $x_ij$
4. All formulas in choices, solution, hints must follow the same rules

Return only JSON, no other explanatory text."""
                else:
                    prompt = f"""你是一位资深的数学教师，需要根据以下视频知识点生成一道练习题。

知识点名称：{request.knowledge_point_name}
知识点内容：{request.transcript_segment}

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
            else:
                # 编程题型 prompt（默认）
                if locale == 'en':
                    prompt = f"""You are a professional programming education expert. Please generate a programming exercise for the knowledge point based on the video content.

**Exercise Type Selection Rules**:
1. fill_blank: Suitable for simple syntax and single concepts (e.g., variable assignment, basic operations)
2. guided_steps: Suitable for tasks requiring complete function implementation (e.g., writing functions, implementing algorithms)
3. code_choice: Suitable for comparing different implementations and understanding logic
4. complete: Suitable for comprehensive applications and advanced tasks

**Type-Specific Fields**:
- fill_blank: Mark blank positions with "___" in starter_code, explain what to fill in each blank in hints
- guided_steps: List 3-5 steps in hints, explain what to accomplish in each step
- code_choice: Provide 3-4 code options in hints, mark the correct answer
- complete: Provide a basic framework, hints give thinking guidance

**Requirements**:
1. The exercise must be directly related to the video content and knowledge point
2. Moderate difficulty, suitable for beginners
3. Code should be concise, no more than 20 lines
4. Hints should be clear, help understanding without directly giving answers
5. Output only JSON, no other content
6. Ensure JSON format is correct and can be parsed"""
                else:
                    prompt = f"""你是一位专业的编程教学专家。请根据视频内容为知识点生成一道编程练习题。

知识点：{request.knowledge_point_name}
视频标题：{request.video_title or '未知'}

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

        # 打印实际使用的prompt（用于调试）
        print(f"📋 Exercise Generation Prompt:")
        print("=" * 70)
        print(prompt[:500])  # 只打印前500字符
        print("=" * 70)
        print(f"📄 Transcript segment (first 200 chars): {request.transcript_segment[:200]}...")

        # 调用 LLM 生成练习题
        exercise_json = await llm_service.generate_outline(
            transcript=request.transcript_segment,
            custom_prompt=prompt
        )
        
        print(f"✅ Exercise generated")
        print(f"💻 Exercise preview: {exercise_json[:200]}...")
        
        # 修复 LaTeX 转义问题
        def fix_latex_in_json(json_str: str) -> str:
            """修复 JSON 中的 LaTeX 单反斜杠问题"""
            import re
            # 将 \( 替换为 \\(
            json_str = json_str.replace(r'\(', r'\\(')
            # 将 \) 替换为 \\)
            json_str = json_str.replace(r'\)', r'\\)')
            # 将 LaTeX 命令的单反斜杠替换为双反斜杠
            latex_commands = ['frac', 'sqrt', 'lim', 'to', 'neq', 'sin', 'cos', 'tan', 'log', 'ln', 'infty', 'sum', 'prod', 'int', 'cdot', 'times', 'div']
            for cmd in latex_commands:
                # 使用负向后顾断言，确保前面不是反斜杠
                pattern = r'(?<!\\)\\' + cmd + r'\b'
                replacement = r'\\\\' + cmd
                json_str = re.sub(pattern, replacement, json_str)
            return json_str
        
        # 解析JSON
        try:
            import json
            # 先尝试修复 LaTeX 转义
            fixed_json = fix_latex_in_json(exercise_json)
            print(f"🔧 Fixed JSON preview: {fixed_json[:200]}...")
            
            exercise_data = json.loads(fixed_json)
            print(f"✅ Exercise parsed successfully")
            print(f"📝 Type: {exercise_data.get('type')}")
            print(f"🎯 Title: {exercise_data.get('title')}")
            
            return ExerciseGenerationResponse(
                success=True,
                exercise=exercise_data,
                from_cache=False
            )
        except json.JSONDecodeError as e:
            print(f"❌ Failed to parse exercise JSON: {e}")
            print(f"Raw response: {exercise_json}")
            return ExerciseGenerationResponse(
                success=False,
                error=f"解析练习题JSON失败: {str(e)}"
            )
        
    except Exception as e:
        print(f"❌ Error generating exercise: {e}")
        import traceback
        traceback.print_exc()
        
        return ExerciseGenerationResponse(
            success=False,
            error=str(e)
        )


class CodeExecutionRequest(BaseModel):
    """代码执行请求模型"""
    code: str
    language: str
    test_inputs: Optional[list] = None


class CodeExecutionResponse(BaseModel):
    """代码执行响应模型"""
    success: bool
    output: Optional[str] = None
    error: Optional[str] = None
    exit_code: Optional[int] = None
    warning: Optional[str] = None


class AnswerValidationRequest(BaseModel):
    """答案验证请求模型"""
    user_code: str
    exercise: dict  # 包含题目信息、参考答案、测试用例等
    language: str
    video_url: Optional[str] = None
    knowledge_point_name: Optional[str] = None


class AnswerValidationResponse(BaseModel):
    """答案验证响应模型"""
    success: bool
    passed: bool  # 是否通过
    score: Optional[int] = None  # 评分 (0-100)
    feedback: Optional[str] = None  # LLM反馈
    test_results: Optional[dict] = None  # 测试用例结果
    error: Optional[str] = None


@router.post("/execute-code", response_model=CodeExecutionResponse)
async def execute_code(request: CodeExecutionRequest):
    """
    执行代码
    
    Args:
        request: 包含代码、语言、测试输入的请求
        
    Returns:
        代码执行结果
    """
    try:
        from app.services.code_execution_service import code_execution_service
        
        print(f"💻 执行代码:")
        print(f"   语言: {request.language}")
        print(f"   代码长度: {len(request.code)} 字符")
        if request.test_inputs:
            print(f"   测试输入: {request.test_inputs}")
        
        # 执行代码
        result = await code_execution_service.execute_code(
            code=request.code,
            language=request.language,
            test_inputs=request.test_inputs
        )
        
        if result['success']:
            print(f"✅ 代码执行成功")
            if result.get('output'):
                print(f"📤 输出: {result['output'][:100]}...")
        else:
            print(f"❌ 代码执行失败: {result.get('error')}")
        
        return CodeExecutionResponse(**result)
        
    except Exception as e:
        print(f"❌ Error executing code: {e}")
        import traceback
        traceback.print_exc()
        
        return CodeExecutionResponse(
            success=False,
            error=str(e)
        )


@router.post("/validate-answer", response_model=AnswerValidationResponse)
async def validate_answer(request: AnswerValidationRequest):
    """
    验证用户答案
    
    Args:
        request: 包含用户代码、练习题、语言等信息的请求
        
    Returns:
        验证结果，包括是否通过、评分、反馈等
    """
    try:
        from app.services.code_execution_service import code_execution_service
        
        print(f"🎯 验证答案:")
        print(f"   知识点: {request.knowledge_point_name}")
        print(f"   语言: {request.language}")
        print(f"   题型: {request.exercise.get('type')}")
        
        # 使用LLM进行代码评估
        print(f"🤖 调用LLM进行代码评估...")
        
        # 构建评估prompt（暂时保持中文，因为这是内部评估，用户看到的是前端翻译后的反馈）
        prompt = f"""你是一位专业的编程教学专家。请评估学生提交的代码答案。

**练习题信息**：
- 标题：{request.exercise.get('title')}
- 描述：{request.exercise.get('description')}
- 题型：{request.exercise.get('type')}
- 难度：{request.exercise.get('difficulty')}
- 语言：{request.language}

**参考答案**：
```{request.language}
{request.exercise.get('solution', '无')}
```

**学生提交的代码**：
```{request.language}
{request.user_code}
```

请按以下JSON格式返回评估结果：

{{
  "passed": true/false,
  "score": 0-100,
  "feedback": "简洁的反馈（100字以内）",
  "strengths": ["优点1", "优点2"],
  "improvements": ["改进建议1", "改进建议2"]
}}

**评分标准**：
1. 功能正确性 (50%): 是否实现了要求的功能，逻辑是否正确
2. 代码质量 (30%): 代码是否简洁、可读、规范
3. 完整性 (20%): 是否完整实现了所有要求

**要求**：
1. 如果代码完全正确且质量高，给90-100分
2. 如果代码基本正确但有小问题，给70-89分
3. 如果代码部分正确或逻辑有误，给40-69分
4. 如果代码错误或无法运行，给0-39分
5. 反馈要具体、有建设性，指出明确的改进方向
6. 只输出JSON，不要其他内容"""

        # 调用LLM
        llm_result = await llm_service.generate_outline(
            transcript="",
            custom_prompt=prompt
        )
        
        print(f"📊 LLM评估结果: {llm_result[:200]}...")
        
        # 解析LLM返回的JSON
        try:
            import json
            assessment = json.loads(llm_result)
            
            passed = assessment.get('passed', False)
            score = assessment.get('score', 0)
            
            # 构建反馈
            feedback_parts = [assessment.get('feedback', '')]
            
            if assessment.get('strengths'):
                feedback_parts.append("\n\n**✨ 优点**:")
                for strength in assessment['strengths']:
                    feedback_parts.append(f"- {strength}")
            
            if assessment.get('improvements'):
                feedback_parts.append("\n\n**💡 改进建议**:")
                for improvement in assessment['improvements']:
                    feedback_parts.append(f"- {improvement}")
            
            feedback = '\n'.join(feedback_parts)
            
            print(f"✅ 评估完成: {'通过' if passed else '未通过'} | 得分: {score}")
            
            return AnswerValidationResponse(
                success=True,
                passed=passed,
                score=score,
                feedback=feedback,
                test_results=None  # 不再返回测试结果
            )
            
        except json.JSONDecodeError as e:
            print(f"❌ LLM返回的不是有效JSON: {e}")
            print(f"原始返回: {llm_result[:500]}")
            
            return AnswerValidationResponse(
                success=False,
                passed=False,
                score=0,
                feedback="评估失败：LLM返回格式错误，请稍后重试",
                error=f"LLM response format error: {str(e)}"
            )
        
    except Exception as e:
        print(f"❌ Error validating answer: {e}")
        import traceback
        traceback.print_exc()
        
        return AnswerValidationResponse(
            success=False,
            passed=False,
            error=str(e)
        )

