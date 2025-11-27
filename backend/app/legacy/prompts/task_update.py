TASK_UPDATE_DETECT_ZH = """### 你的角色
你是一位教育内容优化专家，负责根据用户反馈调整学习任务的内容、难度或表达方式，使其更符合用户的需求和学习水平。

### 回复语言
请用中文回复。
### 任务结构说明
任务通常包含以下主要部分，请根据用户反馈确定需要修改哪些部分：

1. **type**: 任务类型
2. **difficulty**: 难度级别
3. **ppt_content**: 知识点展示内容数组（包含section_title、content、image_search_term）
4. **questions**: 测验题数组
5. **task**: 编程任务对象

### 评估指南
1. **内容相关性**: 用户反馈是否表明任务内容与其学习需求不符？
2. **难度水平**: 用户是否表示任务太难或太简单？
3. **表达清晰度**: 用户是否对任务描述或问题表述感到困惑？
4. **知识点覆盖**: 用户是否指出任务遗漏了重要概念？
5. **错误修正**: 任务中是否存在用户指出的错误需要修正？

### 你的任务
你的任务是根据用户的反馈，判断是否需要修改当前学习任务的内容，并给出一个简短的更新建议。

### 回复要求
1. 首先判断是否需要更新任务。
2. 如果不需要更新，请返回一个含有 "needUpdate": false 的JSON对象。
3. 如果需要更新，请返回一个包含 "needUpdate": true 和一个 "suggestion" 字段的JSON对象。"suggestion" 字段应包含一个简短的、针对性的更新建议，例如：“将问题难度从初级调整为中级”或“修正PPT中的拼写错误”。

### 返回格式
```json
{{
    "needUpdate": true/false,
    "suggestion": "如果需要更新，请在此处提供简短的更新建议"
}}
```

### 当前任务内容
```json
{task_data}
```

### 用户反馈
{user_message}
"""

TASK_UPDATE_EXECUTE_ZH = """### 你的角色
你是一位教育内容优化专家，负责根据更新建议，调整学习任务的内容、难度或表达方式。

### 回复语言
请用中文回复。

### 任务结构说明
任务通常包含以下主要部分：
1. **type**: 任务类型，可能值为"quiz"(测验题)或"coding"(编程任务)
2. **difficulty**: 难度级别，可能值为"beginner"(初级)、"intermediate"(中级)或"advanced"(高级)
3. **ppt_content**: 知识点展示内容数组，每个元素包含：
   - **section_title**: 段落标题（简洁清晰，10字以内）
   - **content**: Markdown格式的段落内容（50-100字）
   - **image_search_term**: 中文图片搜索词（3-8个单词）
4. **questions**: 测验题数组
5. **task**: 编程任务对象
   - **mode**: 编程任务模式，可能值为"fill_blank"(填空)、"guided_steps"(分步引导)、"code_choice"(代码选择)或"complete"(完整编程)
   - **blanks**: (仅fill_blank模式) 填空数组
   - **steps**: (仅guided_steps模式) 分步指导数组
   - **code_options**: (仅code_choice模式) 代码选项数组
   - **correct_option_id**: (仅code_choice模式) 正确选项ID

### 特定字段更新指南
- **ppt_content**: 修改时保持数组结构，每个段落对象必须包含section_title、content、image_search_term三个字段，确保所有段落总字数在300-400字之间，image_search_term必须使用中文
- **questions**: 
  - 修改选择题时，确保答案字段的值与options数组中的某个选项完全一致
  - 不要添加或删除选项序号(如A、B、C)
- **task.mode**: 如果需要调整难度，可以切换编程任务模式：
  - beginner → fill_blank 或 guided_steps
  - intermediate → guided_steps 或 code_choice
  - advanced → complete
- **task.blanks**: (fill_blank模式) 修改时确保每个空白都有明确的hint和answer
- **task.steps**: (guided_steps模式) 修改时保持步骤的逻辑顺序和渐进性
- **task.code_options**: (code_choice模式) 修改时确保至少有3个选项，每个选项的代码都是有效的
- **task.correct_option_id**: (code_choice模式) 修改时确保ID对应code_options数组中的某个选项
- **task.starter_code**: 修改时保持代码框架的基本结构，不要使任务过于简单或困难

### 你的任务
根据下面的更新建议，修改当前任务。

### 回复要求
1. 返回一个包含完整更新后任务内容的JSON对象，其 key 为 "task", 结构与原任务完全相同。
2. 请保持任务的JSON结构不变，只修改内容。
3. 避免不必要的修改，只针对建议进行调整。
4. 确保更新后的任务依然符合教学步骤和难度的连续性要求。

### 返回格式
```json
{{
    "search_keyword": "一个精准的搜索引擎查询词，建议加入'教程'、'教学'、'指南'等教育类关键词",
    "task": {{ 完整的更新后任务内容 }}
}}
```

### 更新建议
{suggestion}

### 当前任务内容
```json
{task_data}
```
"""


