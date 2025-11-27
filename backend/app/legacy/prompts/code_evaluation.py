"""Prompt template for evaluating user code submissions."""

def get_code_evaluation_prompt(problem_description: str, user_code: str, task_mode: str = "complete", task_data: dict = None) -> str:
    """
    Generates a prompt to evaluate user code against a problem description.

    Args:
        problem_description: The description of the coding problem/task.
        user_code: The code submitted by the user.
        task_mode: The mode of the coding task (fill_blank, guided_steps, debug, complete).
        task_data: Additional task data containing mode-specific information.

    Returns:
        A formatted prompt string.
    """
    
    # Base prompt components
    base_instruction = """
You are an expert code reviewer and AI programming tutor. Your task is to evaluate a user's submitted code based on a given problem description.

**Problem Description:**
{problem_description}
"""
    
    # Mode-specific instructions
    if task_mode == "fill_blank":
        mode_specific = """
**Task Mode:** Fill-in-the-Blank

**Expected Blanks:**
{blanks_info}

**User Submitted Answers:**
{user_code}

**Instructions:**
1. Check if the user's answers for each blank are correct.
2. Each blank should be evaluated independently.
3. Consider variations in syntax that are functionally equivalent (e.g., "a+b" vs "a + b").
4. Provide feedback on which blanks are incorrect and why.
"""
        blanks_info = ""
        if task_data and "blanks" in task_data:
            blanks_info = "\n".join([
                f"Blank {blank['id']}: {blank.get('hint', '')}"
                for blank in task_data["blanks"]
            ])
        mode_specific = mode_specific.format(blanks_info=blanks_info, user_code=user_code)
        
    elif task_mode == "guided_steps":
        mode_specific = """
**Task Mode:** Step-by-Step Guidance

**Current Step:** {current_step}

**Step Instruction:**
{step_instruction}

**User Submitted Code:**
```python
{user_code}
```

**Instructions:**
1. Evaluate if the user's code correctly completes the current step.
2. Check if the code follows the step's instruction.
3. Verify that the code builds properly on previous steps.
4. Be lenient with style variations as long as functionality is correct.
"""
        current_step = task_data.get("current_step", 1) if task_data else 1
        step_instruction = ""
        if task_data and "steps" in task_data and current_step <= len(task_data["steps"]):
            step_instruction = task_data["steps"][current_step - 1].get("instruction", "")
        mode_specific = mode_specific.format(
            current_step=current_step,
            step_instruction=step_instruction,
            user_code=user_code
        )
        
    elif task_mode == "code_choice":
        mode_specific = """
**Task Mode:** Code Choice (Select the Correct Code)

**Question/Scenario:**
{question}

**Available Code Options:**
{code_options_display}

**User's Selection:** Option {user_selection}

**Correct Option:** Option {correct_option}

**Instructions:**
1. Check if the user selected the correct code option.
2. The evaluation should simply verify if user_selection matches correct_option.
3. If incorrect, briefly explain why their choice is wrong and why the correct option is better.
"""
        question = task_data.get("question", "") if task_data else ""
        code_options = task_data.get("code_options", []) if task_data else []
        correct_option_id = task_data.get("correct_option_id", 1) if task_data else 1
        
        # Format code options for display
        code_options_display = "\n".join([
            f"Option {opt['id']}:\n```python\n{opt['code']}\n```"
            for opt in code_options
        ])
        
        mode_specific = mode_specific.format(
            question=question,
            code_options_display=code_options_display,
            user_selection=user_code,  # user_code contains the selected option ID
            correct_option=correct_option_id
        )
        
    else:  # complete mode (default)
        mode_specific = """
**Task Mode:** Complete Programming

**User Submitted Code:**
```python
{user_code}
```

**Instructions:**
1. Analyze the user's code carefully. Does it correctly solve the problem described?
2. Consider edge cases, potential bugs, and adherence to the requirements mentioned in the description.
3. Determine if the code is functionally correct for the given problem.
4. Minor style issues or suboptimal solutions can be considered correct if they fulfill the main requirements.
"""
        mode_specific = mode_specific.format(user_code=user_code)
    
    # Common output format instruction
    output_format = """
**Evaluation Format:**

Provide your evaluation in the following JSON format ONLY. Do not add any other text, explanations, or markdown formatting before or after the JSON block.

```json
{{
  "is_correct": <true_or_false>,
  "error_reason": "<If incorrect, provide a concise explanation of the main error (less than 50 words). If correct, this should be an empty string.>"
}}
```

**Evaluation (JSON Output Only):**
"""
    
    prompt = base_instruction.format(problem_description=problem_description) + mode_specific + output_format
    return prompt 