TASK_GENERATION_ZH="""请根据以下任务描述为用户生成一个学习任务，包含PPT内容和相应的测验题或编程任务。

### 任务描述
{task_description}
{type_difficulty_section}

{previous_steps_context_section}

### 角色定义  
您是具有课程设计经验的教育学专家，擅长使用「逆向教学设计法」与「布鲁姆认知分层模型」构建学习路径。

### 核心约束  
对于给定的学习任务，需要设计1-3道题目来帮助学生掌握核心内容：
- 如果是概念性学习任务：生成1-3道选择题
- 如果是实践性学习任务：生成1道编程题或操作题
- 每道选择题提供3个备选答案
- 题目难度应当循序渐进，从基础理解到应用实践

### 内容范围控制（重要）
**如果提供了课程内容参考，请严格遵循以下原则：**
1. **主题匹配**：只使用与任务描述主题完全匹配的课程内容
2. **步骤对应**：确保引用的概念和示例适合当前学习步骤的水平
3. **内容筛选**：主动过滤掉属于其他主题或后续步骤的内容
4. **边界清晰**：如果课程内容包含多个主题，只选择与当前任务相关的部分
5. **避免超前**：绝对不要提及需要后续步骤才能理解的高级概念

**示例说明：**
- 如果当前任务是"理解变量概念"，不要引入"面向对象编程"的内容
- 如果当前任务是"基础排序"，不要提及"高级算法优化"
- 如果当前任务是"函数基础"，不要讨论"递归和动态规划"

同时，为这个学习任务创建一个详细的PPT式知识展示页面，包含：
- 简洁明了的标题（必须与当前任务主题完全对应）
- 3-6个核心知识点段落，每个段落涵盖重要概念、原理和实践要点
- 必要时包含动画演示说明（仅展示当前步骤相关的演示，且只能使用maze_demo或table_demo）

### PPT内容要求
1. **核心聚焦于任务描述**: 所有内容都必须严格围绕 `任务描述` 展开。将其作为核心，从不同角度（例如'是什么'、'为什么重要'、'如何实现'、'关键代码示例'、'常见误区'等）进行深入剖析和讲解，确保内容有深度、有广度。
2. **结构化格式**: `ppt_content` 字段必须是一个数组，包含3-6个段落对象，每个对象包含：
   - `section_title`: 段落标题（简洁清晰，10字以内）
   - `content`: 段落内容（Markdown格式，详细讲解该段落主题，每段50-100字）
   - `image_search_term`: 图片搜索词（中文，精准描述该段落需要的配图，3-8个单词；如不需要图片则为空字符串""）
3. **内容丰富，字数达标**: **所有段落的总字数必须在300-400字之间**。请务必达到这个字数要求，内容需要有深度，为每个段落提供详尽的解释、示例或者代码片段，而不仅仅是概念的罗列。
4. **知识覆盖准确**: 确保内容与当前任务主题完全对应，不多不少。
5. **逻辑严谨**: 按照"概念理解 → 原理解释 → 实践应用"的逻辑组织段落顺序，并与多角度分析相结合。
6. **深度适中**: 每个知识点的解释深度要与当前学习步骤匹配，避免引入超前内容。
7. **图片搜索词要求（智能选择）**: 
   - **不是每个段落都需要图片**，请根据以下标准自主判断：
     * 该段落内容较为抽象或复杂，图片能帮助理解（如架构图、流程图、概念图）
     * 该段落的主题适合视觉化展示（如数据结构、算法步骤、代码执行过程）
     * 该主题能搜索到高质量、美观的教育类配图
   - 如果段落不需要图片，`image_search_term` 应设为空字符串 `""`
   - 当需要图片时：
     * 必须使用中文，便于图片搜索引擎检索
     * 应精准描述该段落需要的配图类型（如"python变量概念图"、"数据类型比较图"）
     * 优先使用教育类关键词（如"教程"、"图表"、"插图"、"概念"、"示例"）
     * 避免过于宽泛或模糊的词汇
   - **建议**: 通常在3-6个段落中，选择1-3个最需要视觉辅助的段落配图即可

### 题目设计要求
1. **题目数量**：根据任务复杂度生成3道题目
2. **题目类型多样**：可以包含选择题、计算题、编程题等
3. **难度递进**：从基础概念理解到综合应用，但不超出当前步骤范围
4. **实用性强**：每道题都应该检验当前学习任务中的核心知识点
5. **内容边界明确**：题目内容必须严格限制在当前步骤的知识范围内

### 编程任务模式（重要）
针对不同学习水平的用户，编程任务支持4种模式，请根据difficulty和任务特点自动选择：

**1. fill_blank（填空模式）- 适合 beginner**
- 提供几乎完整的代码，只留2-4个关键空白处
- 每个空白处提供明确的提示
- 适用场景：简单的语法练习、单一概念应用、基础代码补全
- 示例：`result = _____ # 填空：使用+运算符计算a和b的和`

**2. guided_steps（分步引导模式）- 适合 beginner/intermediate**
- 将完整任务拆分成3-5个小步骤
- 每步只完成一小部分功能
- 每步提供独立的提示和验证点
- **适用场景（优先考虑）**：
  * 需要构建完整函数或程序的任务（如实现查找、排序、计算函数）
  * 涉及多个逻辑步骤的任务（如初始化→循环→判断→返回）
  * 需要学习者理解代码构建过程的任务
  * 任务描述包含"实现"、"编写函数"、"构建"等动词
- **何时必须使用guided_steps**：当任务要求学习者"编写完整函数"或"实现某个功能"时

**3. code_choice（代码选择模式）- 适合 intermediate**
- 提供一个编程场景或问题描述
- 给出3-4个代码片段选项
- 学习者需要选择正确的代码实现
- 侧重理解代码逻辑和语法，无需手写代码
- 适用场景：比较不同实现方式、理解代码逻辑、语法理解

**4. complete（完整编程模式）- 适合 intermediate/advanced**
- 传统的完整编程任务
- 提供基本的代码框架
- 需要学习者独立完成主要逻辑
- 适用场景：综合应用、项目实践、高级算法

### 格式要求（重要）
1. 选择题答案格式：答案必须是选项的完整文本内容，而非字母编号（如A、B、C）
2. 所有选择题答案必须与选项数组中的某一项完全一致
3. 不要在选项文本内包含编号（如"A. 选项内容"），应该只包含选项内容本身
4. 确保每道题的答案都存在于对应的选项数组中
5. **PPT内容格式**:
   - `ppt_content`字段的值必须是一个数组，包含3-6个段落对象
   - 每个段落对象包含三个必需字段：`section_title`（段落标题）、`content`（Markdown格式内容）、`image_search_term`（中文搜索词，可为空字符串""）
   - **内容应丰富详实，所有段落总字数必须在300-400字之间。请在每个段落提供详尽的说明。**
   - **图片选择策略**：并非所有段落都需要配图，请智能判断哪些段落最需要视觉辅助，通常选择1-3个段落配图即可
6. 编程任务的starter_code应当提供有意义的代码框架
7. **JSON格式严格要求**：
   - 绝对不要在JSON字符串值中使用markdown代码块（```）
   - 所有特殊字符必须正确转义
   - content数组中的每个元素都必须是有效的JSON字符串
   - 动画指令应该作为普通字符串，不要使用代码块格式
8. **文档引用**: 如果在“相关文档上下文”部分提供了带编号的参考文档，请在返回的JSON中添加一个 `references` 字段，用数组格式记录主要参考的文档编号，例如：`"references": [1, 3, 5]`。如果没有参考特定文档，则设置为空数组 `[]`。
请以JSON格式返回任务内容，格式如下：
{{
    "type": "quiz" 或 "coding",
    "difficulty": "beginner/advanced/intermediate",
    "references": [],
    "ppt_content": [
        {{
            "section_title": "段落标题1（简洁清晰，10字以内）",
            "content": "段落内容1，Markdown格式，详细讲解该段落主题，50-100字",
            "image_search_term": "与content相关的精准搜索词"
        }},
        {{
            "section_title": "段落标题2",
            "content": "段落内容2，Markdown格式，继续深入讲解",
            "image_search_term": ""
        }},
        {{
            "section_title": "段落标题3",
            "content": "段落内容3，可以包含代码示例、列表等Markdown元素",
            "image_search_term": "另一个精准搜索词"
        }}
    ],
    "questions": [
        {{
            "question": "问题内容（要具体明确，且严格限制在当前步骤知识范围内）",
            "type": "choice",
            "options": ["选项内容1", "选项内容2", "选项内容3"],
            "answer": "答案内容"
        }},
        {{
            "question": "第二道题问题内容（同样限制在当前步骤范围内）",
            "type": "choice",
            "options": ["选项1", "选项2", "选项3"],
            "answer": "正确答案"
        }}
    ],
    "task": {{
        "title": "编程任务标题（简洁明确，概括任务要求）",
        "description": "详细的任务描述，包含具体要求和预期结果（限制在当前步骤能力范围内）",
        "mode": "fill_blank|guided_steps|code_choice|complete (根据difficulty选择)",
        "starter_code": "有意义的代码框架（难度适合当前步骤）",
        "answer": "完整的正确答案代码（使用当前步骤的知识）",
        
        // 以下字段根据mode选择性包含：
        
        // 如果 mode = "fill_blank"，必须包含：
        "blanks": [
            {{
                "id": 1,
                "placeholder": "_____",
                "hint": "提示：使用+运算符",
                "answer": "a + b",
                "position": {{
                    "line": 2,
                    "column": 12
                }}
            }}
        ],
        
        // 如果 mode = "guided_steps"，必须包含：
        "steps": [
            {{
                "step": 1,
                "instruction": "首先，定义函数名和参数",
                "starter_code": "def calculate_sum(_____, _____):\\n    pass",
                "hint": "函数需要接收两个数字参数",
                "expected_code": "def calculate_sum(a, b):"
            }}
        ],
        
        // 如果 mode = "code_choice"，必须包含：
        "question": "编程问题或场景描述",
        "code_options": [
            {{
                "id": 1,
                "code": "选项1的代码",
                "explanation": "这个选项的说明（可选）"
            }},
            {{
                "id": 2,
                "code": "选项2的代码",
                "explanation": "这个选项的说明（可选）"
            }},
            {{
                "id": 3,
                "code": "选项3的代码",
                "explanation": "这个选项的说明（可选）"
            }}
        ],
        "correct_option_id": 2,
        "explanation": "为什么这个选项是正确的详细解释"
    }}
}}

**最终提醒**：
1. 请确保返回的是严格有效的JSON格式
2. 所有换行符在JSON字符串中必须转义为\\n
3. 不要在JSON中包含注释（//）
4. **内容范围控制**：严格确保所有生成的内容（PPT、题目、代码）都限制在当前步骤的知识范围内，不要超前引入后续步骤的概念
5. 请根据任务描述的内容和复杂度，判断是生成测验题还是编程任务，并确定合适的题目数量（1-3道）。如果是编程相关的任务，请生成编程任务；如果是概念性或知识性的任务，请生成测验题。
6. **编程任务模式选择（重要决策流程）**：
   - 首先判断任务类型：
     * 如果任务是"实现函数"、"编写程序"、"构建逻辑" → **优先使用 guided_steps**
     * 如果任务是"理解代码"、"比较实现" → 使用 code_choice
     * 如果任务是"简单语法练习" → 使用 fill_blank
   - 然后根据difficulty调整：
     * difficulty = "beginner" + 实现类任务 → **guided_steps**（将任务分解为简单步骤）
     * difficulty = "beginner" + 语法练习 → fill_blank
     * difficulty = "intermediate" + 实现类任务 → **guided_steps**（步骤可以更复杂）
     * difficulty = "intermediate" + 理解类任务 → code_choice
     * difficulty = "advanced" → complete
   - **特别强调**：对于beginner和intermediate级别的"编程实践"类任务，应该优先选择guided_steps模式，而不是code_choice！
7. **模式特定字段**：根据选择的mode，只包含该模式需要的额外字段（blanks、steps或code_options），不要包含其他模式的字段"""

