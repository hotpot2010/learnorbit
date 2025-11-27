"""
学习计划生成和解析模块
"""
import json
import asyncio
import traceback
# import logging
from log import logger
from src.llm.call_llm import llm_client
from src.prompts import get_prompt
from src.prompts.learning_plan import get_learning_plan_prompt
from src.prompts.update_plan import get_update_plan_prompt
import os
import re
import random
import numpy as np
import aiohttp
import json_repair
# from config import Config

# logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
# logger = logging.getLogger('learning_plan')

async def generate_learning_plan_stream(learning_goal, course_content=None,is_update=False,current_plan=None,advise=None,lang='zh',context=None,category=None):
    """
    根据学习目标流式生成学习计划，每生成一个步骤就返回一次
    
    Args:
        learning_goal: 用户学习目标
        course_content: 可选的课程内容参考
        
    Yields:
        每个步骤的JSON对象
    """
    if llm_client.initialization_error:
        raise Exception(f"AI客户端初始化失败: {llm_client.initialization_error}")
    
    # 获取提示词并填充参数
    try:
        
        if is_update and current_plan:
            print(f"[学习计划更改] 使用用户对话上下文参考: {learning_goal}")
            prompt=get_update_plan_prompt(current_plan=current_plan,advise=advise,lang=lang,context=context,category=category)
        else:
            print(f"[学习计划流式] 开始生成学习计划，学习目标: {learning_goal}")
            # if course_content:
            #     print(f"[学习计划流式] 使用课程内容作为参考: {course_content[:200]}...")
            #     prompt = get_prompt('learning_plan', learning_goal=learning_goal, course_content=course_content,lang=lang)
            # else:
            prompt = get_learning_plan_prompt(learning_goal,lang=lang,context=context,category=category)
    except Exception as e:
        print(f"[学习计划流式] 获取提示词失败: {e}")
        traceback.print_exc()
        raise Exception(f"获取提示词失败: {str(e)}")
    
    stream = None
    try:
        # 调用LLM客户端生成学习计划
        print(f"[学习计划流式] 调用LLM生成学习计划")
        stream = llm_client.generate_learning_plan_stream(prompt)
        
        # 初始化变量
        buffer = ""            # 收集文本的缓冲区
        current_step_num = 0   # 当前步骤计数
        json_started = False   # 标记是否开始解析JSON
        step_marker = "#STEP_COMPLETE#"  # 步骤完成的特殊标记
        intro_marker = "#INTRODUCTION_COMPLETE#"  # 介绍完成的特殊标记
        introduction_parsed = False  # 标记是否已解析介绍部分
        
        # 处理流式响应
        async for chunk in stream:
            if not chunk:
                continue
            
            buffer += chunk
            
            # 检测JSON开始
            if not json_started and "```json" in buffer:
                logger.info("[学习计划流式] 检测到JSON开始标记")
                json_started = True
                buffer = buffer[buffer.find("```json") + 7:]
                continue
            
            # 检测介绍部分完成标记
            if not introduction_parsed and intro_marker in buffer:
                logger.info(f"[学习计划流式] 检测到介绍完成标记")
                intro_end = buffer.find(intro_marker)
                intro_json = buffer[:intro_end].strip()
                
                # 尝试解析介绍JSON
                try:
                    if '"introduction":' in intro_json:
                        # 确保JSON格式正确
                        if not intro_json.startswith('{'):
                            intro_json = '{' + intro_json
                        if not intro_json.endswith('}'):
                            intro_json = intro_json + '}'
                        
                        intro_data = json_repair.loads(intro_json)
                        logger.info(f"[学习计划流式] 成功解析课程介绍")
                        
                        if "introduction" in intro_data:
                            yield {"introduction": intro_data["introduction"]}
                            introduction_parsed = True
                except json.JSONDecodeError as e:
                    logger.error(f"[学习计划流式] 解析介绍JSON失败: {e}",exc_info=True)
                    logger.error(f"[学习计划流式] 问题JSON: {intro_json}")
                    traceback.print_exc()
                
                # 清理缓冲区
                buffer = buffer[intro_end + len(intro_marker):]
            
            # 检测步骤完成标记
            if step_marker in buffer:
                logger.info(f"[学习计划流式] 检测到步骤完成标记")
                step_end = buffer.find(step_marker)
                step_json = buffer[:step_end].strip()
                
                # 清理JSON字符串
                step_json = step_json.strip(',')  # 移除前后的逗号
                step_json = step_json.strip()     # 移除空白字符
                
                # 提取单个步骤
                if '"plan": [' in step_json:
                    # 找到第一个步骤的开始和结束
                    start = step_json.find('{', step_json.find('"plan": ['))
                    end = step_json.find('}', start) + 1
                    if start != -1 and end != 0:
                        step_json = step_json[start:end]
                
                # 确保JSON格式正确
                if not step_json.startswith('{'):
                    step_json = '{' + step_json
                if not step_json.endswith('}'):
                    step_json = step_json + '}'
                
                # 尝试解析步骤JSON
                try:
                    step_data = json_repair.loads(step_json)
                    logger.info(f"[学习计划流式] 成功解析步骤 {current_step_num + 1}")
                    yield step_data
                    current_step_num += 1
                except json.JSONDecodeError as e:
                    logger.error(f"[学习计划流式] 解析步骤JSON失败: {e}",exc_info=True)
                    logger.error(f"[学习计划流式] 问题JSON: {step_json}")
                    traceback.print_exc()
                
                # 清理缓冲区
                buffer = buffer[step_end + len(step_marker):]
            
            # 检测JSON结束
            if "```" in buffer and json_started:
                logger.info("[学习计划流式] 检测到JSON结束标记")
                break
    finally:
        # 流会自动管理，不需要手动关闭
        pass

