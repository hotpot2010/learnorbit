#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试练习生成API
"""

import requests
import json

# API URL
url = "http://localhost:8000/notes/generate-exercise"

# 测试数据
test_data = {
    "knowledge_point_name": "Python列表基础",
    "transcript_segment": """
    列表是Python中最常用的数据结构之一。
    我们可以使用方括号来创建列表，例如：numbers = [1, 2, 3, 4, 5]
    列表可以存储不同类型的数据，包括数字、字符串、甚至其他列表。
    我们可以使用索引来访问列表中的元素，索引从0开始。
    使用 len() 函数可以获取列表的长度。
    列表还支持切片操作，可以方便地获取子列表。
    """,
    "video_title": "Python基础教程 - 列表入门",
    "video_url": "https://www.bilibili.com/video/BV1234567890"
}

print("=" * 60)
print("🧪 测试练习生成API")
print("=" * 60)
print()

print("📤 发送请求...")
print(f"URL: {url}")
print(f"知识点: {test_data['knowledge_point_name']}")
print()

try:
    response = requests.post(url, json=test_data, timeout=60)
    
    print(f"✅ 响应状态码: {response.status_code}")
    print()
    
    if response.status_code == 200:
        data = response.json()
        
        if data.get('success'):
            print("🎉 练习生成成功！")
            print()
            
            exercise = data.get('exercise', {})
            
            print("📋 练习题信息:")
            print(f"  题型: {exercise.get('type')}")
            print(f"  标题: {exercise.get('title')}")
            print(f"  描述: {exercise.get('description')}")
            print(f"  难度: {exercise.get('difficulty')}")
            print(f"  语言: {exercise.get('language')}")
            print()
            
            print("💻 初始代码:")
            print("-" * 60)
            print(exercise.get('starter_code', ''))
            print("-" * 60)
            print()
            
            hints = exercise.get('hints', [])
            print(f"💡 提示 ({len(hints)} 个):")
            for i, hint in enumerate(hints, 1):
                print(f"  {i}. {hint}")
            print()
            
            test_cases = exercise.get('test_cases', [])
            print(f"🧪 测试用例 ({len(test_cases)} 个):")
            for i, test in enumerate(test_cases, 1):
                print(f"  {i}. 输入: {test.get('input')}")
                print(f"     期望: {test.get('expected')}")
            print()
            
            print("✅ 完整JSON:")
            print(json.dumps(exercise, indent=2, ensure_ascii=False))
            
        else:
            print(f"❌ 练习生成失败: {data.get('error')}")
    else:
        print(f"❌ API请求失败: {response.status_code}")
        print(response.text)

except requests.exceptions.Timeout:
    print("❌ 请求超时（60秒）")
except requests.exceptions.ConnectionError:
    print("❌ 连接失败，请确保后端服务正在运行")
    print("提示: 在backend目录运行 'python -m uvicorn main:app --reload'")
except Exception as e:
    print(f"❌ 发生错误: {e}")
    import traceback
    traceback.print_exc()

print()
print("=" * 60)
print("测试完成")
print("=" * 60)

