"""Prompt template for assessing user abilities based on task interaction."""

def get_ability_assessment_prompt(task_title: str, task_description: str, user_submission: str) -> str:
    """
    Generates a prompt to assess user abilities based on their submission 
    for a given task, focusing on score increases for relevant dimensions.

    Args:
        task_title: The title of the learning task.
        task_description: The description of the learning task.
        user_submission: The user's submitted answer or code.

    Returns:
        A formatted prompt string.
    """

    dimension_details = """
### Ability Dimensions:

*   **theoretical_knowledge**: Understanding concepts, principles, and theories.
*   **practical_ability**: Applying knowledge to perform tasks and procedures.
*   **problem_solving**: Analyzing issues, breaking them down, and finding solutions.
*   **algorithm_optimization**: Evaluating and improving the efficiency (time/space) of solutions.
*   **programming_skills**: Writing clear, efficient, modular, and correct code.
"""

    prompt = f"""
You are an expert AI Educator assessing a student's progress. Analyze the user's submission for the following task. Your goal is to identify the 1 or 2 primary ability dimensions MOST exercised or demonstrated by successfully completing this *specific* task, and suggest a score *increase* (on a 0-100 scale) for those dimensions.

**Task Context:**
Title: {task_title}
Description: {task_description}

**User Submission:**
```
{user_submission}
```

{dimension_details}

**Assessment Instructions:**

1.  Determine which **1 or 2** ability dimensions (from the list above) are most directly relevant to this task and the user's submission.
2.  Consider the complexity of the task and the quality implicitly shown by a *correct* submission.
3.  For each identified relevant dimension, suggest a score **increase** between +5 and +20 points (on a 0-100 scale). A simple task might warrant a +5 or +10 increase in one dimension, while a complex coding task correctly solved might warrant +15 or +20 in programming_skills and +10 in problem_solving.
4.  Output your assessment ONLY in the following JSON format. Do not include any other text, explanations, or markdown formatting.

```json
{{
  "dimension_updates": [
    {{"dimension": "<relevant_dimension_1_key>", "increase": <score_increase_5_to_20>}},
    {{"dimension": "<relevant_dimension_2_key>", "increase": <score_increase_5_to_20>}} 
    // Include only 1 or 2 entries
  ]
}}
```

**Assessment (JSON Output Only):**
"""
    return prompt 