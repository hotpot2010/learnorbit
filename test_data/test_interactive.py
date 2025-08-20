#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
交互式测试工具：依次调用chat接口和stream_generate接口
支持多轮对话，保存对话历史
"""

import asyncio
import aiohttp
import json
import sys
import time
import uuid
import os
output_dir="sampleoutput"
DEFAULT_SERVER = "http://172.30.116.44:5001"
# DEFAULT_SERVER="https://study-platform.zeabur.app"
# DEFAULT_SERVER="https://studyplatform-tokyo.zeabur.app"
async def call_task_generate_api(server_url, input_data):
    url = f"{server_url}/api/task/generate"
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=input_data) as response:
                if response.status != 200:
                    print(f"请求失败，状态码：{response.status}")
                    error_text = await response.text()
                    print(f"错误信息: {error_text}")
                    return None
                return await response.json()
    except Exception as e:
        print(f"调用Task Generate API时出错: {e}")
        return None

async def call_chat_api(server_url, messages, session_id=None,lang="zh"):
    """
    调用chat接口
    
    参数:
    - server_url: 服务器URL
    - messages: 消息列表
    - session_id: 会话ID，如果为None则生成新ID
    
    返回:
    - 会话ID和响应内容
    """
    if session_id is None:
        session_id = str(uuid.uuid4())
    
    url = f"{server_url}/api/chat1/stream"
    data = {
        "id": session_id,
        "messages": messages,
        "lang": lang
    }
    
    print(f"正在调用Chat API...")
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=data) as response:
                if response.status != 200:
                    print(f"请求失败，状态码：{response.status}")
                    error_text = await response.text()
                    print(f"错误信息: {error_text}")
                    return session_id, None
                
                result = await response.json()
                return session_id, result
                
    except Exception as e:
        print(f"调用Chat API时出错: {e}")
        return session_id, None

async def call_stream_generate(server_url, messages, session_id, is_update=False, advise=None,lang="zh"):
    """
    调用stream_generate接口
    
    参数:
    - server_url: 服务器URL
    - messages: 消息列表
    - session_id: 会话ID
    - is_update: 是否为更新模式
    - advise: 更新建议
    """
    url = f"{server_url}/api/learning/plan/stream_generate"
    
    data = {
        "id": session_id,
        "messages": messages,
        "lang": lang
    }
    
    if is_update and advise:
        data["advise"] = json.dumps(advise,ensure_ascii=False)
    
    mode = "更新" if is_update else "创建"
    print(f"正在{mode}学习计划...")
    
    try:
        async with aiohttp.ClientSession() as session:
            start_time = time.time()
            async with session.post(url, json=data) as response:
                if response.status != 200:
                    print(f"请求失败，状态码：{response.status}")
                    error_text = await response.text()
                    print(f"错误信息: {error_text}")
                    return None
                
                print("开始接收流式响应...")
                step_count = 0
                introduction = None
                
                async for line in response.content:
                    if line.startswith(b'data: '):
                        json_str = line.decode('utf-8').replace('data: ', '')
                        try:
                            data_obj = json.loads(json_str)
                            
                            if "error" in data_obj:
                                print(f"\n错误: {data_obj['error']}")
                            elif "warning" in data_obj:
                                print(f"\n警告: {data_obj['warning']}")
                            elif "message" in data_obj:
                                print(f"\n消息: {data_obj['message']}")
                            elif "introduction" in data_obj:
                                print("\n课程介绍:")
                                intro = data_obj["introduction"]
                                introduction = intro
                                print(json.dumps(intro, ensure_ascii=False, indent=2))
                            elif "step" in data_obj:
                                step_count += 1
                                step = data_obj["step"]
                                step_number = data_obj.get("step_number", step_count)
                                total = data_obj.get("total", "未知")
                                
                                print(f"\n步骤 {step_number}/{total}:")
                                print(step)
                                # print(f"标题: {step.get('title', '无标题')}")
                                # print(f"描述: {step.get('description', '无描述')}...")
                                if "videos" in step:
                                    print(f"视频数量: {len(step.get('videos', []))}")
                            elif "done" in data_obj and data_obj["done"]:
                                end_time = time.time()
                                duration = end_time - start_time
                                print(f"\n计划生成完成! 耗时: {duration:.2f}秒")
                                if "plan" in data_obj:
                                    plan = data_obj["plan"]
                                    if introduction:
                                        plan["introduction"] = introduction
                                    print(f"计划包含 {len(plan.get('plan', []))} 个步骤")
                                    return plan
                        except json.JSONDecodeError as e:
                            print(f"解析JSON失败: {e}")
                            print(f"原始数据: {json_str}")
    
    except Exception as e:
        print(f"调用Stream Generate API时出错: {e}")
    
    return None

async def interactive_test(server_url):
    """
    交互式测试主函数
    
    参数:
    - server_url: 服务器URL
    """
    session_id = None
    messages = []
    round_count = 0
    last_plan = None
    
    print("===== 交互式API测试工具 =====")
    print("(输入'q'退出)")
    lang=input("请输入语言(zh/en): ")
    output_json_input = input("是否将Plan和Task输出到json文件中？ (y/n): ").lower()
    output_json = output_json_input == 'y'
    
    while True:
        round_count += 1
        print(f"\n===== 第 {round_count} 轮对话 =====")
        
        # 获取用户输入
        user_input = input("\n请输入您的问题: ")
        if user_input.lower() == 'q':
            print("再见！")
            break
            
        # 添加用户消息
        messages.append({"role": "user", "content": user_input})
        
        # 调用Chat API
        session_id, chat_response = await call_chat_api(server_url, messages, session_id,lang=lang)
        if chat_response:
            print("\nChat API 响应:")
            print(chat_response)
            
            # 提取响应中的文本内容
            response_text = chat_response.get("response", "")
            update_steps = chat_response.get("updateSteps", [])
            reason = chat_response.get("reason", "")
            
            print("\n回复内容:")
            print(response_text)
            if update_steps:
                print("\n建议更新步骤:", update_steps)
            if reason:
                print("\n更新原因:", reason)
            
            # 添加助手回复到消息列表
            messages.append({"role": "assistant", "content": response_text})
            
            # 调用Stream Generate API
            is_update = round_count > 1
            advise = None
            
            if is_update:
                # 如果Chat API返回了建议的更新步骤，使用这些步骤
                if update_steps:
                    steps_to_update = update_steps
                    update_reason = reason or "基于对话内容的自动更新"
                    print(f"\n使用API建议的更新步骤: {steps_to_update}")
                    print(f"更新原因: {update_reason}")
                    advise = {
                        "updateSteps": steps_to_update,
                        "reason": update_reason
                    }
                else:
                    # 否则手动输入
                    print("\n请输入需要更新的步骤编号(逗号分隔):")
                    steps_input = input("步骤编号: ")
                    print("请输入更新原因:")
                    update_reason = input("原因: ")
                    
                    if steps_input:
                        try:
                            steps = [int(s.strip()) for s in steps_input.split(",")]
                            advise = {
                                "updateSteps": steps,
                                "reason": update_reason or "用户需求有所变化"
                            }
                        except ValueError:
                            print("步骤编号格式错误，将不指定要更新的步骤")
            
            # 调用学习计划生成API
            last_plan = await call_stream_generate(
                server_url, 
                messages, 
                session_id, 
                is_update, 
                advise,
                lang=lang
            )
            
            if last_plan and 'plan' in last_plan:
                # 准备并发请求的任务列表
                task_requests = []
                for i, step in enumerate(last_plan['plan']):
                    step["id"] = session_id
                    task_requests.append((i, step))
                
                print("\n开始并发生成任务...")
                
                # 定义辅助函数来处理单个任务请求
                async def process_task(index, step_data):
                    task_data = await call_task_generate_api(server_url, step_data)
                    print(f"step {step_data['step']}:")
                    print(task_data)
                    print("*"*100)
                    return index, task_data
                
                # 并发执行所有任务请求
                tasks = [process_task(idx, step) for idx, step in task_requests]
                task_results = await asyncio.gather(*tasks)
                
                # 将结果映射回原始计划
                for idx, task_data in task_results:
                    if task_data:
                        last_plan['plan'][idx]['task'] = task_data

                print("\n学习计划生成成功!")
                if output_json:
                    if not os.path.exists(output_dir):
                        os.makedirs(output_dir)
                    filename = f"plan_and_tasks_{session_id}.json"
                    with open(os.path.join(output_dir, filename), 'w', encoding='utf-8') as f:
                        json.dump(last_plan, f, ensure_ascii=False, indent=4)
                    print(f"\n计划和任务已保存到 {filename}")
            else:
                print("\n学习计划生成失败!")
        else:
            print("Chat API调用失败，跳过本轮对话")

def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description="交互式API测试工具")
    parser.add_argument("--server", default=DEFAULT_SERVER, help="服务器URL")
    
    args = parser.parse_args()
    
    try:
        asyncio.run(interactive_test(args.server))
    except KeyboardInterrupt:
        print("\n程序被用户中断")
    except Exception as e:
        print(f"程序运行出错: {e}")

if __name__ == "__main__":
    main()