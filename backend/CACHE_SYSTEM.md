# 视频分析结果缓存系统 💾

视频分析结果会自动缓存到本地，避免重复分析相同的视频，节省时间和 API 配额。

## ✨ 功能特性

### 1. 自动缓存
- ✅ 分析完成后自动保存到本地
- ✅ 基于视频 URL + Prompt 生成唯一 key
- ✅ 默认缓存 7 天
- ✅ 透明使用，无需手动操作

### 2. 智能匹配
- ✅ 相同视频 + 相同 Prompt = 命中缓存
- ✅ 不同 Prompt = 不同缓存
- ✅ 自动跳过下载和分析步骤

### 3. 缓存管理
- ✅ 查看缓存统计
- ✅ 列出所有缓存
- ✅ 清理过期缓存
- ✅ 清空所有缓存

## 📁 缓存结构

```
backend/
├── cache/                      # 缓存目录
│   ├── cache_index.json       # 缓存索引
│   ├── abc123def456...json    # 缓存文件（MD5 命名）
│   └── ...
```

### 缓存文件格式

```json
{
  "cache_key": "abc123def456...",
  "video_url": "https://www.bilibili.com/video/BV1xx411xxx",
  "prompt": "请分析这个视频...",
  "result": {
    "success": true,
    "video_info": {...},
    "analysis": {...},
    "analyzed_at": "2024-01-05T12:00:00"
  },
  "metadata": {
    "bv_id": "BV1xx411xxx",
    "title": "视频标题"
  },
  "cached_at": "2024-01-05T12:00:00"
}
```

## 🚀 使用方式

### 方式 1: 自动使用（推荐）

缓存功能默认开启，无需任何操作：

```python
# 第一次分析 - 会下载视频并调用 AI
analyzer = BatchAnalyzer(use_cache=True)  # 默认值
result1 = analyzer.analyze_video_with_prompt(url, prompt)

# 第二次分析 - 直接从缓存读取
result2 = analyzer.analyze_video_with_prompt(url, prompt)
# ✅ 跳过下载和 AI 分析，秒级返回！
```

### 方式 2: 禁用缓存

如果需要强制重新分析：

```python
analyzer = BatchAnalyzer(use_cache=False)
result = analyzer.analyze_video_with_prompt(url, prompt)
```

### 方式 3: 手动管理

```python
from app.services.cache_service import CacheService

cache = CacheService(cache_dir="cache")

# 读取缓存
cached = cache.get(video_url, prompt, max_age_hours=24*7)

# 保存缓存
cache.set(video_url, prompt, result, metadata={...})

# 删除缓存
cache.delete(video_url, prompt)
```

## 🔌 API 端点

### 1. 获取缓存统计

```http
GET /batch/cache/stats
```

响应：
```json
{
  "success": true,
  "data": {
    "total_entries": 15,
    "total_size_mb": 2.5,
    "oldest_entry": "2024-01-01T10:00:00",
    "newest_entry": "2024-01-05T15:30:00",
    "cache_dir": "cache"
  }
}
```

### 2. 列出所有缓存

```http
GET /batch/cache/list
```

响应：
```json
{
  "success": true,
  "data": [
    {
      "cache_key": "abc123...",
      "video_url": "https://...",
      "cached_at": "2024-01-05T12:00:00",
      "file_size_kb": 125.6
    }
  ]
}
```

### 3. 清理过期缓存

```http
POST /batch/cache/clear-expired?max_age_hours=24
```

响应：
```json
{
  "success": true,
  "message": "Cleared 5 expired cache entries",
  "cleared_count": 5
}
```

### 4. 清空所有缓存

```http
POST /batch/cache/clear-all
```

响应：
```json
{
  "success": true,
  "message": "Cleared all 15 cache entries",
  "cleared_count": 15
}
```

## 🧪 测试缓存

运行测试脚本：

```bash
cd backend
python test_cache.py
```

测试内容：
- ✅ 保存和读取
- ✅ 缓存过期
- ✅ Key 生成
- ✅ 统计信息
- ✅ 列表查询
- ✅ 清理功能

## 💡 最佳实践

### 1. 缓存有效期建议

```python
# 开发测试：短期缓存
cache.get(url, prompt, max_age_hours=1)

# 正式使用：7天缓存（默认）
cache.get(url, prompt, max_age_hours=24*7)

# 长期缓存：30天
cache.get(url, prompt, max_age_hours=24*30)
```

### 2. 定期清理

