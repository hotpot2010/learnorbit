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
    custom_prompt: Optional[str] = None  # 自定义 prompt


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
    回答用户关于特定知识点的问题
    
    Args:
        request: 包含问题、知识点名称和上下文逐字稿的请求
        
    Returns:
        AI生成的回答
    """
    try:
        print(f"🤔 Answering question: {request.question}")
        print(f"📚 Knowledge point: {request.knowledge_point_name}")
        print(f"📄 Context length: {len(request.transcript_segment)} chars")
        
        # 根据语言环境构建 prompt
        locale = request.locale or 'zh'
        if locale == 'en':
            prompt = f"""Please answer the student's question concisely in one sentence.

Knowledge Point: {request.knowledge_point_name}
Question: {request.question}

Requirements:
1. Answer should be 30-50 words
2. Give the answer directly without explanatory prefixes
3. Language should be concise and clear

Output only the answer, nothing else."""
        else:
            prompt = f"""请用一句话简洁回答学生的问题。

知识点：{request.knowledge_point_name}
问题：{request.question}

要求：
1. 回答控制在30-50字
2. 直接给出答案，不要解释性前缀
3. 语言简洁明了

只输出答案，不要其他内容。"""

        # 调用 LLM 生成回答
        answer = await llm_service.generate_outline(
            transcript=request.transcript_segment,
            custom_prompt=prompt
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
        
        # 如果提供了自定义 prompt，直接使用
        if request.custom_prompt:
            prompt = request.custom_prompt
            print(f"✅ Using custom prompt from request")
        else:
            # 根据语言环境构建默认 prompt
            locale = request.locale or 'zh'
            if locale == 'en':
                prompt = f"""You are a professional programming education expert. Please generate a programming exercise for the knowledge point based on the video content.

Knowledge Point: {request.knowledge_point_name}
Video Title: {request.video_title or 'Unknown'}

Please choose an appropriate exercise type based on the difficulty of the knowledge point and generate the exercise. Must strictly follow the following JSON format:

{{
  "type": "Exercise type (one of: fill_blank/guided_steps/code_choice/complete)",
  "title": "Exercise title",
  "description": "Exercise description (within 50 words)",
  "difficulty": "Difficulty (beginner/intermediate/advanced)",
  "language": "Programming language (python/javascript/etc.)",
  "starter_code": "Initial code template",
  "solution": "Reference answer",
  "hints": ["Hint 1", "Hint 2"]
}}

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
        
        # 解析JSON
        try:
            import json
            exercise_data = json.loads(exercise_json)
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