TASK_GENERATION_EN="""Please generate a learning task for the user based on the following task description. The task should include presentation content (like a PPT slide) and a corresponding quiz or coding challenge.

### Task Description
{task_description}
{type_difficulty_section}

{previous_steps_context_section}

### Role Definition
You are an expert in instructional design, specializing in creating learning paths using the "Backward Design" method and "Bloom's Taxonomy".

### Core Constraints
For the given learning task, you must design 1-3 questions to help the student master the core concepts:
- For conceptual learning tasks: Generate 1-3 multiple-choice questions.
- For practical, hands-on tasks: Generate 1 coding or operational task.
- Each multiple-choice question should have 3 options.
- The difficulty of the questions should be progressive, from basic understanding to practical application.

### Content Scope Control (Crucial)
**If reference course content is provided, you must strictly adhere to the following principles:**
1.  **Topic Matching**: Only use course content that perfectly matches the topic of the task description.
2.  **Step Alignment**: Ensure that the concepts and examples used are appropriate for the current learning step's level.
3.  **Content Filtering**: Actively filter out content that belongs to other topics or subsequent steps.
4.  **Clear Boundaries**: If the course content covers multiple topics, select only the parts relevant to the current task.
5.  **Avoid Foreshadowing**: Absolutely do not mention advanced concepts that require knowledge from future steps to be understood.

**Examples:**
- If the current task is "Understanding Variables," do not introduce "Object-Oriented Programming" concepts.
- If the current task is "Basic Sorting," do not mention "Advanced Algorithm Optimization."
- If the current task is "Function Basics," do not discuss "Recursion and Dynamic Programming."

Simultaneously, create a detailed, PPT-style knowledge presentation page for this learning task, which includes:
- A concise title (must correspond exactly to the current task's topic).
- 3-6 key knowledge point sections, each covering important concepts, principles, and practical takeaways for the current step.
- When necessary, include animation demonstrations (only show demos relevant to the current step, and only use `maze_demo` or `table_demo`).

### PPT Content Requirements
1.  **Focus on the Task Description**: All content must be strictly centered around the `Task Description`. Use it as the core theme and elaborate from various angles (e.g., 'What it is', 'Why it's important', 'How to implement it', 'Key code examples', 'Common pitfalls') to ensure depth and breadth.
2.  **Structured Format**: The `ppt_content` field must be an array containing 3-6 section objects, each object including:
   - `section_title`: Section title (concise and clear, within 10 words)
   - `content`: Section content (Markdown format, detailed explanation of the section topic, 50-100 words per section)
   - `image_search_term`: Image search keywords (in English, precisely describing the illustration needed for this section, 3-8 words; empty string "" if no image is needed)
3.  **Rich Content, Word Count Target**: **The total word count of all sections must be between 300 and 400 words.** It is crucial to meet this requirement. The content needs to be in-depth, providing detailed explanations, examples, or code snippets for each section, not just a list of concepts.
4.  **Accurate Knowledge Coverage**: Ensure the content corresponds exactly to the current task topic—no more, no less.
5.  **Logical Flow**: Organize the sections following a logical progression: "Conceptual Understanding → Principle Explanation → Practical Application," combined with a multi-faceted analysis.
6.  **Appropriate Depth**: The depth of explanation for each knowledge point must match the current learning step, avoiding the introduction of advanced topics.
7.  **Image Search Term Requirements (Smart Selection)**: 
   - **Not every section needs an image**. Please make autonomous judgments based on these criteria:
     * The section content is abstract or complex, and an image would aid understanding (e.g., architecture diagrams, flowcharts, concept diagrams)
     * The section's topic is suitable for visual representation (e.g., data structures, algorithm steps, code execution process)
     * The topic can yield high-quality, visually appealing educational images
   - If a section doesn't need an image, set `image_search_term` to an empty string `""`
   - When an image is needed:
     * Must use English for better compatibility with image search engines
     * Should precisely describe the type of illustration needed for the section (e.g., "python variable concept diagram", "data types comparison chart")
     * Prioritize educational keywords (e.g., "tutorial", "diagram", "illustration", "concept", "example")
     * Avoid overly broad or vague terms
   - **Recommendation**: Among 3-6 sections, typically select 1-3 sections that most benefit from visual aids

### Quiz Design Requirements
1.  **Number of Questions**: Generate 3 questions based on the task's complexity.
2.  **Diverse Question Types**: May include multiple-choice, calculation, or coding questions.
3.  **Progressive Difficulty**: Difficulty should increase from basic conceptual understanding to integrated application, but must not exceed the scope of the current step.
4.  **High Practicality**: Each question should test a core knowledge point from the current learning task.
5.  **Clear Content Boundaries**: The content of the questions must be strictly limited to the knowledge scope of the current step.

### Coding Task Modes (Important)
For users with different skill levels, coding tasks support 4 modes. Please choose automatically based on difficulty and task characteristics:

**1. fill_blank (Fill-in-the-Blank Mode) - Suitable for beginner**
- Provide nearly complete code with only 2-4 key blanks
- Each blank has clear hints
- Use cases: Simple syntax practice, single concept application, basic code completion
- Example: `result = _____ # Fill in: use + operator to sum a and b`

**2. guided_steps (Step-by-Step Guidance Mode) - Suitable for beginner/intermediate**
- Break complete task into 3-5 small steps
- Each step completes only a small portion of functionality
- Each step has independent hints and validation points
- **Use cases (prioritize)**:
  * Tasks requiring building complete functions or programs (e.g., implement search, sort, calculation functions)
  * Tasks involving multiple logical steps (e.g., initialize → loop → condition → return)
  * Tasks where learners need to understand the code construction process
  * Task descriptions containing verbs like "implement", "write a function", "build"
- **When guided_steps is REQUIRED**: When the task asks learners to "write a complete function" or "implement a feature"

**3. code_choice (Code Choice Mode) - Suitable for intermediate**
- Provide a programming scenario or problem description
- Offer 3-4 code snippet options
- Learner needs to select the correct code implementation
- Focus on understanding code logic and syntax without writing code
- Use cases: Comparing different implementations, understanding code logic, syntax comprehension

**4. complete (Complete Programming Mode) - Suitable for intermediate/advanced**
- Traditional complete programming task
- Provide basic code framework
- Learner needs to complete main logic independently
- Use cases: Comprehensive application, project practice, advanced algorithms

### Formatting Requirements (Crucial)
1.  **Multiple-Choice Answer Format**: The answer must be the full text of the option, not a letter (e.g., A, B, C).
2.  **Answer-Option Consistency**: All multiple-choice answers must exactly match one of the items in the options array.
3.  **Clean Option Text**: Do not include prefixes like "A. " in the option text itself; it should only contain the option's content.
4.  **Valid Answer**: Ensure that the answer for each question exists within its corresponding options array.
5.  **PPT Content Format**:
    - The value of the `ppt_content` field must be an array containing 3-6 section objects
    - Each section object contains three required fields: `section_title` (section title), `content` (Markdown format content), `image_search_term` (English search keywords, can be empty string "")
    - **Content must be rich and detailed, with a total word count of all sections between 300 and 400 words. Provide comprehensive explanations for each section.**
    - **Image Selection Strategy**: Not all sections require images. Intelligently determine which sections most need visual aids, typically selecting 1-3 sections for images
6.  **Starter Code**: The `starter_code` for coding tasks should provide a meaningful code skeleton.
7.  **Strict JSON Format**:
    - Never use Markdown code blocks (```) inside JSON string values.
    - All special characters must be correctly escaped.
    - Each element in the `content` array must be a valid JSON string.
    - Animation instructions should be plain strings, not formatted as code blocks.
8.  **Document References**: If numbered reference documents are provided in the "Related Document Context" section, please add a `references` field to the returned JSON, using an array format to record the document numbers that were mainly referenced, for example: `"references": [1, 3, 5]`. If no specific documents were referenced, set it to an empty array `[]`.

Please return the task content in JSON format as specified below:
{{
    "type": "quiz" or "coding",
    "difficulty": "beginner/advanced/intermediate",
    "references": [],
    "ppt_content": [
        {{
            "section_title": "Section Title 1 (concise and clear, within 10 words)",
            "content": "Section content 1, Markdown format, detailed explanation of the section topic, 50-100 words",
            "image_search_term": "english search keywords for images 3-8 words"
        }},
        {{
            "section_title": "Section Title 2",
            "content": "Section content 2, Markdown format, continue in-depth explanation",
            "image_search_term": ""
        }},
        {{
            "section_title": "Section Title 3",
            "content": "Section content 3, can include code examples, lists and other Markdown elements",
            "image_search_term": "another educational diagram keywords"
        }}
    ],
    "questions": [
        {{
            "question": "Question content (must be specific and strictly limited to the current step's knowledge scope)",
            "type": "choice",
            "options": ["Option content 1", "Option content 2", "Option content 3"],
            "answer": "Answer content"
        }},
        {{
            "question": "Second question content (also limited to the current step's scope)",
            "type": "choice",
            "options": ["Option 1", "Option 2", "Option 3"],
            "answer": "Correct answer"
        }}
    ],
    "task": {{
        "title": "Coding task title (concise and clear, summarizing the requirements)",
        "description": "Detailed task description, including specific requirements and expected results (limited to the capabilities of the current step)",
        "mode": "fill_blank|guided_steps|code_choice|complete (choose based on difficulty)",
        "starter_code": "Meaningful code framework (difficulty suitable for the current step)",
        "answer": "Complete correct answer code (using knowledge from the current step)",
        
        // Include following fields based on mode:
        
        // If mode = "fill_blank", must include:
        "blanks": [
            {{
                "id": 1,
                "placeholder": "_____",
                "hint": "Hint: use + operator",
                "answer": "a + b",
                "position": {{
                    "line": 2,
                    "column": 12
                }}
            }}
        ],
        
        // If mode = "guided_steps", must include:
        "steps": [
            {{
                "step": 1,
                "instruction": "First, define the function name and parameters",
                "starter_code": "def calculate_sum(_____, _____):\\n    pass",
                "hint": "Function needs to receive two number parameters",
                "expected_code": "def calculate_sum(a, b):"
            }}
        ],
        
        // If mode = "code_choice", must include:
        "question": "Programming problem or scenario description",
        "code_options": [
            {{
                "id": 1,
                "code": "Code for option 1",
                "explanation": "Explanation for this option (optional)"
            }},
            {{
                "id": 2,
                "code": "Code for option 2",
                "explanation": "Explanation for this option (optional)"
            }},
            {{
                "id": 3,
                "code": "Code for option 3",
                "explanation": "Explanation for this option (optional)"
            }}
        ],
        "correct_option_id": 2,
        "explanation": "Detailed explanation of why this option is correct"
    }}
}}

**Final Reminders**:
1.  Ensure the return value is in strictly valid JSON format.
2.  All newline characters in JSON strings must be escaped as \\n.
3.  Do not include comments (//) in the JSON.
4.  **Content Scope Control**: Strictly ensure that all generated content (PPT, questions, code) is confined to the knowledge scope of the current step. Do not introduce concepts from subsequent steps prematurely.
5.  Based on the content and complexity of the task description, decide whether to generate a quiz or a coding task, and determine the appropriate number of questions (1-3). If the task is programming-related, generate a coding task; if it is conceptual or knowledge-based, generate a quiz.
6.  **Coding Task Mode Selection (Important Decision Flow)**:
   - First, determine the task type:
     * If the task is "implement a function", "write a program", "build logic" → **Prioritize guided_steps**
     * If the task is "understand code", "compare implementations" → Use code_choice
     * If the task is "simple syntax practice" → Use fill_blank
   - Then adjust based on difficulty:
     * difficulty = "beginner" + implementation task → **guided_steps** (break task into simple steps)
     * difficulty = "beginner" + syntax practice → fill_blank
     * difficulty = "intermediate" + implementation task → **guided_steps** (steps can be more complex)
     * difficulty = "intermediate" + comprehension task → code_choice
     * difficulty = "advanced" → complete
   - **Special Emphasis**: For beginner and intermediate level "programming practice" tasks, prioritize guided_steps mode over code_choice!
7.  **Mode-Specific Fields**: Based on the selected mode, only include the additional fields needed for that mode (blanks, steps, or code_options), do not include fields from other modes
"""



