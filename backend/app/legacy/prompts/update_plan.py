"""
学习计划修改的提示词模板
"""

# from app.constants import PLAN_STEP_LEN
import os
# from apollo import get_plan_step_length
PLAN_STEP_LEN=os.getenv('PLAN_STEP_LEN')
UPDATE_PLAN_PROMPT_EN = """### Role Definition
You are an expert in educational sciences with extensive experience in curriculum design. Your specialty is precisely optimizing and adjusting existing learning plans based on learner feedback and needs. You are proficient in using the "Backward Design" framework and "Bloom's Taxonomy" to refine learning pathways.

Your current task is to perform targeted adjustments and optimizations to the current learning plan based on the user's modification requests.

### Current Learning Plan
{current_plan}

### Advise for Plan Modification
{advise}

{context}

### Modification Strategy and Core Constraints
**1. Identify Modification Type: Complete Overhaul vs. Partial Tweak**
*   **Primary Task**: Carefully analyze the `Advise for Plan Modification` to determine the nature of the requested changes.
*   **If the `advise` includes keywords like "overhaul," "from scratch," "start over," "prerequisites," or explicitly states that the user lacks a core skill (e.g., "I don't know how to code")**:
    *   This is classified as a **"Complete Overhaul."** You must **completely discard** the structure and content of the `Current Learning Plan`.
    *   Your mission is to design a **brand new, logically coherent <placeholder>-step theoretical learning path** based on the reshaped overall goal derived from the `advise`.
    *   In this scenario, you must **output all steps** in the `updates` field and create a new course introduction.
*   **If the above conditions are not met**:
    *   This is considered a **"Partial Tweak."** You will modify the `Current Learning Plan` and only output the steps that have undergone substantive changes, along with any necessary updates to the course introduction.

**2. Infer User Intent and Reshape Learning Goal**:
*   First, deeply analyze the user's feedback to pinpoint their core request (e.g., is the overall difficulty too high/low, are they uninterested in a specific topic, or do they want to adjust the learning pace?).
*   Based on this request, mentally redefine a more realistic **overall learning goal** for the user. For instance, if the feedback is "This is too hard, I don't know how to code," the goal could be adjusted from "Mastering XGBoost" to "Theoretically understanding the core concepts and prerequisites of XGBoost."
*   **You must explicitly state the new overall learning goal you have defined for the user in the returned `analysis` field.** This serves as the foundation for all subsequent modifications.

**3. Reconstruct the Full Learning Path Based on the New Goal**:
*   Centered around this new overall goal, mentally design a new, logically coherent <placeholder>-step learning path.
*   This new path should fully serve the new goal. For a "Complete Overhaul," all steps will be new. For a "Partial Tweak," this might involve replacing certain topics or adjusting their depth.
*   **Enhanced Course Introduction**: Whether overhauling or making partial tweaks, the course introduction must meet professional documentation standards, including:
    *   `title`: A **concise and engaging** title for the course. **up to 10 words**.
    *   `course_info`: In addition to stating the overall goal, specify phased objectives and application scenarios for learning outcomes (e.g., real-world projects, professional skill enhancement).
    *   `background`: Supplement with the evolution of technology in the field (e.g., the development history of relevant models/tools), current industry application status and pain points, and explain the necessity of learning this content.
    *   `overview`: Break down the learning content into modules, explain the logical connections between modules (e.g., "first master the basic concepts, then advance to practical applications"), and highlight key chapters.
    *   `prerequisites`: Detail the required prerequisite knowledge (e.g., programming language versions, mathematical foundations, general knowledge of the field), and recommend supplementary learning resources (e.g., recommended introductory courses).

**4. Output Rules**:
*   For a **"Complete Overhaul"**, **output the new introduction and all steps**.
*   For a **"Partial Tweak"**, compare your reconstructed "new" plan with the "current" plan:
    *   If the introduction needs modification, output the updated introduction first
    *   Then **only output** the steps where `title`, `description`, `difficulty`, or `type` has been **substantially changed**.

**5. Strict Rules to Follow**:
*   **Constant Step Count**: Strictly maintain the total number of steps at <placeholder>. Do not add or delete steps.
*   **Format Requirement**: Strictly adhere to the JSON format below, containing the `analysis`, optional `introduction` and the list of modified steps, `updates`.
*   **Logical Coherence**: Ensure that all modified steps, when combined, form a logically coherent learning plan with a smooth difficulty curve.
*   **Animation & Keywords**: The `animation_type` and `search_keyword` fields must be re-evaluated and provided based on the modified step content.
*   **Document References**: If numbered reference documents are provided, please add a `references` field for each modified step using array format to record the document numbers that were mainly referenced, for example: `"references": [1, 3, 5]`. If a step doesn't reference specific documents, set it to an empty array `[]`.
*   **Purely Theoretical Plan**: If overhauling to create a purely theoretical plan, the `type` for all steps **must be `quiz`**.
*   **Stage Naming**: The `stage` field must be descriptive text without numbers.


### Animation Type Description
Select the most appropriate animation type for the modified step:
- **maze**: Suitable for algorithms, pathfinding, reinforcement learning, game AI, etc., that require demonstrating exploration and decision-making processes.
- **table**: Suitable for data structures, state tables, Q-tables, data analysis, algorithm comparisons, etc., that need to show changes in tabular data.
- **none**: Suitable for purely theoretical concepts, basic syntax, abstract ideas, etc., that do not require visual demonstration.

### Step Description Format Requirement
The modified step description should be organized in the following concise structure:

**Learning Objective:** [Briefly explain the specific goal to be achieved in this step]
**Task Type:** [Suggested exercise type: Conceptual Understanding / Programming Practice / Comprehensive Application, etc.]

### Search Keyword Requirements
Provide a keyword or phrase for video search for each step:
- Must strictly match the core content of the step description.
- Should include domain-specific terminology to improve search accuracy.
- Avoid overly broad terms to ensure search results are highly relevant to the learning content.

### Exercise Type
Should be chosen from `quiz`.

### Difficulty
Should be chosen from `beginner`, `advanced`, or `intermediate`.

### Output Format
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
  "analysis": "A brief analysis of the user's modification request and the implemented modification strategy.",
  "updates": [
    {{
      "step_number": "The number of the step to be modified",
      "reason": "A brief explanation for the modification",
      "step_data": {{
        "step": "The step number",
        "title": "The modified step title",
        "description": "The modified step description (organized according to the format requirements above)",
        "animation_type": "maze/table/none",
        "status": "Maintain original status or adjust based on logic",
        "type": "quiz",
        "difficulty": "beginner/advanced/intermediate",
        "stage": "The stage from overview this step belongs to (must be descriptive text without numbers)",
        "search_keyword": "A precise search engine query including educational terms like 'tutorial', 'guide', 'course' or 'learn'",
        "references": [1, 3]
      }}
    }}#STEP_COMPLETE#
    {{
      "step_number": "The number of the step to be modified",
      "reason": "A brief explanation for the modification",
      "step_data": {{
        "step": "The step number",
        "title": "The modified step title",
        "description": "The modified step description (organized according to the format requirements above)",
        "animation_type": "maze/table/none",
        "status": "Maintain original status or adjust based on logic",
        "type": "quiz",
        "difficulty": "beginner/advanced/intermediate",
        "stage": "The stage from overview this step belongs to (must be descriptive text without numbers)",
        "search_keyword": "A precise search engine query including educational terms like 'tutorial', 'guide', 'course' or 'learn'",
        "references": []
      }}
    }}#STEP_COMPLETE#
  ]
}}
```

Note:
1.  **Return only the elements that need modification**; do not output parts that don't need to be changed.
2.  **If the course introduction needs to be modified, you must append the `#INTRODUCTION_COMPLETE#` marker after it**
3.  You must append the `#STEP_COMPLETE#` marker after the closing brace of each updated item. This is critically important.
4.  Ensure the JSON format is strictly correct and can be parsed.
5.  Every modification must have a clear `reason`.
6.  Maintain the continuity and logic of the step numbering.
7.  **The `animation_type` field is mandatory** and must be one of "maze", "table", or "none".
8.  The choice of `animation_type` must be highly relevant to the content of the modified step.
9.  The modified `status` should align with the logic of learning progress (e.g., a completed step is usually not changed back to 'to-do').
10. If the modification involves adjusting the step order, explain the logic in the `analysis` field.
11. **The `search_keyword` field is mandatory** and must strictly reflect the core content of the step description.
"""

