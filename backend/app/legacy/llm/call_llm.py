import asyncio
import json
import json_repair
from volcenginesdkarkruntime import AsyncArk
# from openai import AsyncOpenAI
# from apollo import get_chat_model
import os
# import logging
from src.prompts import get_prompt
import traceback
from log import logger
# logger = logging.getLogger('llm')
from dotenv import load_dotenv
load_dotenv()


class LLMClient:
    def __init__(self):
        self.ak = os.environ.get("VOLC_ACCESS_KEY")
        self.sk = os.environ.get("VOLC_SECRET_KEY")
        self.model = os.environ.get("VOLC_CHAT_MODEL")
        # self.base_url="https://llm.baijia.com/v1/"
        # self.api_key="Bearer sk-7BfuPhPxtPMjaAJn86vR2g"
        # self.model=get_chat_model()
        self.client = None
        self.initialization_error = None
        
        # 添加并发连接控制
        self.connection_semaphore = asyncio.Semaphore(2)
        
        self._initialize_client()

    def _initialize_client(self):
        if not self.ak or not self.sk:
        # if not self.api_key:
            self.initialization_error = "Missing Volcano Engine API credentials"
            logger.error(self.initialization_error)
            return
        if not self.model:
            self.initialization_error = "Missing Model info"
            logger.error(self.initialization_error)
            return

        try:
            self.client = AsyncArk(
                ak=self.ak,
                sk=self.sk,

            # self.client = AsyncOpenAI(
            #     base_url=self.base_url,
            #     api_key=self.api_key,
                timeout=120,
                max_retries=2
            )
            logger.info("AsyncArk client initialized successfully")
            # logger.info(f"AsyncOpenAI client initialized successfully, model: {self.model}")
            # logger.info("AsyncOpenAI client initialized successfully")
        except Exception as e:
            self.initialization_error = f"Failed to initialize AsyncOpenAI client: {e}"
            logger.error(self.initialization_error)

    async def chat_completion(self, messages, stream=False):
        if self.initialization_error:
            raise Exception(self.initialization_error)
        if not self.client:
            raise Exception("LLM client is not available")

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                stream=stream
            )
            return response
        except Exception as e:
            logger.error(f"Error in chat completion: {e}",exc_info=True)
            raise

    async def get_completion(self, prompt):
        """
        获取单次完成响应（非流式）
        
        Args:
            prompt: 提示词字符串
            
        Returns:
            响应文本内容
        """
        if self.initialization_error:
            raise Exception(self.initialization_error)
        if not self.client:
            raise Exception("LLM client is not available")

        try:
            response = await self.chat_completion([{"role": "user", "content": prompt}], stream=False)
            
            # 提取响应内容
            if response.choices and len(response.choices) > 0:
                message = response.choices[0].message
                if message and hasattr(message, 'content'):
                    return message.content
            
            return ""
        except Exception as e:
            logger.error(f"Error in get_completion: {e}")
            raise

    async def generate_learning_plan(self, learning_goal):
        from src.prompts.learning_plan import get_learning_plan_prompt
        prompt = get_learning_plan_prompt(learning_goal)
        response = await self.chat_completion([{"role": "user", "content": prompt}])
        return response['result']

    async def generate_learning_plan_stream(self, prompt):
        """
        流式生成学习计划
        
        Args:
            prompt: 学习计划提示词
            
        Yields:
            每个步骤的文本内容
        """
        if self.initialization_error:
            raise Exception(self.initialization_error)
        if not self.client:
            raise Exception("LLM client is not available")

        stream = None
        try:
            stream = await self.chat_completion([{"role": "user", "content": prompt}], stream=True)
            async for chunk in stream:
                if chunk.choices and len(chunk.choices) > 0:
                    content = chunk.choices[0].delta.content
                    if content:
                        yield content
        except Exception as e:
            logger.error(f"Error in learning plan stream: {e}", exc_info=True)
            raise

    async def generate_task(self, task_description, course_content=None, current_step_context=None, animation_type=None, type=None, difficulty=None,lang=None, previous_steps_context=None, document_context=None):
        if self.initialization_error:
            raise Exception(f"LLM client not initialized: {self.initialization_error}")
        
        async with self.connection_semaphore:
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    logger.info(f"[LLM] 生成任务请求 (尝试 {attempt + 1}/{max_retries}): {task_description}")
                    
                    prompt = get_prompt('task_generation', 
                                     task_description=task_description,
                                     course_content=course_content,
                                     current_step_context=current_step_context,
                                     animation_type=animation_type,
                                     type=type,
                                     difficulty=difficulty,
                                     lang=lang,
                                     previous_steps_context=previous_steps_context,
                                     document_context=document_context)
                    response = await self.chat_completion(
                        messages=[{"role": "user", "content": prompt}],
                        stream=False
                    )
                    
                    logger.info(f"[LLM] 任务生成成功 (尝试 {attempt + 1})")
                    return response
                    
                except Exception as e:
                    logger.error(f"[LLM] 任务生成失败 (尝试 {attempt + 1}/{max_retries}): {e}", exc_info=True)
                    
                    if attempt == max_retries - 1:
                        raise
                    
                    await asyncio.sleep(1)

    async def stream_chat(self, messages):
        """
        流式聊天，返回纯文本内容块
        """
        if self.initialization_error:
            raise Exception(f"AI Assistant client initialization failed: {self.initialization_error}")

        print(f"stream_chat messages: {messages}")

        try:
            stream = await self.chat_completion(messages, stream=True)
            async for chunk in stream:
                if chunk.choices and len(chunk.choices) > 0:
                    content_chunk = chunk.choices[0].delta.content
                    if content_chunk:
                        yield content_chunk
                elif hasattr(chunk, 'error') and chunk.error:
                    err_msg = getattr(chunk.error, 'message', str(chunk.error))
                    raise Exception(f"AI Error: {err_msg}")
                    
        except asyncio.TimeoutError:
            raise Exception("The AI assistant took too long to respond.")
        except Exception as e:
            logger.error(f"Error in stream chat: {e}", exc_info=True)
            raise Exception("An unexpected error occurred while contacting the AI.")

    async def chat_stream(self, messages):
        if self.initialization_error:
            error_payload = json.dumps({"error": f"AI Assistant client initialization failed: {self.initialization_error}"})
            yield f"data: {error_payload}\n\n"
            return

        print(f"chat_stream messages: {messages}")

        try:
            stream = await self.chat_completion(messages, stream=True)
            async for chunk in stream:
                if chunk.choices and len(chunk.choices) > 0:
                    content_chunk = chunk.choices[0].delta.content
                    if content_chunk:
                        data_payload = json.dumps({"chunk": content_chunk})
                        yield f"data: {data_payload}\n\n"
                elif hasattr(chunk, 'error') and chunk.error:
                    err_msg = getattr(chunk.error, 'message', str(chunk.error))
                    error_payload = json.dumps({"error": f"AI Error: {err_msg}"})
                    yield f"data: {error_payload}\n\n"
                    break

            done_payload = json.dumps({"done": True})
            yield f"data: {done_payload}\n\n"
        except asyncio.TimeoutError:
            error_payload = json.dumps({"error": "The AI assistant took too long to respond."})
            yield f"data: {error_payload}\n\n"
        except Exception as e:
            logger.error(f"Error in chat stream: {e}")
            error_payload = json.dumps({"error": "An unexpected error occurred while contacting the AI."})
            yield f"data: {error_payload}\n\n"

    async def evaluate_code_submission(self, problem_description: str, user_code: str, task_mode: str = "complete", task_data: dict = None) -> dict:
        """
        Evaluates user code against a problem description using an LLM.

        Args:
            problem_description: The description of the coding task.
            user_code: The code submitted by the user.
            task_mode: The mode of the coding task (fill_blank, guided_steps, debug, complete).
            task_data: Additional task data containing mode-specific information.

        Returns:
            A dictionary with evaluation results, e.g.:
            { "is_correct": True, "error_reason": "" }
            or
            { "is_correct": False, "error_reason": "Missed edge case X." }
            Returns a default error state if LLM call or parsing fails.
        """
        default_error_result = {"is_correct": False, "error_reason": "评估过程中发生错误，请稍后再试。"}
        
        if self.initialization_error:
            print(f"LLMClient not initialized: {self.initialization_error}")
            return {"is_correct": False, "error_reason": f"AI评估服务未就绪: {self.initialization_error}"}

        try:
            prompt = get_prompt(
                prompt_type="code_evaluation", 
                problem_description=problem_description, 
                user_code=user_code,
                task_mode=task_mode,
                task_data=task_data
            )
            
            # Use the non-streaming chat completion method
            response_object = await self.chat_completion([{"role": "user", "content": prompt}])

            # Extract the content string from the ChatCompletion object
            llm_response_content = ""
            if response_object.choices and len(response_object.choices) > 0:
                message = response_object.choices[0].message
                if message and hasattr(message, 'content'):
                    llm_response_content = message.content
            
            if not llm_response_content:
                print("Code evaluation LLM call returned empty content.")
                return default_error_result

            # Attempt to parse the JSON response
            try:
                # Find the JSON block (handle potential markdown backticks)
                json_start = llm_response_content.find('{')
                json_end = llm_response_content.rfind('}')
                if json_start != -1 and json_end != -1:
                    json_str = llm_response_content[json_start : json_end + 1]
                    result = json.loads(json_str)
                    # Validate expected keys
                    if "is_correct" in result and "error_reason" in result:
                        print(f"Code evaluation result: {result}")
                        return {
                            "is_correct": bool(result["is_correct"]),
                            "error_reason": str(result["error_reason"])
                        }
                    else:
                        print(f"LLM response JSON missing expected keys: {json_str}")
                        return default_error_result
                else:
                    print(f"Could not find JSON block in LLM response: {llm_response_content}")
                    return default_error_result
                    
            except json.JSONDecodeError as json_err:
                print(f"Failed to parse JSON from LLM response: {json_err}")
                print(f"Raw LLM response: {llm_response_content}")
                return default_error_result

        except Exception as e:
            print(f"Error during code evaluation LLM call: {e}")
            traceback.print_exc()
            return default_error_result

    async def suggest_questions(self, task_title: str, task_description: str,lang="zh") -> list[str]:
        """
        Generates suggested questions based on the current task using an LLM.

        Args:
            task_title: The title of the current task.
            task_description: The description of the current task.

        Returns:
            A list of suggested question strings, or an empty list if failed.
        """
        if self.initialization_error:
            print(f"LLMClient not initialized for question suggestion: {self.initialization_error}")
            return []

        try:
            prompt = get_prompt(
                prompt_type="question_suggestion",
                task_title=task_title,
                task_description=task_description,
                lang=lang
            )
            
            response_object = await self.chat_completion([{"role": "user", "content": prompt}])
            
            llm_response_content = ""
            if response_object.choices and len(response_object.choices) > 0:
                message = response_object.choices[0].message
                if message and hasattr(message, 'content'):
                    llm_response_content = message.content

            if not llm_response_content:
                print("Question suggestion LLM call returned empty content.")
                return []

            # Attempt to parse the JSON response
            try:
                json_start = llm_response_content.find('{')
                json_end = llm_response_content.rfind('}')
                if json_start != -1 and json_end != -1:
                    json_str = llm_response_content[json_start : json_end + 1]
                    result = json.loads(json_str)
                    # Validate expected key and type
                    if "recommended_questions" in result and isinstance(result["recommended_questions"], list):
                        questions = [str(q) for q in result["recommended_questions"]] # Ensure strings
                        print(f"Suggested questions result: {questions}")
                        return questions
                    else:
                        print(f"LLM response JSON missing/invalid 'recommended_questions': {json_str}")
                        return []
                else:
                    print(f"Could not find JSON block in question suggestion response: {llm_response_content}")
                    return []
                    
            except json.JSONDecodeError as json_err:
                print(f"Failed to parse JSON from question suggestion response: {json_err}")
                print(f"Raw LLM response for question suggestion: {llm_response_content}")
                return []

        except Exception as e:
            print(f"Error during question suggestion LLM call: {e}")
            traceback.print_exc()
            return []

    async def assess_user_ability(self, task_title: str, task_description: str, user_submission: str) -> list:
        """
        Assesses user abilities based on task submission using an LLM.
        Returns a list of dimension updates or an empty list on failure.
        Example update: {"dimension": "programming_skills", "increase": 15}
        """
        if self.initialization_error:
            print(f"LLMClient not initialized for ability assessment: {self.initialization_error}")
            return [] # Return empty list on init error

        try:
            prompt = get_prompt(
                prompt_type="ability_assessment",
                task_title=task_title,
                task_description=task_description,
                user_submission=user_submission
            )
            
            response_object = await self.chat_completion([{"role": "user", "content": prompt}])
            
            llm_response_content = ""
            if response_object.choices and len(response_object.choices) > 0:
                message = response_object.choices[0].message
                if message and hasattr(message, 'content'):
                    llm_response_content = message.content

            if not llm_response_content:
                print("Ability assessment LLM call returned empty content.")
                return []

            # Attempt to parse the JSON response for dimension_updates
            try:
                json_start = llm_response_content.find('{')
                json_end = llm_response_content.rfind('}')
                if json_start != -1 and json_end != -1:
                    json_str = llm_response_content[json_start : json_end + 1]
                    result = json.loads(json_str)
                    
                    # Validate the new structure
                    if "dimension_updates" in result and isinstance(result["dimension_updates"], list):
                        updates = result["dimension_updates"]
                        valid_updates = []
                        # Further validate each item in the list
                        for item in updates[:2]: # Process at most 2 updates
                            if isinstance(item, dict) and \
                               "dimension" in item and isinstance(item["dimension"], str) and \
                               "increase" in item and isinstance(item["increase"], (int, float)):
                                # Basic validation passed, ensure increase is reasonable
                                increase_val = max(0, min(50, int(item["increase"]))) # Cap increase just in case
                                valid_updates.append({
                                    "dimension": item["dimension"],
                                    "increase": increase_val
                                })
                            else:
                                print(f"Warning: Invalid item in dimension_updates: {item}")
                                
                        if valid_updates:
                           print(f"Ability assessment updates: {valid_updates}")
                           return valid_updates
                        else:
                            print(f"No valid updates found in dimension_updates list: {updates}")
                            return []
                    else:
                        print(f"LLM response JSON missing/invalid 'dimension_updates' list: {json_str}")
                        return []
                else:
                    print(f"Could not find JSON block in ability assessment response: {llm_response_content}")
                    return []
                    
            except json.JSONDecodeError as json_err:
                print(f"Failed to parse JSON from ability assessment response: {json_err}")
                print(f"Raw LLM response for ability assessment: {llm_response_content}")
                return []

        except Exception as e:
            print(f"Error during ability assessment LLM call: {e}")
            traceback.print_exc()
            return []

    async def suggest_questions_for_error(self, task_title: str, task_description: str, user_submission: str, error_reason: str = None,lang="zh") -> list[str]:
        """
        Generates suggested questions to help a user after an incorrect submission.

        Args:
            task_title: The title of the current task.
            task_description: The description of the current task.
            user_submission: The user's incorrect submission.
            error_reason: (Optional) The reason provided for the error.

        Returns:
            A list of suggested question strings, or an empty list if failed.
        """
        if self.initialization_error:
            print(f"LLMClient not initialized for error-based question suggestion: {self.initialization_error}")
            return []

        try:
            prompt_kwargs = {
                "task_title": task_title,
                "task_description": task_description,
                "user_submission": user_submission,
                "lang": lang
            }
            if error_reason: # Only add error_reason if it exists
                prompt_kwargs["error_reason"] = error_reason
            
            prompt = get_prompt(
                prompt_type="error_based_question_suggestion",
                **prompt_kwargs
            )
            
            response_object = await self.chat_completion([{"role": "user", "content": prompt}])
            
            llm_response_content = ""
            if response_object.choices and len(response_object.choices) > 0:
                message = response_object.choices[0].message
                if message and hasattr(message, 'content'):
                    llm_response_content = message.content

            if not llm_response_content:
                print("Error-based question suggestion LLM call returned empty content.")
                return []

            # Parse JSON (same parsing logic as suggest_questions)
            try:
                json_start = llm_response_content.find('{')
                json_end = llm_response_content.rfind('}')
                if json_start != -1 and json_end != -1:
                    json_str = llm_response_content[json_start : json_end + 1]
                    result = json.loads(json_str)
                    if "recommended_questions" in result and isinstance(result["recommended_questions"], list):
                        questions = [str(q) for q in result["recommended_questions"]]
                        print(f"Error-based suggested questions: {questions}")
                        return questions
                    else:
                        print(f"LLM error-based response JSON missing/invalid 'recommended_questions': {json_str}")
                        return []
                else:
                    print(f"Could not find JSON block in error-based question suggestion response: {llm_response_content}")
                    return []
            except json.JSONDecodeError as json_err:
                print(f"Failed to parse JSON from error-based question suggestion: {json_err}")
                print(f"Raw LLM response: {llm_response_content}")
                return []

        except Exception as e:
            print(f"Error during error-based question suggestion LLM call: {e}")
            traceback.print_exc()
            return []

    async def update_task_based_on_feedback(self, task_data, suggestion, lang="zh"):
        """
        根据用户反馈评估并更新任务内容
        
        Args:
            task_data (dict): 当前任务数据
            suggestion (str): 用户的聊天消息/反馈
            lang (str): 语言，"zh" 或 "en"
            
        Returns:
            dict: {"task": dict} - 包含更新后的任务内容
        """
        if self.initialization_error:
            logger.error(f"LLMClient not initialized for task update: {self.initialization_error}")
            return {"task": task_data,"search_keyword":""}
        
        try:
            from src.prompts import get_prompt
            
            prompt = get_prompt(
                prompt_type="task_update_execute",
                task_data=task_data,
                suggestion=suggestion,
                lang=lang
            )
            
            logger.info(f"[LLM] 发送任务更新请求，用户反馈: {suggestion[:100]}...")
            response_object = await self.chat_completion([{"role": "user", "content": prompt}])
            
            llm_response_content = ""
            if response_object.choices and len(response_object.choices) > 0:
                message = response_object.choices[0].message
                if message and hasattr(message, 'content'):
                    llm_response_content = message.content
            
            if not llm_response_content:
                logger.error("任务更新LLM调用返回空内容")
                return {"task": task_data,"search_keyword":""}
            
            # 尝试解析JSON响应
            try:
                # 找到JSON块（处理可能的markdown反引号）
                result=json_repair.loads(llm_response_content)

                # 验证预期的键
                if "task" in result and "search_keyword" in result:
                    return result

            except json.JSONDecodeError as json_err:
                logger.error(f"无法解析LLM响应中的JSON: {json_err}")
                logger.error(f"原始LLM响应: {llm_response_content}")
                return {"task": task_data,"search_keyword":""}
        
        except Exception as e:
            logger.error(f"任务更新LLM调用过程中发生错误: {e}", exc_info=True)
            return {"task": task_data,"search_keyword":""}

llm_client = LLMClient() 