def parse_learning_plan(text):
    """
    解析学习计划文本，提取JSON数据
    """
    try:
        logger.info(f"开始解析学习计划: 文本长度 {len(text)}")
        
        # 预处理：尝试去除可能干扰JSON解析的字符
        text = text.replace('\r', ' ').replace('\t', ' ')
        
        # 尝试直接解析完整的JSON
        try:
            result = json.loads(text)
            logger.info("成功解析完整JSON")
            return result
        except json.JSONDecodeError as e:
            logger.warning(f"直接解析JSON失败: {str(e)}")
        
        # 尝试提取介绍部分
        intro_pattern = r'("introduction"\s*:\s*{[\s\S]*?})'
        intro_matches = re.search(intro_pattern, text)
        introduction = None
        
        if intro_matches:
            try:
                intro_str = '{' + intro_matches.group(1) + '}'
                intro_data = json.loads(intro_str)
                logger.info("成功提取课程介绍部分")
                introduction = intro_data.get("introduction")
            except json.JSONDecodeError as e:
                logger.warning(f"解析介绍部分失败: {str(e)}")
        
        # 尝试正则提取JSON部分
        json_pattern = r'({[\s\S]*"plan"\s*:\s*\[[\s\S]*\][\s\S]*})'
        matches = re.search(json_pattern, text)
        
        if matches:
            try:
                json_str = matches.group(1)
                result = json.loads(json_str)
                logger.info("通过正则提取成功解析JSON")
                
                # 如果成功提取了介绍部分，添加到结果中
                if introduction:
                    result["introduction"] = introduction
                    
                return result
            except json.JSONDecodeError as e:
                logger.warning(f"正则提取后解析JSON失败: {str(e)}")
        
        # 尝试提取plan数组部分
        plan_pattern = r'"plan"\s*:\s*(\[[\s\S]*\])'
        plan_matches = re.search(plan_pattern, text)
        
        if plan_matches:
            try:
                plan_str = plan_matches.group(1)
                plan_data = json.loads(plan_str)
                logger.info("提取plan数组成功")
                
                result = {"plan": plan_data}
                
                # 如果成功提取了介绍部分，添加到结果中
                if introduction:
                    result["introduction"] = introduction
                    
                return result
            except json.JSONDecodeError as e:
                logger.warning(f"解析plan数组失败: {str(e)}")
        
        # 兜底方案：构造基本结构
        result = {"plan": []}
        
        # 如果成功提取了介绍部分，添加到结果中
        if introduction:
            result["introduction"] = introduction
        
        logger.warning("无法解析完整学习计划，返回部分解析结果")
        return result
        
    except Exception as e:
        logger.error(f"解析学习计划发生异常: {str(e)}",exc_info=True)
        return {"plan": []}


# 流式模拟函数
async def generate_mock_learning_plan_stream(learning_goal, course_content=None):
    """
    模拟流式生成学习计划，用于测试
    
    Args:
        learning_goal: 用户学习目标
        course_content: 可选的课程内容参考
        
    Yields:
        每个步骤的JSON对象
    """
    print(f"[流式模拟] 为学习目标生成计划: {learning_goal}")
    if course_content:
        print(f"[流式模拟] 参考课程内容: {course_content[:100]}...")
    
    # 模拟学习计划步骤
    steps = [
        {
            "step": 1,
            "title": "了解基本概念",
            "description": "学习强化学习的基本概念和术语",
            "animation_type": "无",
            "status": "当前进行"
        },
        {
            "step": 2,
            "title": "环境建模",
            "description": "学习如何将问题建模为马尔可夫决策过程",
            "animation_type": "迷宫",
            "status": "待完成"
        },
        {
            "step": 3,
            "title": "Q值表学习",
            "description": "学习Q值表的构建和更新机制",
            "animation_type": "表格",
            "status": "待完成"
        }
    ]
    
    # 模拟流式输出
    for step in steps:
        await asyncio.sleep(1)  # 模拟延迟
        yield step 