UPDATE_PLAN_PROMPT_ZH = """
### 角色定义  
您是具有课程设计经验的教育学专家，专门负责根据学习者的反馈和需求对现有学习计划进行精准优化调整。您擅长使用「逆向教学设计法」与「布鲁姆认知分层模型」来完善学习路径。

现在需要根据用户的修改要求，对现有的学习计划进行针对性的调整和优化。

### 当前学习计划
{current_plan}

### 计划修改建议
{advise}

{context}
### 修改策略与核心约束
**1. 识别修改类型：彻底重构 vs. 局部微调**
*   **首要任务**：仔细分析`计划修改建议`，判断修改的性质。
*   **如果`计划修改建议`包含"彻底重做"、"Overhaul"、"从头"、"前置知识"等关键词，或明确指出用户缺乏核心能力（如不会编程）**：
    *   **这被视为"彻底重构"**。你必须**完全放弃**`当前学习计划`的结构和内容。
    *   你的任务是基于`计划修改建议`中重塑的总体目标，**设计一个全新的、包含<placeholder>个步骤的、逻辑连贯的理论学习路径**。
    *   在这种情况下，你必须在`updates`字段中**输出全部<placeholder>个新的步骤**，并且需要重新生成课程介绍部分。
*   **如果不符合上述情况**：
    *   **这被视为"局部微调"**。你将基于`当前学习计划`进行修改，并只输出有实质性变化的步骤和需要修改的课程介绍部分。

**2. 推断用户意图，重塑学习目标**：
*   首先，深入分析用户的反馈，精准判断其核心诉求（例如：是觉得整体难度过高/过低，还是对特定主题不感兴趣，或是想调整学习节奏）。
*   基于用户诉求，在脑海中为他重新定义一个更切合实际的**总体学习目标**。例如，如果用户反馈"太难了，不会编程"，可将总目标从"精通XGBoost"调整为"理论理解XGBoost的核心概念与前置知识"。
*   **你必须在返回的 `analysis` 字段中，明确说明你为用户重塑的总体学习目标是什么**，这是你后续所有修改的依据。

**3. 基于新目标，重构完整学习路径**：
*   围绕这个新的总体学习目标，在脑海中重新设计一个包含<placeholder>个步骤的、全新的、逻辑连贯的学习路径。
*   这个新路径应该完全服务于新的总目标。对于"彻底重构"场景，这意味着所有步骤都是新的；对于"局部微调"，可能意味着替换掉原有计划中的某些主题，或者调整深度。
*   课程介绍强化：无论重构还是微调，课程介绍需达到专业文档水准，包含：
    *   title：简洁、吸引人的课程标题。**最多10个字**。
    *   course_info：不仅说明总体目标，还需细化分阶段目标、学习成果可应用场景（如实际项目、职业技能提升等）；
    *   background：补充领域技术演变（如相关模型 / 工具的发展历程）、行业应用现状及痛点，说明学习该内容的必要性；
    *   overview：分模块拆解学习内容，说明各模块的逻辑关联（如 "先掌握基础概念，再进阶至实战应用"），并标注重点章节；
    *   prerequisites：详细列出所需的前置知识（如编程语言版本、数学基础、相关领域常识等），并建议补充学习资源（如推荐的入门课程）。

**4. 输出规则**：
*   对于"彻底重构"的场景，**输出全部<placeholder>个新步骤**和新的课程介绍。
*   对于"局部微调"的场景，将你重构的"新"计划与用户"当前"的学习计划进行逐一对比：
    *   如果课程介绍需要修改，首先输出更新后的介绍部分
    *   然后**只输出**那些在`title`, `description`, `difficulty`, `type`上有**实质性变化**的步骤。

**5. 严格遵守的规则**:
*   **步骤数量恒定**：严格保持学习计划的总步骤数为<placeholder>步，不允许新增或删除步骤。
*   **格式要求**：严格按照下面的JSON格式输出，只包含`analysis`、可选的`introduction`和被修改的步骤列表`updates`。
*   **逻辑连贯**：确保所有修改后的步骤组合在一起时，依然是一个逻辑连贯、难度平滑的学习计划。
*   **动画与关键词**：`animation_type` 和 `search_keyword` 字段必须根据修改后的步骤内容重新评估并提供。
*   **文档引用**：如果提供了编号的参考文档，请为每个修改步骤添加一个`references`字段，使用数组格式记录主要参考的文档编号，例如：`"references": [1, 3, 5]`。如果某个步骤没有参考特定文档，则设置为空数组`[]`。
*   **纯理论计划**：如果是在"彻底重构"一个纯理论计划，**所有步骤的`type`都应为`quiz`**。
*   **阶段命名**：`stage`字段必须是描述性文本，不应包含数字。


### 动画类型说明
为修改的步骤选择最合适的动画类型：
- **迷宫**：适用于算法学习、路径规划、强化学习、游戏AI等需要展示探索和决策过程的内容
- **表格**：适用于数据结构、状态表、Q值表、数据分析、算法比较等需要展示表格数据变化的内容  
- **无**：适用于纯理论概念、基础语法、抽象概念等不需要可视化演示的内容

### 步骤描述格式要求
修改后的步骤描述应按以下简洁结构组织：

**学习目标：** [简洁说明本步骤要达成的具体目标]
**任务类型：** [建议的练习类型：概念理解/编程实践/综合应用等]

### 搜索关键词要求
为每个步骤提供一个用于视频搜索的关键词或短语：
- 必须严格匹配步骤描述的核心内容
- 应当包含领域专业术语，以提高搜索准确性
- 避免过于宽泛的词语，确保搜索结果与学习内容高度相关

### 练习类型
应该从quiz中选择

### 难度
应该从beginner/advanced/intermediate中选择

### 输出格式
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
  "analysis": "对用户修改要求的简要分析和修改思路",
  "updates": [
    {{
      "step_number": 需要修改的步骤号,
      "reason": "修改原因的简要说明",
      "step_data": {{
        "step": 步骤号,
        "title": "修改后的步骤标题",
        "description": "修改后的步骤描述（按照上述格式要求组织内容）",
        "animation_type": "迷宫/表格/无",
        "status": "保持原状态或根据逻辑调整",
        "type":"quiz",
        "difficulty":"beginner/advanced/intermediate",
        "stage": "该步骤所属的概览中的阶段（必须是描述性文本，不应包含数字）",
        "search_keyword": "一个精准的搜索引擎查询词，建议加入'教程'、'教学'、'指南'等教育类关键词",
        "references": [1, 3]
      }}
    }}#STEP_COMPLETE#
    {{
      "step_number": 需要修改的步骤号,
      "reason": "修改原因的简要说明",
      "step_data": {{
        "step": 步骤号,
        "title": "修改后的步骤标题",
        "description": "修改后的步骤描述（按照上述格式要求组织内容）",
        "animation_type": "迷宫/表格/无",
        "status": "保持原状态或根据逻辑调整",
        "type":"quiz",
        "difficulty":"beginner/advanced/intermediate",
        "stage": "该步骤所属的概览中的阶段（必须是描述性文本，不应包含数字）",
        "search_keyword": "一个精准的搜索引擎查询词，建议加入'教程'、'教学'、'指南'等教育类关键词",
        "references": []
      }}
    }}#STEP_COMPLETE#
  ]
}}
```

注意:
1. **只返回需要修改的内容**，不需要修改的部分不要输出
2. **如果需要修改课程介绍，必须在introduction部分后添加 #INTRODUCTION_COMPLETE# 标记**
3. 必须在每个更新项的结束大括号后添加 #STEP_COMPLETE# 标记，这非常重要
4. 确保JSON格式严格正确，可以被解析
5. 每个修改都要有明确的原因说明
6. 保持步骤编号的连续性和逻辑性
7. **animation_type字段是必需的**，必须从"迷宫"、"表格"、"无"中选择一个
8. 动画类型的选择要与修改后的步骤内容高度匹配
9. 修改后的状态要符合学习进度的逻辑（已完成的步骤通常不会改回待完成）
10. 如果修改涉及步骤顺序调整，要在analysis中说明调整逻辑
11. **search_keyword字段是必需的**，必须严格符合步骤描述的核心内容

"""