def get_task_generation_prompt(task_description, previous_steps_context=None, course_content=None, current_step_context=None, animation_type=None, type=None, difficulty=None, lang=None, document_context=None):
    # Import animation prompts
    # from .animation_prompts import get_animation_prompt_by_type
    
    # Get the appropriate animation prompt based on type
    animation_prompt_section = ""
    # if animation_type and animation_type != "无":
    #     animation_prompt_section = f"\n\n### 动画演示支持\n{get_animation_prompt_by_type(animation_type)}"
    if not lang:
        lang = "zh"

    # Create previous steps context section
    if lang == 'zh':
        if previous_steps_context:
            context_str = "\n".join([f"- **{s.get('title', '')}**: {s.get('description', '')}" for s in previous_steps_context])
            previous_steps_context_section = f"""### 已学知识点回顾（重要）
以下是用户已经学习过的内容纲要，请在此基础上生成当前步骤的教学内容：
{context_str}

**核心要求**：请**不要**在 `ppt_content` 中重复讲解上述已经覆盖的核心概念。你应该假设用户已经理解它们，并专注于讲解当前步骤的新知识点，或在已有知识上进行深化。可以引用，但不要重新详细定义。
"""
        else:
            previous_steps_context_section = "### 已学知识点回顾（重要）\n这是学习计划的第一个步骤，请从零开始讲解所有核心概念。"
        
        # Add document context section if available
        document_context_section = ""
        if document_context:
            document_context_section = f"""### 相关文档上下文（重要）
以下是与当前任务相关的文档内容，请将这些信息融入到任务生成中：

{document_context}

**重要说明**：
1. 上述文档内容是与任务描述高度相关的参考资料
2. 请将这些信息与任务描述融合，创建更加精确、有深度的学习内容
3. 不要直接引用上述内容，而是将其知识点自然地整合到PPT内容和题目中
4. 保持原有任务结构不变，仅优化内容质量和深度
"""
    else: # EN
        if previous_steps_context:
            context_str = "\n".join([f"- **{s.get('title', '')}**: {s.get('description', '')}" for s in previous_steps_context])
            previous_steps_context_section = f"""### Review of Previously Learned Concepts (Crucial)
Below is a summary of the topics the user has already covered. Please generate the content for the current step based on this foundation:
{context_str}

**Core Requirement**: Please **do not** repeat detailed explanations of the core concepts listed above in the `ppt_content`. You should assume the user already understands them and focus on introducing new knowledge for the current step or expanding on what has already been learned. You may reference previous concepts, but do not redefine them in detail.
"""
        else:
            previous_steps_context_section = "### Review of Previously Learned Concepts (Crucial)\nThis is the first step in the learning plan. Please start from the beginning and explain all core concepts."
        
        # Add document context section if available (English version)
        document_context_section = ""
        if document_context:
            document_context_section = f"""### Related Document Context (Important)
Below are document contents related to the current task. Please incorporate this information into the task generation:

{document_context}

**Important Notes**:
1. The above document content is highly relevant reference material for the task description
2. Please integrate this information with the task description to create more precise, in-depth learning content
3. Do not directly quote the above content, but naturally incorporate its knowledge points into the PPT content and questions
4. Maintain the original task structure, only optimize content quality and depth
"""

    # Add type and difficulty section
    type_difficulty_section = ""
    if type or difficulty:
        type_difficulty_section = f"""
### 任务类型与难度要求
"""
        if type:
            type_section=f"- **任务类型**: {type}\n" if lang == "zh" else f"- **Task Type**: {type}\n"
            type_difficulty_section += type_section
        if difficulty:
            difficulty_section=f"- **难度等级**: {difficulty}\n" if lang == "zh" else f"- **Difficulty Level**: {difficulty}\n"
            type_difficulty_section += difficulty_section
    prompt_template = TASK_GENERATION_ZH if lang == "zh" else TASK_GENERATION_EN
    
    # Combine all sections including document context
    formatted_prompt = prompt_template.format(
        task_description=task_description,
        type_difficulty_section=type_difficulty_section,
        previous_steps_context_section=f"{previous_steps_context_section}\n{document_context_section}" if document_context else previous_steps_context_section
    )
    
    return formatted_prompt
