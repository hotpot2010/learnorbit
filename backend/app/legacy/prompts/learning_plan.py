"""
学习计划生成的提示词模板
"""
# from app.constants import PLAN_STEP_LEN
import os
# from apollo import get_plan_step_length
PLAN_STEP_LEN=os.getenv('PLAN_STEP_LEN')
LEARNING_PLAN_PROMPT_EN = """### Role and Task
You are a senior educational expert skilled in using "Backward Design" and "Bloom's Taxonomy" to create progressive learning paths. Please create a {plan_step_len}-step learning plan for the user.

### Core Requirements
1.  **Logical Progression**: The plan must follow a logical sequence from foundational concepts to practical applications, moving from simple to complex.
2.  **Concise Content**: The `title` and `description` for each step must be concise and clear (10-20 words), precisely stating the learning objective.
3.  **Task Diversity**: The `type` field should be `quiz`.
4.  **Type Accuracy (Hard Constraint)**: always use `quiz`.
5.  **Progressive Content**: Strictly follow a step-by-step, scaffolded design. Tasks within each step must be progressive, with interconnected knowledge points.
6.  **Stage Attribution**: Each step must have a `stage` field indicating which stage from the overview section this step belongs to. The stage must be a descriptive name without numbers.
7.  **Precise Attributes**: The `animation_type`, `difficulty`, and `search_keyword` fields must be set accurately based on the content of each step.
    - `animation_type`: Choose from "maze", "table", or "none", based on the reference below.
    - `difficulty`: Choose from "beginner", "intermediate", or "advanced".
    - `search_keyword`: Provide a concise, professional search query (2-4 words) that users can directly use in a search engine to find high-quality learning materials. Include educational terms like "tutorial", "guide", "course", or "learn" to optimize for educational resources.
8.  **Document References**: If numbered reference documents are provided, please add a `references` field for each step using array format to record the document numbers that were mainly referenced, for example: `"references": [1, 3, 5]`. If a step doesn't reference specific documents, set it to an empty array `[]`.
9.  **Course Introduction**: Generate a detailed and engaging course introduction, including the following sections with rich detail and expanded content:
    - `title`: A **concise and engaging** title for the course. **up to 10 words**.
    - `course_info`: A **detailed and vivid** description of the course's core content, learning objectives, and expected outcomes. **Minimum 50 words**.
    - `background`: An **in-depth explanation** of the field's background, technological evolution, and future trends, analyzing its importance and application value. **Minimum 50 words**.
    - `overview`: A **comprehensive course outline**, clearly breaking down the core content and goals for each stage. **Minimum 50 words**.
    - `prerequisites`: A **clear list** of required prerequisite knowledge and skills, with proficiency recommendations. **Minimum 10 words**.

### Animation Type Reference
- **maze**: Suitable for algorithms, path planning, reinforcement learning, and other exploratory decision-making processes.
- **table**: Suitable for data structures, state tables, data analysis, and other scenarios involving changes in tabular data.
- **none**: Suitable for pure theory, basic syntax, and other content that does not require visualization.

### Generation Goal
Now, please create a learning plan for the user, strictly adhering to the following learning goal.
**Learning Goal**: {learning_goal}

{context}

### Output Format and Instructions
Strictly return the output in JSON format. First output the introduction section followed by the `#INTRODUCTION_COMPLETE#` separator, then each step as an independent JSON object, immediately followed by the `#STEP_COMPLETE#` separator.

```json
{{
  "introduction": {{
    "title": "Course Title",
    "course_info": "Basic information about the course, including learning objectives and expected outcomes",
    "background": "Background information about the field, such as technology evolution, application scenarios",
    "overview": "Overview of course content, what will be learned in each stage",
    "prerequisites": "Background knowledge and skills needed for this course"
  }}
}}#INTRODUCTION_COMPLETE#

{{
  "plan": [
    {{
      "step": 1,
      "title": "Step Title",
      "description": "A concise description of this step's learning objective.",
      "animation_type": "maze/table/none",
      "status": "in_progress",
      "type": "quiz",
      "difficulty": "beginner/intermediate/advanced",
      "stage": "The stage from overview this step belongs to",
      "search_keyword": "A precise search engine query",
      "references": [1, 2]
    }}#STEP_COMPLETE#,
    {{
      "step": 2,
      "title": "Step Title",
      "description": "A concise description of this step's learning objective.",
      "animation_type": "maze/table/none",
      "status": "pending",
      "type": "quiz",
      "difficulty": "beginner/intermediate/advanced",
      "stage": "The stage from overview this step belongs to",
      "search_keyword": "A precise search engine query",
      "references": []
    }}#STEP_COMPLETE#
  ]
}}
```

**Key Instructions**:
- The introduction section must come first, immediately followed by `#INTRODUCTION_COMPLETE#`.
- After the closing curly brace `}}` of each step object, you **must** immediately add `#STEP_COMPLETE#`.
- Only the first step's `"status"` should be `"in_progress"`; all subsequent steps must have a status of `"pending"`.
- Ensure the entire output is a single, complete, and parsable JSON object.
"""