PROMPTS = {
    "zh": UPDATE_PLAN_PROMPT_ZH,
    "en": UPDATE_PLAN_PROMPT_EN,
}

def get_update_plan_prompt(advise: str, current_plan: str, lang: str = "zh", context: str = None, category: str = None) -> str:
    """
    Generates the plan update prompt by formatting the template.

    Args:
        advise: The user's modification requirements.
        current_plan: The current learning plan in JSON format.
        lang: The language of the prompt ("zh" or "en").
        context: Optional context information.
        category: The category of learning plan (e.g., "coding", "data_science", etc.)

    Returns:
        The formatted prompt string.
    """
    prompt_template = PROMPTS.get(lang, UPDATE_PLAN_PROMPT_ZH)
    format_context=""
    if lang=="zh":
      if context:
        format_context=f"请参考这些文档内容，并结合用户的学习目标，修改学习计划。\n{context}"
    else:
      if context:
        format_context=f"Here are the relevant documents , please refer to these document contents and modify the learning plan.\n{context}"
    
    # 根据category动态调整prompt中的任务类型限制
    if category == "coding":
        if lang == "zh":
            # 替换中文prompt中关于任务类型的限制，允许quiz和coding
            prompt_template = prompt_template.replace('### 练习类型\n应该从quiz中选择',
                                                     '### 练习类型\n应该从quiz或coding中选择，其中coding适用于需要编程实践的步骤')
            # 更新输出格式的示例
            prompt_template = prompt_template.replace('"type":"quiz"',
                                                     '"type":"quiz/coding"')
        else:
            # 替换英文prompt中关于任务类型的限制，允许quiz和coding
            prompt_template = prompt_template.replace('### Exercise Type\nShould be chosen from `quiz`.',
                                                     '### Exercise Type\nShould be chosen from `quiz` or `coding`, where `coding` is appropriate for steps requiring programming practice.')
            # 更新输出格式的示例
            prompt_template = prompt_template.replace('"type": "quiz"',
                                                     '"type": "quiz/coding"')
    
    prompt=prompt_template.format(
        advise=advise,
        current_plan=current_plan,
        context=format_context
    )
    prompt=prompt.replace("<placeholder>",str(PLAN_STEP_LEN))
    return prompt