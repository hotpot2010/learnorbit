# B站多P视频处理指南 🎬

B站的多P视频（系列/合集）需要特殊处理，否则会导致下载失败或分析超时。

## 🎯 什么是多P视频？

多P视频是指一个BV号下包含多个分集的视频，例如：
- 系列教程（第1集、第2集、第3集...）
- 连续剧、番剧
- 演唱会分段
- 课程合集

**识别特征**：
- 视频播放器下方有分集列表
- URL 中可以看到 `?p=N` 参数
- 标题显示"共N集"

## ❌ 常见问题

### 问题 1: 下载格式错误

```
ERROR: Requested format is not available
```

**原因**：尝试下载整个系列，但 yt-dlp 无法处理

### 问题 2: 分析超时

```
504 The request timed out
processing_time: 629 秒
```

**原因**：
- 下载了多个分集的合并文件
- 文件太大，Gemini API 超时
- 或者分析内容太多

## ✅ 解决方案

### 方案 1: 手动指定分集 ⭐ (推荐)

在URL后添加 `?p=N` 指定要分析的分集：

```bash
# 错误 ❌ - 会处理整个系列
https://www.bilibili.com/video/BV1Jgf6YvE8e

# 正确 ✅ - 只处理第1集
https://www.bilibili.com/video/BV1Jgf6YvE8e?p=1

# 第2集
https://www.bilibili.com/video/BV1Jgf6YvE8e?p=2

# 第3集
https://www.bilibili.com/video/BV1Jgf6YvE8e?p=3
```

### 方案 2: 自动处理（已实现）✨

代码已更新，**自动检测多P视频并默认下载第1集**：

```python
# 输入原始 URL
url = "https://www.bilibili.com/video/BV1Jgf6YvE8e"

# 代码自动检测并调整
# ⚠️  检测到可能是多P视频，默认下载第1集
# ✅ 已自动调整为第1集: ...?p=1
```

**日志输出示例**：
```
⚠️  检测到可能是多P视频，默认下载第1集
   如需指定其他分集，请在URL后添加 ?p=N
✅ 已自动调整为第1集: https://www.bilibili.com/video/BV1Jgf6YvE8e?p=1
```

## 📝 使用示例

### 示例 1: 批量分析系列教程的多集

```
任务名称：Python入门教程全集分析

视频列表：
https://www.bilibili.com/video/BV1Jgf6YvE8e?p=1
https://www.bilibili.com/video/BV1Jgf6YvE8e?p=2
https://www.bilibili.com/video/BV1Jgf6YvE8e?p=3
https://www.bilibili.com/video/BV1Jgf6YvE8e?p=4

Prompt：请总结这一集的核心知识点
```

### 示例 2: 只分析某一特定集

```
视频URL：https://www.bilibili.com/video/BV1Jgf6YvE8e?p=5
Prompt：请详细分析第5集的内容，提取所有代码示例
```

### 示例 3: 使用自动检测

```
# 输入原始URL，系统自动处理第1集
视频URL：https://www.bilibili.com/video/BV1Jgf6YvE8e

# 系统会自动调整为
实际处理：https://www.bilibili.com/video/BV1Jgf6YvE8e?p=1
```

## 🔍 如何判断是否是多P视频？

### 方法 1: 在浏览器中打开

打开视频链接，查看播放器下方：
- 有分集列表 → **是多P视频** ✅
- 没有分集列表 → 单P视频

### 方法 2: 使用命令行

```bash
yt-dlp --flat-playlist "https://www.bilibili.com/video/BV1Jgf6YvE8e"
```

输出显示多个条目 → 多P视频

### 方法 3: 查看后端日志

运行批量分析时，查看日志：
```
⚠️  检测到可能是多P视频，默认下载第1集
```

## 💡 最佳实践

### 1. 处理整个系列

如果要分析整个系列的所有集：

```python
# 假设系列有10集
base_url = "https://www.bilibili.com/video/BV1Jgf6YvE8e"
video_urls = [f"{base_url}?p={i}" for i in range(1, 11)]

# 在批量分析页面逐个添加
```

### 2. 选择性分析

只分析感兴趣的几集：

```python
# 只分析第1、5、10集
video_urls = [
    "https://www.bilibili.com/video/BV1Jgf6YvE8e?p=1",
    "https://www.bilibili.com/video/BV1Jgf6YvE8e?p=5",
    "https://www.bilibili.com/video/BV1Jgf6YvE8e?p=10",
]
```

### 3. 缓存优化

相同的分集+相同的Prompt会使用缓存：

```python
# 第一次分析 - 完整流程
url = "https://www.bilibili.com/video/BV1Jgf6YvE8e?p=1"
result1 = analyze(url, prompt)  # 耗时 50s

# 第二次分析 - 使用缓存
result2 = analyze(url, prompt)  # 耗时 <1s ✨
```

## ⚠️ 注意事项

### 1. URL 格式要精确

```bash
# 不同的URL = 不同的缓存

# 这些被视为不同的视频：
https://www.bilibili.com/video/BV1Jgf6YvE8e        # 自动 → ?p=1
https://www.bilibili.com/video/BV1Jgf6YvE8e?p=1   # 明确指定
https://www.bilibili.com/video/BV1Jgf6YvE8e?p=2   # 不同分集

# 建议：明确指定 ?p=N 避免混淆
```

### 2. 分集数量限制

- 每个分集单独下载和分析
- 大量分集会耗费大量时间和API配额
- 建议：每批处理 5-10 集

### 3. 超时问题

单集视频超时（>10分钟）的可能原因：
- 该集视频太长（>30分钟）
- 视频内容太复杂
- Prompt 要求太详细

**解决方案**：
- 简化 Prompt
- 选择较短的分集
- 分段处理

## 🧪 测试示例

### 测试 1: 验证自动检测

```bash
cd backend
python test_multi_part_video.py
```

### 测试 2: 命令行验证

```bash
# 查看视频信息
yt-dlp --flat-playlist "https://www.bilibili.com/video/BV1Jgf6YvE8e"

# 下载第1集
yt-dlp "https://www.bilibili.com/video/BV1Jgf6YvE8e?p=1"
```

## 📊 性能对比

### 场景：10集系列教程

#### ❌ 错误做法
```
尝试下载整个系列 → 失败/超时
时间：浪费 10+ 分钟
结果：失败 ❌
```

#### ✅ 正确做法
```
逐集下载和分析：
- 第1集: 2分钟（下载 + 分析）
- 第2集: <1秒（命中缓存，如果重复分析）
- ...
- 第10集: 2分钟

总计：~20分钟（如果都是新内容）
结果：成功 ✅
```

## 🎓 总结

### 关键要点

1. **多P视频需要指定分集** - 使用 `?p=N`
2. **代码已自动处理** - 默认第1集
3. **明确指定更好** - 避免混淆和缓存问题
4. **逐集分析** - 不要尝试一次性处理整个系列
5. **使用缓存** - 相同URL+Prompt会复用结果

### 快速参考

```bash
# 单P视频（正常）
https://www.bilibili.com/video/BV1xx411xxx

# 多P视频第1集
https://www.bilibili.com/video/BV1Jgf6YvE8e?p=1

# 多P视频第N集
https://www.bilibili.com/video/BV1Jgf6YvE8e?p=N

# 自动检测（系统会调整为?p=1）
https://www.bilibili.com/video/BV1Jgf6YvE8e
```

---

**现在重启后端，系统会自动处理多P视频！** 🚀

遇到多P视频时，系统会：
1. 自动检测
2. 提示用户
3. 默认处理第1集
4. 建议如何指定其他分集


