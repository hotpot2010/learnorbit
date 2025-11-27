"""
Prompt templates module.

Provides various prompt templates for generating learning plans and tasks.
"""

from src.prompts import (
    learning_plan, 
    task_generation, 
    code_evaluation, 
    question_suggestion,
    ability_assessment,
    error_based_question_suggestion,
    update_plan,
    task_update
)

PROMPT_TYPES = {
    "learning_plan": learning_plan.get_learning_plan_prompt,
    "task_generation": task_generation.get_task_generation_prompt,
    "code_evaluation": code_evaluation.get_code_evaluation_prompt,
    "question_suggestion": question_suggestion.get_question_suggestion_prompt,
    "ability_assessment": ability_assessment.get_ability_assessment_prompt,
    "error_based_question_suggestion": error_based_question_suggestion.get_error_based_question_suggestion_prompt,
    "update_plan": update_plan.get_update_plan_prompt,
    "task_update_detect": task_update.get_task_update_detect_prompt,
    "task_update_execute": task_update.get_task_update_execute_prompt
}

def get_prompt(prompt_type: str, **kwargs) -> str:
    """
    Retrieves the specified prompt template, formatted with provided keyword arguments.

    Args:
        prompt_type: The type of prompt needed (e.g., 'learning_plan', 'task_generation', 
                     'code_evaluation', 'question_suggestion', 'ability_assessment',
                     'error_based_question_suggestion', 'task_update').
        **kwargs: Keyword arguments specific to the chosen prompt template.
                 For 'learning_plan': requires 'learning_goal'.
                 For 'task_generation': requires 'task_description'. Optionally accepts 'course_content', 'current_step_context'.
                 For 'code_evaluation': requires 'problem_description', 'user_code'.
                 For 'question_suggestion': requires 'task_title', 'task_description'.
                 For 'ability_assessment': requires 'task_title', 'task_description', 'user_submission'.
                 For 'error_based_question_suggestion': requires 'task_title', 'task_description', 'user_submission', and optionally 'error_reason'.
                 For 'task_update': requires 'task_data', 'user_message'.

    Returns:
        The formatted prompt string.

    Raises:
        ValueError: If the prompt_type is not supported or missing required args.
    """
    if prompt_type in PROMPT_TYPES:
        prompt_func = PROMPT_TYPES[prompt_type]
        required_args = {
            "learning_plan": ['learning_goal'],
            "task_generation": ['task_description'],
            "code_evaluation": ['problem_description', 'user_code'],
            "question_suggestion": ['task_title', 'task_description'],
            "ability_assessment": ['task_title', 'task_description', 'user_submission'],
            "error_based_question_suggestion": ['task_title', 'task_description', 'user_submission'],
            "task_update": ['task_data', 'user_message']
        }
        if prompt_type in required_args:
            missing_args = [arg for arg in required_args[prompt_type] if arg not in kwargs]
            if missing_args:
                raise ValueError(f"Missing required arguments for prompt type '{prompt_type}': {missing_args}")
                
        return prompt_func(**kwargs)
    else:
        raise ValueError(f"Unsupported prompt type: {prompt_type}") 