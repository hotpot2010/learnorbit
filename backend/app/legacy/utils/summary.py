from src.prompts.summarize import SUMMARY_SYSTEM_PROMPT, SUMMARY_USER_PROMPT
from src.llm.call_llm import llm_client

async def summarize_document(content: str):
    messages=[
        {"role": "system", "content": SUMMARY_SYSTEM_PROMPT},
        {"role": "user", "content": SUMMARY_USER_PROMPT.format(content=content)}
    ]
    response = await llm_client.chat_completion(messages)
    return response.choices[0].message.content