async def generate_plan_update_stream(current_plan, messages, learning_goal):
    """
    根据用户消息和当前计划生成计划更新
    
    Args:
        current_plan: 当前完整的学习计划
        messages: 用户消息历史
        learning_goal: 原始学习目标
        
    Yields:
        需要更新的步骤对象 {step_number, step_data}
    """
    if llm_client.initialization_error:
        raise Exception(f"AI客户端初始化失败: {llm_client.initialization_error}")
    
    try:
        print(f"[计划更新流式] 开始分析计划更新需求")
        
        # 构建更新提示词
        user_request = messages[-1]['content'] if messages else ""
        current_plan_text = json.dumps(current_plan, ensure_ascii=False, indent=2)
        
        update_prompt = f"""
### 角色定义
您是学习计划优化专家，需要根据用户的反馈对现有学习计划进行精准修改。

### 当前学习计划
{current_plan_text}

### 用户修改要求
{user_request}

### 任务要求
请分析用户的修改要求，确定需要修改哪些步骤，并生成修改后的步骤内容。

### 输出格式
请按照以下JSON格式返回需要修改的内容：

```json
{{
  "introduction": {{
    "course_info": "课程基本信息",
    "background": "课程背景信息",
    "overview": "课程内容概览",
    "prerequisites": "课程要求"
  }}#INTRODUCTION_COMPLETE#
  "updates": [
    {{
      "step_number": 需要修改的步骤号,
      "step_data": {{
        "step": 步骤号,
        "title": "新的步骤标题",
        "description": "新的步骤描述",
        "animation_type": "迷宫/表格/无",
        "status": "状态"
      }}
    }}#UPDATE_COMPLETE#
  ]
}}
```

注意:
1. 如果需要修改课程介绍部分，请在introduction后添加 #INTRODUCTION_COMPLETE# 标记
2. 只返回需要修改的步骤
3. 保持原有的步骤编号和状态逻辑
4. 必须在每个更新项后添加 #UPDATE_COMPLETE# 标记
5. 确保JSON格式正确
"""
        
        # 调用LLM生成更新
        print(f"[计划更新流式] 调用LLM生成计划更新")
        stream = llm_client.stream_chat([{"role": "user", "content": update_prompt}])
        
        # 处理流式响应
        buffer = ""
        json_started = False
        update_marker = "#UPDATE_COMPLETE#"
        intro_marker = "#INTRODUCTION_COMPLETE#"
        introduction_parsed = False
        
        async for chunk in stream:
            if not chunk:
                continue
            
            buffer += chunk
            
            # 检测JSON开始
            if not json_started and "```json" in buffer:
                print("[计划更新流式] 检测到JSON开始标记")
                json_started = True
                buffer = buffer[buffer.find("```json") + 7:]
                continue
            
            # 检测介绍部分完成标记
            if not introduction_parsed and intro_marker in buffer:
                print(f"[计划更新流式] 检测到介绍完成标记")
                intro_end = buffer.find(intro_marker)
                intro_json = buffer[:intro_end].strip()
                
                # 尝试解析介绍JSON
                try:
                    if '"introduction":' in intro_json:
                        # 确保JSON格式正确
                        if not intro_json.startswith('{'):
                            intro_json = '{' + intro_json
                        if not intro_json.endswith('}'):
                            intro_json = intro_json + '}'
                        
                        intro_data = json_repair.loads(intro_json)
                        print(f"[计划更新流式] 成功解析课程介绍")
                        
                        if "introduction" in intro_data:
                            yield {"introduction": intro_data["introduction"]}
                            introduction_parsed = True
                except json.JSONDecodeError as e:
                    print(f"[计划更新流式] 解析介绍JSON失败: {e}")
                    print(f"[计划更新流式] 问题JSON: {intro_json}")
                    traceback.print_exc()
                
                # 清理缓冲区
                buffer = buffer[intro_end + len(intro_marker):]
            
            # 检测更新完成标记
            if update_marker in buffer:
                print(f"[计划更新流式] 检测到更新完成标记")
                update_end = buffer.find(update_marker)
                update_json = buffer[:update_end].strip()
                
                # 清理JSON字符串
                update_json = update_json.strip(',').strip()
                
                # 提取单个更新项
                if '"updates": [' in update_json:
                    start = update_json.find('{', update_json.find('"updates": ['))
                    end = update_json.find('}', start) + 1
                    if start != -1 and end != 0:
                        update_json = update_json[start:end]
                
                # 确保JSON格式正确
                if not update_json.startswith('{'):
                    update_json = '{' + update_json
                if not update_json.endswith('}'):
                    update_json = update_json + '}'
                
                # 尝试解析更新JSON
                try:
                    update_data = json.loads(update_json)
                    print(f"[计划更新流式] 成功解析更新项")
                    yield update_data
                except json.JSONDecodeError as e:
                    print(f"[计划更新流式] 解析更新JSON失败: {e}")
                    print(f"[计划更新流式] 问题JSON: {update_json}")
                    traceback.print_exc()
                
                # 清理缓冲区
                buffer = buffer[update_end + len(update_marker):]
            
            # 检测JSON结束
            if "```" in buffer and json_started:
                print("[计划更新流式] 检测到JSON结束标记")
                break
    
    except Exception as e:
        print(f"[计划更新流式] 生成计划更新失败: {e}")
        traceback.print_exc()
        raise 