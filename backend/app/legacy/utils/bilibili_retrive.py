from bilibili_api import search
from log import logger
async def retrive(title:str):
    search_query=f'{title}'
    res=[]
    search_result=await search.search_by_type(search_query,search.SearchObjectType.VIDEO,search.OrderVideo.TOTALRANK)
    for item in search_result['result'][:5]:
        if item['type']=='video':
            res.append(dict(title=item['title'].replace("<em class=\"keyword\">","").replace("</em>",""),url=item['arcurl'],cover=item['pic'],duration=item['duration']))
    return res

async def retrive_rerank(title:str):
    search_query=f'{title}'
    res=[]
    try:
        search_result=await search.search_by_type(search_query,search.SearchObjectType.VIDEO,search.OrderVideo.TOTALRANK)
    except Exception as e:
        logger.error(f"[Bilibili Retrive] 获取视频推荐失败: {e}",exc_info=True)
        return []
    
    # 先收集前5个视频
    for item in search_result['result'][:5]:
        if item['type']=='video':
            # 解析时长为秒数
            duration_str = item['duration']
            duration_parts = duration_str.split(':')
            if len(duration_parts) == 2:
                duration_seconds = int(duration_parts[0]) * 60 + int(duration_parts[1])
            elif len(duration_parts) == 3:
                duration_seconds = int(duration_parts[0]) * 3600 + int(duration_parts[1]) * 60 + int(duration_parts[2])
            else:
                duration_seconds = int(duration_parts[0])
            
            res.append({
                'title': item['title'].replace("<em class=\"keyword\">","").replace("</em>",""),
                'url': item['arcurl'],
                'cover': item['pic'],
                'duration': item['duration'],
                'duration_seconds': duration_seconds,
                'original_rank': len(res)  # 记录原始排名
            })
    
    # 重排序逻辑
    threshold = 30  # 30秒阈值
    
    # 基于综合得分排序
    for i in range(len(res)):
        # 计算时长分数（时长越短分数越高）
        max_duration = max(v['duration_seconds'] for v in res)
        min_duration = min(v['duration_seconds'] for v in res)
        duration_range = max_duration - min_duration if max_duration != min_duration else 1
        duration_score = 1 - (res[i]['duration_seconds'] - min_duration) / duration_range
        
        # 计算原始排名分数
        rank_score = 1 / (res[i]['original_rank'] + 1)
        
        # 综合得分：权重可调整
        res[i]['score'] = 0.6 * duration_score + 0.4 * rank_score
    
    # 按照综合得分排序
    res.sort(key=lambda x: x['score'], reverse=True)
    
    # 检查相邻视频的时长差异，如果小于阈值且原始排名更高，则保持原始排序
    for i in range(len(res) - 1):
        if abs(res[i]['duration_seconds'] - res[i+1]['duration_seconds']) < threshold and res[i]['original_rank'] > res[i+1]['original_rank']:
            res[i], res[i+1] = res[i+1], res[i]
    
    # 移除临时字段
    for item in res:
        del item['duration_seconds']
        del item['original_rank']
        del item['score']
    
    return res

if __name__ == "__main__":
    import asyncio
    res = asyncio.run(retrive_rerank("flash attention"))
    print(res)