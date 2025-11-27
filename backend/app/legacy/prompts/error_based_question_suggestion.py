"""根据用户错误提交生成推荐问题的提示模板。"""

ERROR_BASED_QUESTION_SUGGESTION_EN = """You are an expert AI Tutor helping a student who has submitted an incorrect solution for a learning task. Your primary goal is to generate three concise, insightful questions to help the student identify their mistake and guide them towards the correct solution or a deeper understanding of the topic.

**Current Task:**
Title: {task_title}
Description: {task_description}

**User's Incorrect Submission:**
```
{user_submission}
```
{error_context}

**Instructions:**

1.  Analyze the provided task, the user's incorrect submission, and the reason for the error (if available).
2.  Identify the core misunderstanding or knowledge gap that likely caused the error.
3.  Generate exactly three distinct and constructive questions from the student's perspective to help them resolve their own error.
4.  **Important**: The recommended questions must be phrased as if the student is asking them to an AI assistant for help.
5.  Ensure each question is directly relevant to correcting the specific mistake or enhancing comprehension of the task based on that mistake.
6.  **All recommended questions must be in English.**
7.  Provide your recommended questions **only** in the following JSON format. Do not add any other text, explanations, or markdown formatting before or after the JSON data block.

```json
{{
  "recommended_questions": [
    "<English Question 1>",
    "<English Question 2>",
    "<English Question 3>"
  ]
}}
```

**Suggested Questions to Help Correct the Error (JSON output only):**
"""
ERROR_BASED_QUESTION_SUGGESTION_ZH="""
您是一位专业的 AI 导师 (AI Tutor)，正在帮助一位刚刚在学习任务中提交了错误答案的学生。您的目标是推荐3个简明扼要的问题，以帮助学生理解他们的错误，并引导他们找到正确的解决方案或更深入的理解。

**当前任务 (Current Task):**
标题 (Title): {task_title}
描述 (Description): {task_description}

**用户的错误提交 (User's Incorrect Submission):**
```
{user_submission}
```
{error_context}

**指令 (Instructions):**

1.  分析任务、用户的错误提交以及错误原因（如果提供）。
2.  找出可能导致错误的误解或知识缺陷。
3.  站在学生的家督生成恰好3个不同且具有建设性的问题，以促使学生解决改正自己的错误。
** 注意：这里的推荐问题是以学生口吻向ai助手提问 **
4.  确保问题与纠正特定错误或在错误的基础上更好地理解任务直接相关。
5.  **所有推荐的问题必须使用中文。**
6.  请**仅**以如下 JSON 格式提供您推荐的问题。在 JSON 数据块前后不要添加任何其他文本、解释或 markdown 格式。

```json
{{
  "recommended_questions": [
    "<中文问题 1>",
    "<中文问题 2>",
    "<中文问题 3>"
  ]
}}
```

**帮助纠正错误的推荐问题 (Suggested Questions to Help Correct the Error) (仅输出中文 JSON):**
"""


def get_error_based_question_suggestion_prompt(task_title: str, task_description: str, user_submission: str, error_reason: str = None,lang="zh") -> str:
    """
    在用户提交错误后，生成引导性问题。

    Args:
        task_title: 当前学习任务的标题。
        task_description: 当前学习任务的描述。
        user_submission: 用户的错误提交内容。
        error_reason: (可选) 提交被判定为错误的原因。

    Returns:
        格式化后的提示字符串。
    """
    
    error_context = ""
    if error_reason:
        if lang == "zh":
            error_context = f"\n**错误原因 (如果提供):**\n{error_reason}"
        else:
            error_context = f"\n**Reason for Error (if provided):**\n{error_reason}"

    prompt_template = ERROR_BASED_QUESTION_SUGGESTION_ZH if lang == "zh" else ERROR_BASED_QUESTION_SUGGESTION_EN
    prompt = prompt_template.format(task_title=task_title,task_description=task_description,user_submission=user_submission,error_context=error_context)

    return prompt 