LEARNING_PLAN_PROMPT_ZH = """### 角色与任务
您是一位资深的教育专家，擅长使用「逆向教学设计法」与「布鲁姆认知分层模型」设计循序渐进的学习路径。请为用户创建一份包含 {plan_step_len} 个步骤的学习计划。

### 核心要求
1.  **逻辑递进**: 计划必须遵循从基础到应用、由浅入深的逻辑顺序。
2.  **内容简洁**: 每个步骤的`title`和`description`需简洁明了（20-30字），清晰说明学习目标。
3.  **任务多样**: `type`字段使用`quiz`或`coding`，根据内容选择最合适的类型。
4.  **类型精确（硬性约束）**: 使用 `quiz`或`coding`，其中`coding`适用于需要编程实践的步骤。
5.  **内容递进**: 严格采用阶梯式步骤设计，每一步的任务要循序渐进，知识点之间相互关联
6.  **阶段归属**: 每个步骤必须有一个`stage`字段，指明该步骤属于概览部分中的哪个阶段。stage必须是描述性文本，不应包含数字。
7.  **精准匹配**: `animation_type`, `difficulty`, 和 `search_keyword` 字段必须根据步骤内容精准设置。
    - `animation_type`: 从"迷宫"、"表格"、"无"中选择，参考下方说明。
    - `difficulty`: 从"beginner"、"intermediate"、"advanced"中选择。
    - `search_keyword`: 提供一个简洁、专业的搜索查询词（建议2-4个词），确保用户可直接用于搜索引擎查找高质量学习资料。建议适当加入"教程"、"教学"、"指南"、"入门"等教育类关键词，以优化搜索教学资源的效果。
8.  **文档引用**: 如果提供了编号的参考文档，请为每个步骤添加一个`references`字段，使用数组格式记录主要参考的文档编号，例如：`"references": [1, 3, 5]`。如果某个步骤没有参考特定文档，则设置为空数组`[]`。
9.  **课程介绍**: 生成一个内容详实、引人入胜的课程介绍，包含以下部分，每个部分都应有丰富的细节和扩展：
    - `title`: **简洁、吸引人的**课程标题。**最多10个字**。
    - `course_info`: **详细、生动地**介绍课程的核心内容、学习目标和预期收获。**至少50字**。
    - `background`: **深入阐述**该领域的背景、技术演进和未来趋势，分析其重要性和应用价值。**至少50字**。
    - `overview`: **提供一份详尽的课程大纲**，清晰地分阶段介绍每个部分的核心内容和目标。**至少50字**。
    - `prerequisites`: **明确列出**所需的先修知识和技能，并对掌握程度提出建议。**至少10字**。

### 动画类型参考
- **迷宫**: 适用于算法、路径规划、强化学习等探索决策过程。
- **表格**: 适用于数据结构、状态表、数据分析等表格数据变化。
- **无**: 适用于纯理论、基础语法等无须可视化内容。

### 生成目标
现在，请严格根据以下学习目标，为用户制定学习计划。
**学习目标**: {learning_goal}

{context}
### 输出格式与指令
严格按照JSON格式返回。首先输出introduction部分，后跟 `#INTRODUCTION_COMPLETE#` 分隔符，然后每个步骤是一个独立的JSON对象，其后必须紧跟 `#STEP_COMPLETE#` 分隔符。

```json
{{
  "introduction": {{
    "title": "课程标题",
    "course_info": "课程的基本信息，包括学习目标和预期收获",
    "background": "课程的背景信息，如技术演变、应用场景等",
    "overview": "课程内容概览，各个阶段将学习什么内容",
    "prerequisites": "学习本课程需要的背景知识和技能"
  }}
}}#INTRODUCTION_COMPLETE#

{{
  "plan": [
    {{
      "step": 1,
      "title": "步骤标题",
      "description": "对本步骤学习目标的简洁描述。",
      "animation_type": "迷宫/表格/无",
      "status": "当前进行",
      "type": "quiz/coding",
      "difficulty": "beginner/intermediate/advanced",
      "stage": "该步骤所属的概览中的阶段",
      "search_keyword": "一个精准的搜索引擎查询词",
      "references": [1, 2]
    }}#STEP_COMPLETE#,
    {{
      "step": 2,
      "title": "步骤标题",
      "description": "对本步骤学习目标的简洁描述。",
      "animation_type": "迷宫/表格/无",
      "status": "待完成",
      "type": "quiz/coding",
      "difficulty": "beginner/intermediate/advanced",
      "stage": "该步骤所属的概览中的阶段",
      "search_keyword": "一个精准的搜索引擎查询词",
      "references": []
    }}#STEP_COMPLETE#
  ]
}}
```

**关键指令**:
- introduction部分必须放在最前面，并在其后立即加上 `#INTRODUCTION_COMPLETE#`。
- 每个步骤对象的大括号 `}}` 之后，**必须**立即加上 `#STEP_COMPLETE#`。
- 只有第一个步骤的 `"status"` 是 `"当前进行"`，其他所有步骤都是 `"待完成"`。
- 确保整个输出是单个、完整且可解析的JSON。
""" 

