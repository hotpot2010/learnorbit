"""生成推荐问题的提示模板 (针对新任务)。"""

QUESTION_SUGGESTION_EN="""
You are an expert AI Tutor observing a student working on a specific learning task. Based on the task details, your goal is to recommend three concise and relevant questions that the student might ask if they get stuck or want to deepen their understanding.

**Current Task:**
Title: {task_title}
Description: {task_description}

**Instructions:**

1.  **Analyze the Task**: Carefully review the task title and description to understand its core concepts and objectives.
2.  **Identify Potential Hurdles**: Pinpoint key areas where a student might struggle, get confused, or need further clarification.
3.  **Generate Questions**: Formulate three distinct and helpful questions that are **directly relevant** to the current task.
4.  **Adopt Student Persona**: Phrase the questions naturally, as a student would (e.g., "How does X work?", "What is the difference between Y and Z?", "Can you explain concept A in simpler terms?").
5.  **Ensure Relevance and Brevity**: The questions must be concise and directly contribute to completing or better understanding the task.
6.  **Language Requirement**: All recommended questions must be in **English**.
7.  **Strict Output Format**: Provide your response **only** in the following JSON format. Do not add any introductory text, explanations, or markdown formatting before or after the JSON block.

```json
{{
  "recommended_questions": [
    "<English Question 1>",
    "<English Question 2>",
    "<English Question 3>"
  ]
}}
```

**Suggested Questions (JSON output only):**
"""
QUESTION_SUGGESTION_ZH="""
您是一位专业的 AI 导师 (AI Tutor)，正在观察一位学生完成特定的学习任务。请根据任务详情，推荐3个简明扼要的问题，这些问题是学生在遇到困难或希望加深理解时可能会问的。

**当前任务 (Current Task):**
标题 (Title): {task_title}
描述 (Description): {task_description}

**指令 (Instructions):**

1.  分析任务标题和描述。
2.  找出学生可能感到困惑的关键点，或需要进一步澄清和探索的领域。
3.  生成与此任务*直接相关*的3个不同且有帮助的问题。
4.  问题应以学生自然的提问方式表述（例如：“X 是如何工作的？”、“Y 和 Z 有什么区别？”、“能否用更简单的话解释一下概念 A？”）。
5.  确保问题简洁，并且与完成或理解当前任务直接相关。
6.  **所有推荐的问题必须使用中文。**
7.  请**仅**以如下 JSON 格式提供您推荐的问题。在 JSON 数据块前后不要添加任何其他文本、解释或 markdown 格式。

```json
{{
  "recommended_questions": [
    "<中文问题 1>",
    "<中文问题 2>",
    "<中文问题 3>"
  ]
}}
```

**推荐问题 (Suggested Questions) (仅输出中文 JSON):**
"""

def get_question_suggestion_prompt(task_title: str, task_description: str,lang="zh") -> str:
    """
    为一个用户正在进行的学习任务生成有帮助的推荐问题。

    Args:
        task_title: 当前学习任务的标题。
        task_description: 当前学习任务的描述。

    Returns:
        格式化后的提示字符串。
    """
    prompt_template = QUESTION_SUGGESTION_ZH if lang == "zh" else QUESTION_SUGGESTION_EN
    prompt = prompt_template.format(task_title=task_title,task_description=task_description)
    return prompt 