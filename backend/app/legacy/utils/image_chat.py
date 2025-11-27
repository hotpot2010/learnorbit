from openai import AsyncOpenAI
from dotenv import load_dotenv
import os
import re
from asyncio import run
load_dotenv()

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"), base_url=os.getenv("OPENAI_BASE_URL"))

async def image_chat(images, description):
    prompt=f"""你是一位图文匹配评估助手。
请阅读以下文字，并查看图片。你的任务是判断图片是否符合文字内容。

【评分标准】
- 图片内容是否直接反映文字主题；
- 图片是否能帮助理解文字；
- 图片中是否出现了文字描述的关键元素。

【文字内容】
{description}

【输出格式】
直接输出分数,分数范围为0-10分,分数越高,图片与文字的相关性越强,越符合文字内容,只输出分数,不要输出其他内容。

    """
    messages=[
        {"role": "user", "content": [{"type":"text","text":prompt}]}]
    for image in images:
        messages[0]["content"].append({"type":"image_url","image_url":{"url":image}})
    response = await client.chat.completions.create(model="THUDM/GLM-4.1V-9B-Thinking", messages=messages, stream=False)
    
    # Extract the score from the response
    content = response.choices[0].message.content
    # Extract number from content (handles formats like "分数：9" or just "9")
    match = re.search(r'\d+(?:\.\d+)?', content)
    if match:
        score = float(match.group())
        return int(score) if score.is_integer() else score
    return 0  # Default score if parsing fails

if __name__ == "__main__":
    images=[
       "https://pic.leetcode.cn/1720231746-FwkEem-%E5%BF%83%E6%B5%81.jpg"
    ]
    response = run(image_chat(images, "如何科学的刷题"))
    print(response)