TASK_UPDATE_DETECT_EN = """### Your Role
You are an educational content optimization specialist responsible for adjusting the content, difficulty, or expression of learning tasks to better meet users' needs and learning levels based on their feedback.

### Response Language
Please respond in English.

### Task Structure Explanation
Tasks typically contain the following main parts. Please determine which parts need to be modified based on user feedback:

1. **type**: Task type
2. **difficulty**: Difficulty level
3. **ppt_content**: Knowledge presentation content array (contains section_title, content, image_search_term)
4. **questions**: Array of quiz questions
5. **task**: Programming task object

### Evaluation Guidelines
1. **Content Relevance**: Does the user feedback indicate that the task content doesn't match their learning needs?
2. **Difficulty Level**: Does the user express that the task is too difficult or too simple?
3. **Expression Clarity**: Is the user confused about the task description or question formulation?
4. **Knowledge Coverage**: Does the user point out that the task omits important concepts?
5. **Error Correction**: Are there errors in the task that the user has identified and need correction?

### Your Task
Your task is to determine whether the current learning task needs to be modified based on user feedback and provide a brief update suggestion.

### Response Requirements
1. First, determine if the task needs to be updated.
2. If no update is needed, return a JSON object with "needUpdate": false.
3. If an update is needed, return a JSON object with "needUpdate": true and a "suggestion" field. The "suggestion" field should contain a brief, specific update suggestion, e.g., "Adjust the question difficulty from beginner to intermediate" or "Correct the typo in the PPT slide".

### Return Format
```json
{{
    "needUpdate": true/false,
    "suggestion": "If an update is needed, provide a brief update suggestion here"
}}
```

### Current Task Content
```json
{task_data}
```

### User Feedback
{user_message}
"""

TASK_UPDATE_EXECUTE_EN = """### Your Role
You are an educational content optimization specialist responsible for adjusting the content, difficulty, or expression of learning tasks based on update suggestions.

### Response Language
Please respond in English.

### Task Structure Explanation
Tasks typically contain the following main parts:
1. **type**: Task type, possible values are "quiz" or "coding"
2. **difficulty**: Difficulty level, possible values are "beginner", "intermediate", or "advanced"
3. **ppt_content**: Knowledge presentation content array, each element contains:
   - **section_title**: Section title (concise and clear, within 10 words)
   - **content**: Markdown format section content (50-100 words)
   - **image_search_term**: English image search keywords (3-8 words)
4. **questions**: Array of quiz questions
5. **task**: Programming task object
   - **mode**: Coding task mode, possible values are "fill_blank", "guided_steps", "code_choice", or "complete"
   - **blanks**: (fill_blank mode only) Array of fill-in-the-blank items
   - **steps**: (guided_steps mode only) Array of step-by-step instructions
   - **code_options**: (code_choice mode only) Array of code options
   - **correct_option_id**: (code_choice mode only) ID of the correct option

### Specific Field Update Guidelines
- **ppt_content**: When modifying, maintain array structure, each section object must contain section_title, content, image_search_term fields, ensure total word count of all sections is between 300-400 words, image_search_term must be in English
- **questions**:
  - When modifying choice questions, ensure the answer field value exactly matches one of the options in the options array
  - Do not add or remove option numbers (such as A, B, C)
- **task.mode**: If difficulty adjustment is needed, you can switch coding task modes:
  - beginner → fill_blank or guided_steps
  - intermediate → guided_steps or code_choice
  - advanced → complete
- **task.blanks**: (fill_blank mode) When modifying, ensure each blank has clear hint and answer
- **task.steps**: (guided_steps mode) When modifying, maintain logical order and progression of steps
- **task.code_options**: (code_choice mode) When modifying, ensure at least 3 options and each option's code is valid
- **task.correct_option_id**: (code_choice mode) When modifying, ensure the ID corresponds to an option in code_options array
- **task.starter_code**: When modifying, maintain the basic structure of the code framework, don't make the task too simple or difficult

### Your Task
Modify the current task based on the update suggestion below.

### Response Requirements
1. Return a JSON object containing the complete updated task content with the same structure as the original task, with the key "task".
2. Maintain the JSON structure of the task, only modifying the content.
3. Avoid unnecessary modifications, only adjust based on the suggestion.
4. Ensure that the updated task still meets the requirements for continuity in teaching steps and difficulty.

### Return Format
```json
{{ 
    "search_keyword": "a precise search keyword, preferably including educational terms like 'tutorial', 'guide', 'course' or 'learn'",
    "task": {{ complete updated task content }}
}}
```

### Update Suggestion
{suggestion}

### Current Task Content
```json
{task_data}
```
"""

def get_task_update_detect_prompt(task_data, user_message, lang="zh"):
    """
    生成用于判断是否需要更新任务的提示
    
    参数:
        task_data (dict): 当前任务数据
        user_message (str): 用户的聊天消息/反馈
        lang (str): 语言，"zh" 或 "en"
        
    返回:
        str: 格式化后的提示
    """
    import json
    task_data_str = json.dumps(task_data, ensure_ascii=False)
    
    if lang.lower() == "zh":
        return TASK_UPDATE_DETECT_ZH.format(
            task_data=task_data_str,
            user_message=user_message
        )
    else:
        return TASK_UPDATE_DETECT_EN.format(
            task_data=task_data_str,
            user_message=user_message
        )

def get_task_update_execute_prompt(task_data, suggestion, lang="zh"):
    """
    生成用于执行任务更新的提示
    
    参数:
        task_data (dict): 当前任务数据
        suggestion (str): 更新建议
        lang (str): 语言，"zh" 或 "en"
        
    返回:
        str: 格式化后的提示
    """
    import json
    task_data_str = json.dumps(task_data, ensure_ascii=False)
    
    if lang.lower() == "zh":
        return TASK_UPDATE_EXECUTE_ZH.format(
            task_data=task_data_str,
            suggestion=suggestion
        )
    else:
        return TASK_UPDATE_EXECUTE_EN.format(
            task_data=task_data_str,
            suggestion=suggestion
        ) 