"""AI 助手聊天功能的 System Prompt。"""

BASE_SYSTEM_PROMPT = """
你是"AI 学习助手"，一个友善、耐心且专业的 AI 导师。
你的主要目标是帮助用户学习知识、解决他们遇到的具体学习问题或编程难题。
请根据用户的提问提供清晰、准确、有帮助的回答。
如果用户的问题不清晰，请主动提问以澄清。
保持积极和鼓励的语气。

**回答要求**
1. 尽可能简短回答，不要超过100字。
2. markdown格式输出。
3. 不要直接给出答案，而是相关知识和思路。
4. 合理换行，更清晰展示回答。
"""

TASK_CONTEXT_SUFFIX = """

**当前学习任务上下文:**
学生目前正在处理以下内容：
{task_context_details}
请在回答用户问题时，尽可能地结合这个任务背景，提供更具针对性的指导和解答。
"""

def get_assistant_system_prompt(task_data: dict = None) -> str:
    """
    生成 AI 助手聊天时使用的 System Prompt。

    Args:
        task_data (dict, optional): 当前学习任务的 JSON 对象，
                                   包含任务类型、问题和答案等信息。

    Returns:
        str: 最终的 System Prompt 字符串。
    """
    system_prompt = BASE_SYSTEM_PROMPT
    
    if task_data:
        task_context_details_parts = []
        task_type = task_data.get("type")

        try:
            if task_type == "quiz":
                questions = task_data.get("questions")
                if questions and isinstance(questions, list) and len(questions) > 0:
                    task_context_details_parts.append("当前测验题目与参考答案：")
                    for i, q_item in enumerate(questions):
                        question_text = q_item.get("question", "未提供问题内容")
                        answer_text = q_item.get("answer", "未提供答案")
                        task_context_details_parts.append(f"{i+1}. 问题: {question_text}\\n   参考答案: {answer_text}")
                else:
                    task_context_details_parts.append("测验题目信息不完整或未提供。")

            elif task_type == "coding":
                task_details = task_data.get("task")
                if task_details:
                    description = task_details.get("description", "未提供任务描述")
                    answer = task_details.get("answer", "未提供答案")
                    task_context_details_parts.append(f"当前编程任务描述: {description}\\n参考答案: {answer}")
                else:
                    task_context_details_parts.append("编程任务信息不完整或未提供。")
            
            if task_context_details_parts: # Only add context if details were processed
                formatted_details = "\\n".join(task_context_details_parts)
                task_context = TASK_CONTEXT_SUFFIX.format(
                    task_context_details=formatted_details
                )
                system_prompt += task_context
            else:
                print(f"[System Prompt] 未能从 task_data 构建有效的任务上下文。task_type: {task_type}")

        except Exception as e:
            print(f"[System Prompt] 格式化任务上下文时出错: {e}")
            # 即使格式化失败，也继续使用基础 prompt

    return system_prompt 