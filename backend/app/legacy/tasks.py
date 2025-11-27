import asyncio
import json
from src.llm.call_llm import llm_client
from src.llm.parsers import parse_task
# import logging
from log import logger
# logger = logging.getLogger('tasks')

async def generate_task(task_description, use_mock=False, course_content=None, current_step_context=None, animation_type=None, type=None, difficulty=None,lang=None, previous_steps_context=None, document_context=None):
    try:
        response = await llm_client.generate_task(task_description, course_content, current_step_context, animation_type, type, difficulty, lang=lang, previous_steps_context=previous_steps_context, document_context=document_context)
        task_data = parse_task(response)
        return task_data
    except Exception as e:
        logger.error(f"Error generating task: {e}")
        raise