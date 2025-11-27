import json
import re
# import logging
from log import logger
import json_repair
def parse_learning_plan(response):
    try:
        # 预处理响应，移除可能的换行符
        response = response.replace('\n', '')
        
        # 尝试直接解析JSON
        try:
            plan_data = json.loads(response)
            return plan_data
        except json.JSONDecodeError:
            # 如果直接解析失败，尝试提取JSON部分
            match = re.search(r'\{.*\}', response)
            if match:
                try:
                    plan_data = json.loads(match.group())
                    return plan_data
                except json.JSONDecodeError:
                    logger.error("Failed to parse learning plan JSON")
                    raise
    except Exception as e:
        logger.error(f"Error parsing learning plan: {e}")
        raise

def parse_task(response):# -> Any | dict[str, Any]:
    try:
        # 检查是否是 ChatCompletion 对象
        if hasattr(response, 'choices') and len(response.choices) > 0:
            # 从 ChatCompletion 对象中提取文本内容
            response_text = response.choices[0].message.content
        elif isinstance(response, dict) and 'choices' in response:
            # 从 API 响应字典中提取文本
            response_text = response['choices'][0]['message']['content']
        elif isinstance(response, str):
            # 已经是字符串
            response_text = response
        else:
            # 未知类型
            logger.error(f"Unknown response type: {type(response)}")
            raise ValueError(f"Unable to extract content from response type: {type(response)}")
        
        # 从文本中提取 JSON
        json_match = re.search(r'```json\s*(.*?)\s*```', response_text, re.DOTALL)
        if json_match:
            response_text = json_match.group(1)
        
        # 预处理：处理JSON中的嵌套markdown代码块和特殊字符
        def preprocess_json_content(text):
            # 查找并清理 content 数组中可能存在的问题
            # 1. 处理包含 ``` 的内容
            # 2. 处理未正确转义的换行符和特殊字符
            
            # 先尝试找到可能的JSON结构起点
            start_bracket = text.find('{')
            if start_bracket == -1:
                return text
                
            # 逐字符处理，正确处理字符串中的特殊内容
            result = []
            i = 0
            in_string = False
            escape_next = False
            
            while i < len(text):
                char = text[i]
                
                if escape_next:
                    result.append(char)
                    escape_next = False
                elif char == '\\':
                    result.append(char)
                    escape_next = True
                elif char == '"' and not escape_next:
                    in_string = not in_string
                    result.append(char)
                elif in_string:
                    # 在字符串内部，处理特殊字符
                    if char == '\n':
                        result.append('\\n')
                    elif char == '\r':
                        result.append('\\r')
                    elif char == '\t':
                        result.append('\\t')
                    else:
                        result.append(char)
                else:
                    # 在字符串外部，正常处理
                    result.append(char)
                
                i += 1
            
            return ''.join(result)
        
        # 另一种方法：寻找并修复明显的JSON格式问题
        def fix_json_format(text):
            # 查找 content 字段中的 markdown 代码块问题
            # 替换形如 "content": [ ``` ... ``` 的结构
            pattern = r'("content"\s*:\s*\[\s*)"?```([^`]*?)```"?'
            
            def fix_content_block(match):
                prefix = match.group(1)
                content = match.group(2).strip()
                # 将内容作为JSON字符串正确转义
                escaped_content = json.dumps(content)
                return f'{prefix}{escaped_content}'
            
            # 应用修复
            fixed_text = re.sub(pattern, fix_content_block, text, flags=re.DOTALL)
            
            # 处理其他可能的格式问题
            # 确保content数组正确闭合
            fixed_text = re.sub(r'("content"\s*:\s*\[[^\]]*?)(\n\s*")', r'\1\2', fixed_text)
            
            return fixed_text
        
        # 应用预处理
        response_text = fix_json_format(response_text)
        response_text = preprocess_json_content(response_text)
        
        # 尝试解析 JSON
        try:
            task_data = json_repair.loads(response_text)
        except json.JSONDecodeError as e:
            # 如果还是失败，尝试更激进的修复
            logger.warning(f"JSON解析失败，尝试更激进的修复: {e}")
            
            # 记录原始内容用于调试
            logger.error(f"解析失败的响应文本: {response_text[:500]}...")
            
            # 最后的备选方案：尝试提取关键部分重新构建JSON
            try:
                # 提取type字段
                type_match = re.search(r'"type"\s*:\s*"([^"]*)"', response_text)
                task_type = type_match.group(1) if type_match else "quiz"
                
                # 构建一个最基本的有效JSON
                fallback_data = {
                    "type": task_type,
                    "ppt_slide": {
                        "title": "学习内容",
                        "content": ["内容解析出错，已使用默认内容"]
                    },
                    "questions": [
                        {
                            "question": "这是一个示例问题",
                            "type": "choice",
                            "options": ["选项1", "选项2", "选项3"],
                            "answer": "选项1"
                        }
                    ]
                }
                
                logger.warning("使用fallback JSON数据")
                task_data = fallback_data
                
            except Exception as fallback_e:
                logger.error(f"Fallback解析也失败: {fallback_e}")
                raise e  # 抛出原始错误
        
        # 验证任务类型
        if 'type' not in task_data:
            raise ValueError("Missing task type in response")
        if task_data['type'] not in ['quiz', 'coding']:
            raise ValueError(f"Invalid task type: {task_data['type']}")
        
        return task_data
    except Exception as e:
        logger.error(f"Error parsing task: {e}")
        logger.error(f"Response content: {response}")
        raise

def parse_chat_response(response):
    try:
        return response
    except Exception as e:
        logger.error(f"Error parsing chat response: {e}")
        raise 