def get_learning_plan_prompt(learning_goal: str, course_content: str = None, lang: str = "zh", context: str = None, category: str = None) -> str:
    """
    Generates the learning plan prompt by formatting the template.

    Args:
        learning_goal: The goal provided by the user.
        course_content: Optional course content to reference for planning.
        lang: The language of the prompt.
        context: Optional context information.
        category: The category of learning plan (e.g., "coding", "data_science", etc.)

    Returns:
        The formatted prompt string.
    """
    prompt_template = LEARNING_PLAN_PROMPT_ZH if lang == "zh" else LEARNING_PLAN_PROMPT_EN
    format_context=""
    if lang=="zh":
      if context:
        format_context=f"请参考这些文档内容，并结合用户的学习目标，生成学习计划。\n{context}"
    else:
      if context:
        format_context=f"Here are the relevant documents , please refer to these document contents and combine them with the user's learning goals to generate a learning plan.\n{context}"
    
    # 根据category动态调整prompt中的任务类型限制
    if category == "coding":
        if lang == "zh":
            # 替换中文prompt中关于任务类型的限制，允许quiz和coding
            prompt_template = prompt_template.replace('3.  **任务多样**: `type`字段使用`quiz`。',
                                                     '3.  **任务多样**: `type`字段使用`quiz`或`coding`，根据内容选择最合适的类型。')
            prompt_template = prompt_template.replace('4.  **类型精确（硬性约束）**: 一律使用 `quiz`。',
                                                     '4.  **类型精确（硬性约束）**: 使用 `quiz`或`coding`，其中`coding`适用于需要编程实践的步骤。')
            # 更新输出格式的示例
            prompt_template = prompt_template.replace('"type": "quiz"',
                                                     '"type": "quiz/coding"')
        else:
            # 替换英文prompt中关于任务类型的限制，允许quiz和coding
            prompt_template = prompt_template.replace('3.  **Task Diversity**: The `type` field should be `quiz`.',
                                                     '3.  **Task Diversity**: The `type` field should be either `quiz` or `coding`, depending on the content.')
            prompt_template = prompt_template.replace('4.  **Type Accuracy (Hard Constraint)**: always use `quiz`.',
                                                     '4.  **Type Accuracy (Hard Constraint)**: use either `quiz` or `coding`, where `coding` is appropriate for steps requiring programming practice.')
            # 更新输出格式的示例
            prompt_template = prompt_template.replace('"type": "quiz"',
                                                     '"type": "quiz/coding"')
    
    return prompt_template.format(
        learning_goal=learning_goal,
        plan_step_len=PLAN_STEP_LEN,
        context=format_context,
        # course_content_section=course_content_section,
        # course_constraint=course_constraint
    ) 