EXTRACT_SEARCH_KEYWORDS_PROMPT_ZH = """
你是一个为学习者生成精准【教育资源】搜索查询的专家。

## 核心任务
从用户对话中，提炼出1个可以直接用于搜索引擎的高质量搜索查询。

## 指导原则
1.  **深挖意图**: 你的首要任务是理解用户是想【学概念】、【看代码】、【找教程】还是【做项目】。查询中必须体现这个意图。
2.  **组合"主题"与"动作"**: 永远不要只提取一个名词。必须将核心技术主题与一个学习动作（如：原理, 教程, 代码实践, 入门, 实现方法）结合起来。
3.  **多样化查询**: 生成几个不同角度的查询，以增加找到高质量资源的机会。例如，一个侧重理论，一个侧重实践。
4.  **精炼直接**: 丢弃所有口语化的废话，只保留最核心的术语。查询结果必须是干净、可以直接复制粘贴的。

## 输出格式
- 直接输出1个搜索查询
- **绝对不要**包含任何JSON、Markdown、引号或者其他解释性文字。
---

## 示例

**输入对话**:
"我想学习Python爬虫，特别是如何处理动态网页和反爬虫机制，有什么好的教程推荐吗？"

**输出**:
Python爬虫处理动态网页教程

---

现在，请分析以下对话，并严格按照上述规则生成搜索查询
{user_conversation}
"""

EXTRACT_SEARCH_KEYWORDS_PROMPT_EN = """
You are an expert at generating precise search queries for educational resources for learners.

## Core Task
Extract ONE high-quality search query from the user's conversation that can be directly used in a search engine.

## Guiding Principles
1.  **Dig Deep into Intent**: Your primary task is to understand whether the user wants to [learn concepts], [see code], [find tutorials], or [work on projects]. The query MUST reflect this intent.
2.  **Combine "Topic" with "Action"**: Never extract just a noun. You MUST combine the core technical topic with a learning action (e.g., fundamentals, tutorial, code examples, getting started, implementation guide).
3.  **Diversify Queries**: Generate a few queries from different angles to increase the chances of finding high-quality resources. For example, one focusing on theory, another on practice.
4.  **Refine and Be Direct**: Strip away all conversational fluff and keep only the core terms. The query result must be clean and ready to copy-paste.

## Output Format
- Output 1 search query directly
- **NEVER** include any JSON, Markdown, quotes, or explanatory text.
---

## Example

**Input Conversation**:
"I want to learn Python web scraping, especially how to handle dynamic web pages and anti-scraping mechanisms. Any good tutorial recommendations?"

**Output**:
Python web scraping dynamic pages tutorial

---

Now, analyze the following conversation and generate a search query strictly following the rules above:
{user_conversation}
"""

def get_extract_keywords_prompt(conversation: str|list, lang: str = 'en') -> str:
    """
    获取提取搜索关键词的提示词
    
    Args:
        conversation: 用户对话内容
        lang: 语言选择，'en' 为英文（默认），'zh' 或 'cn' 为中文
        
    Returns:
        str: 完整的提示词
    """
    if isinstance(conversation, list):
        if lang in ['zh', 'cn']:
            conversation = "\n".join([f"用户：{msg['role']}\n{msg['content']}" for msg in conversation])
        else:
            conversation = "\n".join([f"User: {msg['role']}\n{msg['content']}" for msg in conversation])
    
    # 根据语言选择对应的 prompt 模板
    if lang in ['zh', 'cn']:
        prompt_template = EXTRACT_SEARCH_KEYWORDS_PROMPT_ZH
    else:
        prompt_template = EXTRACT_SEARCH_KEYWORDS_PROMPT_EN
    
    return prompt_template.format(user_conversation=conversation)
