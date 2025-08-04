#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
测试文件：流式学习计划生成/更新API
"""

import asyncio
import aiohttp
import json
import sys
import argparse
import time
DEFAULT_SERVER = "http://172.30.106.167:5001"

async def test_stream_generate_plan(server_url, mode="create", chat_id=None):
    """
    测试流式生成/更新学习计划API
    
    参数:
    - server_url: 服务器URL
    - mode: 操作模式，'create'表示创建新计划，'update'表示更新现有计划
    - chat_id: 会话ID，如果为None则使用当前时间戳
    """
    if chat_id is None:
        chat_id = f"test_{int(time.time())}"
    
    print(f"测试模式: {mode}, 会话ID: {chat_id}")
    
    # 构建请求数据
    data = {
        "id": chat_id,
        "messages": [
            {"role": "user", "content": "我想学习Python数据分析"}
        ]
    }
    if mode == "update":
        data["messages"] = [
            {"role": "user", "content": "我想学习Python数据分析，特别是Pandas库的使用"}
        ]
        data["advise"] = json.dumps({
            "should_update": [1, 2],  
            "reason": "用户希望更加关注Pandas库的学习"
        })
    url = f"{server_url}/api/learning/plan/stream_generate"
    print(f"发送请求到: {url}")
    print(f"请求数据: {json.dumps(data, ensure_ascii=False)}")
    
    try:
        async with aiohttp.ClientSession() as session:
            start_time = time.time()
            async with session.post(url, json=data) as response:
                if response.status != 200:
                    print(f"请求失败，状态码：{response.status}")
                    error_text = await response.text()
                    print(f"错误信息: {error_text}")
                    return
                
                print("开始接收流式响应...")
                step_count = 0
                
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
                            elif "step" in data_obj:
                                step_count += 1
                                step = data_obj["step"]
                                step_number = data_obj.get("step_number", step_count)
                                total = data_obj.get("total", "未知")
                                
                                print(f"\n步骤 {step_number}/{total}:")
                                print(f"标题: {step.get('title', '无标题')}")
                                print(f"描述: {step.get('description', '无描述')[:100]}...")
                                if "videos" in step:
                                    print(f"视频数量: {len(step.get('videos', []))}")
                            elif "done" in data_obj and data_obj["done"]:
                                end_time = time.time()
                                duration = end_time - start_time
                                print(f"\n计划生成完成! 耗时: {duration:.2f}秒")
                                if "plan" in data_obj:
                                    plan = data_obj["plan"]
                                    print(f"计划包含 {len(plan.get('plan', []))} 个步骤")
                                    
                                    filename = f"plan_{chat_id}_{int(time.time())}.json"
                                    with open(filename, "w", encoding="utf-8") as f:
                                        json.dump(plan, f, ensure_ascii=False, indent=2)
                                    print(f"完整计划已保存到文件: {filename}")
                        except json.JSONDecodeError as e:
                            print(f"解析JSON失败: {e}")
                            print(f"原始数据: {json_str}")
    
    except Exception as e:
        print(f"测试过程中出错: {e}")
    
    return chat_id

async def test_create_then_update(server_url):
    """
    先创建计划，等待10秒后再更新计划
    
    参数:
    - server_url: 服务器URL
    """
    chat_id = f"test_{int(time.time())}"
    print(f"生成的会话ID: {chat_id}")
    print("\n===== 第1步：创建初始学习计划 =====")
    await test_stream_generate_plan(server_url, "create", chat_id)
    print("\n===== 等待10秒 =====")
    await asyncio.sleep(10)
    print("\n===== 第2步：更新学习计划 =====")
    await test_stream_generate_plan(server_url, "update", chat_id)

def main():
    """主函数"""
    parser = argparse.ArgumentParser(description="测试流式学习计划生成/更新API")
    parser.add_argument("--server", default=DEFAULT_SERVER, help="服务器URL")
    parser.add_argument("--mode", choices=["create", "update", "both"], default="both", help="操作模式")
    parser.add_argument("--id", help="会话ID")
    
    args = parser.parse_args()
    
    if args.mode == "both":
        asyncio.run(test_create_then_update(args.server))
    else:
        asyncio.run(test_stream_generate_plan(args.server, args.mode, args.id))

if __name__ == "__main__":
    main() 