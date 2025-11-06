# 🔧 音视频合并修复

## 问题描述

**现象**：
- 下载的视频没有声音
- 通过诊断发现 `bestvideo` 和 `bestaudio` 都可用
- 但下载时只获取了 `bestvideo`（纯视频流）

**根本原因**：
```python
# ❌ 之前的配置
'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/...'
```

- B站视频流可能是 `.flv`、`.m4s` 等格式（不一定是 `.mp4`）
- 音频流可能是 `.mp3`、`.m4s` 等格式（不一定是 `.m4a`）
- **扩展名限制导致格式匹配失败**
- 回退到仅下载 `bestvideo`（无音频）

## 修复方案

### 1. 移除扩展名限制

```python
# ✅ 新的配置
'format': (
    'bestvideo+bestaudio/'  # 🎯 优先：不限扩展名，直接合并
    'bestvideo[ext=mp4]+bestaudio[ext=m4a]/'  # 保留特定格式作为备选
    'bestvideo[height<=1080]+bestaudio/'  # 限制分辨率的组合
    'best[ext=mp4]/best/'  # 单一最佳格式
    'bestvideo/bestaudio'  # 最后才是仅视频或仅音频
)
```

### 2. 强制合并为 MP4

```python
'merge_output_format': 'mp4',  # FFmpeg 自动转换并合并
'postprocessors': [{
    'key': 'FFmpegVideoConvertor',
    'preferedformat': 'mp4',
}],
```

### 3. 优化后处理参数

```python
'postprocessor_args': {
    'default': ['-c:v', 'copy', '-c:a', 'copy']  # 尽量避免重新编码
},
'prefer_ffmpeg': True,  # 强制使用 FFmpeg 进行合并
```

## 工作原理

### 下载流程

```
1. yt-dlp 根据 format 选项查找可用的流：
   ✅ bestvideo: 找到视频流（任意格式）
   ✅ bestaudio: 找到音频流（任意格式）

2. yt-dlp 下载两个流：
   📥 视频流: video.flv (或其他格式)
   📥 音频流: audio.m4s (或其他格式)

3. FFmpeg 合并：
   🔧 ffmpeg -i video.flv -i audio.m4s -c copy output.mp4
   ✅ 输出: 带音频的 MP4 文件
```

### 格式优先级

| 优先级 | 格式选项 | 说明 |
|--------|----------|------|
| 1 | `bestvideo+bestaudio` | ⭐ **最优**：不限格式，直接合并 |
| 2 | `bestvideo[ext=mp4]+bestaudio[ext=m4a]` | 指定格式组合（兼容性好） |
| 3 | `bestvideo[height<=1080]+bestaudio` | 限制分辨率（节省空间） |
| 4 | `best[ext=mp4]` / `best` | 单一流（已包含音视频） |
| 5 | `bestvideo` / `bestaudio` | 最后选择（仅视频或音频） |

## 测试验证

### 运行测试脚本

```bash
cd backend
python test_audio_merge.py
```

### 测试视频

使用之前无音频的视频：
```
https://www.bilibili.com/video/BV1Jgf6YvE8e?p=1
```

### 预期结果

```
✅ 下载成功
✅ 格式选择: bestvideo+bestaudio
✅ 音视频已合并
✅ 文件可正常播放（有声音）
```

### 验证方法

1. **播放测试**：
   ```bash
   # Windows
   start uploads/test_audio_merge.mp4
   
   # 或使用 VLC、PotPlayer 等播放器
   ```

2. **FFprobe 检查**：
   ```bash
   ffprobe -i uploads/test_audio_merge.mp4
   
   # 应该看到：
   # Stream #0:0: Video: ...
   # Stream #0:1: Audio: ...  ← 有音频流
   ```

3. **文件大小对比**：
   ```
   无音频: ~3MB (纯视频)
   有音频: ~5-10MB (视频+音频)
   ```

## 依赖要求

### FFmpeg 必须安装

**检查**：
```bash
ffmpeg -version
```

**安装**：

- **Windows**:
  ```bash
  # 使用 Chocolatey
  choco install ffmpeg
  
  # 或从官网下载
  # https://ffmpeg.org/download.html
  ```

- **Linux**:
  ```bash
  sudo apt-get install ffmpeg
  ```

- **macOS**:
  ```bash
  brew install ffmpeg
  ```

## 性能考虑

### 编码策略

```python
'-c:v', 'copy',  # 视频流直接复制（快速）
'-c:a', 'copy'   # 音频流直接复制（快速）
```

**优点**：
- ⚡ 无需重新编码，速度极快
- 🎯 保持原始质量
- 💾 节省 CPU 资源

**场景**：
- 如果格式不兼容，FFmpeg 会自动重新编码
- 对于大多数 B站视频，直接复制即可

### 下载时间

| 场景 | 时间 |
|------|------|
| 仅视频 (3MB) | ~5-10秒 |
| 视频+音频 (8MB) | ~10-20秒 |
| 合并处理 | ~1-3秒 |
| **总计** | **~15-30秒** |

## 故障排除

### 问题 1: FFmpeg 未安装

**错误**：
```
ERROR: ffmpeg not found. Please install ffmpeg.
```

**解决**：
```bash
# 安装 FFmpeg（见上面的依赖要求部分）
ffmpeg -version  # 验证安装
```

### 问题 2: 合并失败

**错误**：
```
ERROR: Postprocessing: ffmpeg exited with code 1
```

**解决**：
```python
# 尝试强制重新编码
'postprocessor_args': {
    'default': ['-c:v', 'libx264', '-c:a', 'aac']
}
```

### 问题 3: 格式不兼容

**错误**：
```
ERROR: Requested formats are incompatible for merge
```

**解决**：
- 自动回退到 `best` 格式
- 或使用单一流格式（已包含音视频）

### 问题 4: 视频仍无音频

**检查清单**：
1. ✅ FFmpeg 已安装？
2. ✅ `merge_output_format` 设置为 `mp4`？
3. ✅ `prefer_ffmpeg` 设置为 `True`？
4. ✅ 视频本身有音频吗？（某些视频确实是静音的）

**诊断**：
```bash
# 查看 yt-dlp 实际选择的格式
python debug_video_formats.py <video_url>
```

## 修改的文件

- ✅ `backend/app/services/bilibili_service.py`
  - 修改 `download_video()` 方法的 `format` 选项
  - 添加 `merge_output_format` 和 `prefer_ffmpeg`
  - 优化 `postprocessor_args`

- ✅ `backend/test_audio_merge.py`
  - 新增：音视频合并测试脚本

- ✅ `backend/AUDIO_MERGE_FIX.md`
  - 新增：本文档

## 立即生效

```bash
# 1. 重启后端（如果正在运行）
cd backend
python main.py

# 2. 测试
python test_audio_merge.py

# 3. 清理缓存（可选）
# 之前无音频的缓存文件可以删除
rm cache/*.json  # 或手动删除特定文件
```

## 总结

| 项目 | 修复前 | 修复后 |
|------|--------|--------|
| **格式选择** | `bestvideo[ext=mp4]+...` | `bestvideo+bestaudio` |
| **扩展名限制** | ❌ 严格限制 | ✅ 灵活匹配 |
| **音频支持** | ❌ 仅视频 | ✅ 视频+音频 |
| **合并策略** | 可选 | ✅ 强制合并 |
| **性能影响** | - | +10-20秒（下载+合并） |

**修复完成！现在下载的视频应该包含音频了。** 🎉