```bash
# 每周清理过期缓存（7天以上）
curl -X POST http://localhost:8000/batch/cache/clear-expired?max_age_hours=168

# 每月清理老旧缓存（30天以上）
curl -X POST http://localhost:8000/batch/cache/clear-expired?max_age_hours=720
```

### 3. 监控缓存使用

```bash
# 查看缓存统计
curl http://localhost:8000/batch/cache/stats

# 查看缓存文件
ls -lh backend/cache/
```

## 🔍 缓存命中判断

缓存是否命中基于两个因素：

### 1. 视频 URL 完全相同
```python
# 会命中缓存 ✅
url1 = "https://www.bilibili.com/video/BV1xx411xxx"
url2 = "https://www.bilibili.com/video/BV1xx411xxx"

# 不会命中缓存 ❌
url1 = "https://www.bilibili.com/video/BV1xx411xxx"
url2 = "https://www.bilibili.com/video/BV1xx411xxx?p=2"  # 不同分集
```

### 2. Prompt 完全相同
```python
# 会命中缓存 ✅
prompt1 = "请分析这个视频的内容"
prompt2 = "请分析这个视频的内容"

# 不会命中缓存 ❌
prompt1 = "请分析这个视频的内容"
prompt2 = "请总结这个视频的要点"  # 不同 Prompt
```

## 📊 性能优势

### 未使用缓存
```
第一次：下载视频 (30s) + AI分析 (20s) = 50s
第二次：下载视频 (30s) + AI分析 (20s) = 50s
总计：100s + 2次 API 调用
```

### 使用缓存
```
第一次：下载视频 (30s) + AI分析 (20s) = 50s
第二次：从缓存读取 (<1s) = <1s
总计：51s + 1次 API 调用
节省：49s + 1次 API 调用 = 98% 时间 + 50% API配额
```

## ⚠️ 注意事项

### 1. 磁盘空间
- 每个缓存文件约 50-200KB
- 1000个缓存 ≈ 50-200MB
- 建议预留至少 500MB 空间

### 2. 缓存一致性
- 视频内容更新后，缓存不会自动失效
- 需要手动清理或等待过期
- 或者修改 Prompt 强制重新分析

### 3. 敏感信息
- 缓存文件包含完整的分析结果
- 如有敏感内容，注意文件权限
- 可以定期清空缓存

## 🛠️ 高级配置

### 自定义缓存目录

```python
# 使用自定义缓存目录
analyzer = BatchAnalyzer(storage_dir="batch_results")
analyzer.cache_service = CacheService(cache_dir="/path/to/custom/cache")
```

### 禁用特定任务的缓存

```python
# 临时禁用
analyzer.use_cache = False
result = analyzer.analyze_video_with_prompt(url, prompt)
analyzer.use_cache = True  # 恢复
```

### 手动清理特定视频

```python
# 清理特定视频的缓存
cache.delete(video_url, prompt)
```

## 🐛 故障排查

### 问题 1: 缓存没有命中

**检查清单：**
- [ ] URL 是否完全相同（包括参数）
- [ ] Prompt 是否完全相同（包括空格）
- [ ] 缓存是否过期
- [ ] 缓存文件是否存在

**解决方案：**
```bash
# 查看缓存列表
curl http://localhost:8000/batch/cache/list

# 检查缓存文件
ls -la backend/cache/
```

### 问题 2: 缓存文件损坏

**症状：**
```
⚠️ Failed to read cache: ...
```

**解决方案：**
```bash
# 清空所有缓存
curl -X POST http://localhost:8000/batch/cache/clear-all
```

### 问题 3: 磁盘空间不足

**检查：**
```bash
# 查看缓存大小
du -sh backend/cache/

# 查看缓存统计
curl http://localhost:8000/batch/cache/stats
```

**清理：**
```bash
# 清理过期缓存
curl -X POST http://localhost:8000/batch/cache/clear-expired?max_age_hours=24
```

## 📝 开发计划

未来可能添加的功能：

- [ ] 支持缓存压缩
- [ ] 支持 Redis 缓存
- [ ] 缓存预热
- [ ] 缓存导出/导入
- [ ] 缓存版本控制
- [ ] 缓存加密

## 🎉 总结

缓存系统特点：
- ✅ 自动化：默认开启，透明使用
- ✅ 高效：避免重复下载和分析
- ✅ 节省：减少 API 调用次数
- ✅ 灵活：支持手动管理
- ✅ 可靠：完整的错误处理

立即享受缓存带来的速度提升！🚀


