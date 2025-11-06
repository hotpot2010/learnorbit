# B站视频下载问题排查指南 🔧

针对 Bilibili 视频下载常见问题的解决方案。

## 🐛 常见错误

### 错误 1: "Requested format is not available"

**完整错误信息：**
```
ERROR: [BiliBili] BV1xxxxx: Requested format is not available. 
Use --list-formats for a list of available formats
```

**原因：**
- B站某些视频（如番剧、电影、付费内容）可能不提供所有格式
- 视频编码格式特殊
- 地区限制或版权保护

**解决方案：**

#### 方案 1: 使用更新后的代码（推荐）
已在 `bilibili_service.py` 中实现自动格式降级：

1. 首先尝试优质格式（1080p MP4）
2. 失败后自动降级到通用格式
3. 使用 `format='best'` 作为最终后备

**无需手动干预**，代码会自动处理。

#### 方案 2: 手动诊断
使用诊断脚本查看可用格式：

```bash
cd backend
python debug_video_formats.py
```

这会显示：
- 视频基本信息
- 所有可用格式列表
- 尝试下载测试

#### 方案 3: 指定特定格式
如果知道视频的特定格式 ID，可以修改代码：

```python
# 在 bilibili_service.py 中
ydl_opts = {
    'format': '64',  # 替换为实际的 format_id
    # ... 其他选项
}
```

### 错误 2: "This video is not available in your region"

**原因：**
- 地区版权限制
- B站大会员内容
- IP 地址被限制

**解决方案：**

1. **使用 Cookie（推荐）**
   
   如果你有 B站账号：
   
   ```bash
   # 1. 在浏览器中登录 B站
   # 2. 导出 Cookie（使用浏览器扩展如 "Get cookies.txt"）
   # 3. 保存为 bilibili_cookies.txt
   ```
   
   修改代码：
   ```python
   ydl_opts = {
       'cookiefile': 'path/to/bilibili_cookies.txt',
       # ... 其他选项
   }
   ```

2. **使用代理**
   
   ```python
   ydl_opts = {
       'proxy': 'http://proxy-server:port',
       # ... 其他选项
   }
   ```

3. **检查视频是否为会员专享**
   - 某些内容需要大会员
   - 使用大会员账号的 Cookie

### 错误 3: "Video too large" 或下载卡住

**原因：**
- 视频文件超过 100MB 限制
- 网络连接不稳定
- 服务器限流

**解决方案：**

1. **调整文件大小限制**
   
   编辑 `gemini_service.py`：
   ```python
   MAX_FILE_SIZE = 200 * 1024 * 1024  # 改为 200MB
   ```

2. **下载较低分辨率**
   
   修改格式选择：
   ```python
   'format': 'bestvideo[height<=720]+bestaudio/best[height<=720]'
   ```

3. **增加超时时间**
   
   ```python
   ydl_opts = {
       'socket_timeout': 60,  # 改为 60 秒
       'retries': 5,  # 增加重试次数
   }
   ```

### 错误 4: "Unable to extract" 或 404 错误

**原因：**
- 视频已被删除或下架
- BV 号错误
- 视频为私密或审核中

**解决方案：**

1. **验证视频链接**
   ```bash
   # 在浏览器中打开链接，确认视频可访问
   ```

2. **检查 BV 号格式**
   ```python
   # 正确格式
   "BV1Jgf6YvE8e"  # ✅
   "https://www.bilibili.com/video/BV1Jgf6YvE8e"  # ✅
   
   # 错误格式
   "1Jgf6YvE8e"  # ❌ 缺少 BV 前缀
   ```

3. **尝试其他视频**
   - 某些视频可能永久不可用
   - 使用其他相同内容的视频

## 🔍 诊断工具

### 1. 格式诊断脚本
```bash
cd backend
python debug_video_formats.py
```

显示：
- 视频信息
- 可用格式列表
- 下载测试

### 2. 命令行测试
直接使用 yt-dlp：

```bash
# 列出所有格式
yt-dlp --list-formats "https://www.bilibili.com/video/BV1Jgf6YvE8e"

# 下载最佳格式
yt-dlp -f best "https://www.bilibili.com/video/BV1Jgf6YvE8e"

# 下载特定格式
yt-dlp -f 64 "https://www.bilibili.com/video/BV1Jgf6YvE8e"
```

### 3. Python 交互式测试
```python
from app.services.bilibili_service import BilibiliService

service = BilibiliService()

# 测试信息提取
info = service.extract_video_info("BV1Jgf6YvE8e")
print(info)

# 测试格式列表
formats = service.list_available_formats("BV1Jgf6YvE8e")
for fmt in formats:
    print(fmt)

# 测试下载
result = service.download_video("BV1Jgf6YvE8e")
print(result)
```

## 🛠️ 高级配置

### 配置 1: 使用 Cookie 文件

1. **导出 Cookie**
   - 使用浏览器扩展（推荐 "Get cookies.txt"）
   - 登录 B站后导出
   - 保存为 `bilibili_cookies.txt`

2. **配置路径**
   ```python
   # 在 bilibili_service.py 的 __init__ 中
   self.cookie_file = "path/to/bilibili_cookies.txt"
   
   # 在 download_video 中
   ydl_opts['cookiefile'] = self.cookie_file
   ```

### 配置 2: 自定义格式选择策略

```python
# 优先选择特定分辨率
'format': 'bestvideo[height=1080]+bestaudio/best'

# 限制文件大小
'format': 'best[filesize<50M]'

# 优先选择 MP4
'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]'
```

### 配置 3: 网络优化

```python
ydl_opts = {
    # 连接超时
    'socket_timeout': 30,
    
    # 重试次数
    'retries': 3,
    'fragment_retries': 3,
    
    # 跳过不可用片段
    'skip_unavailable_fragments': True,
    
    # 限速（如果需要）
    'ratelimit': 1024 * 1024,  # 1MB/s
}
```

## 📊 特殊视频类型处理

### 类型 1: 番剧/电影
- **特点**: 多 P（分集）、版权保护
- **方案**: 
  - 使用 Cookie 认证
  - 下载单集而非整个系列
  - 可能需要大会员

### 类型 2: 直播回放
- **特点**: 超长时长、大文件
- **方案**:
  - 调高文件大小限制
  - 增加超时时间
  - 考虑下载片段而非完整视频

### 类型 3: 互动视频
- **特点**: 多分支、特殊格式
- **方案**:
  - 可能无法完整下载
  - 尝试下载主线路
  - 使用 `--list-formats` 查看可用格式

### 类型 4: 付费内容
- **特点**: 需要购买或充电
- **方案**:
  - 使用已购买账号的 Cookie
  - 某些内容可能无法下载
  - 考虑使用其他免费资源

## 💡 最佳实践

### 1. 选择合适的视频
✅ **推荐**:
- 普通 UP 主上传的视频
- 时长 < 30 分钟
- 分辨率 720p-1080p
- 无版权限制

❌ **避免**:
- 番剧、电影等版权内容
- 超长视频（> 1 小时）
- 互动视频
- 付费内容

### 2. 测试流程
1. 先使用 `extract_video_info` 测试信息提取
2. 使用 `list_available_formats` 查看可用格式
3. 小批量测试（1-2个视频）
4. 确认成功后批量处理

### 3. 错误处理
```python
try:
    result = service.download_video(url)
except Exception as e:
    if "format" in str(e).lower():
        print("格式问题，尝试其他视频")
    elif "region" in str(e).lower():
        print("地区限制，需要 Cookie 或代理")
    elif "404" in str(e):
        print("视频不存在或已删除")
    else:
        print(f"未知错误: {e}")
```

## 🆘 还是无法解决？

### 检查清单

- [ ] yt-dlp 是最新版本 (`pip install --upgrade yt-dlp`)
- [ ] 视频在浏览器中可正常播放
- [ ] 网络连接稳定
- [ ] 已尝试诊断脚本
- [ ] 已查看后端日志详细错误
- [ ] 已尝试其他相似视频

### 收集错误信息

运行诊断并保存完整输出：
```bash
python debug_video_formats.py > debug_output.txt 2>&1
```

查看后端日志：
```bash
python main.py 2>&1 | tee backend.log
```

### 替代方案

如果某个视频始终无法下载：

1. **尝试其他相同内容的视频**
   - 搜索相同主题的其他 UP 主作品
   
2. **使用字幕/文稿**
   - 某些视频有字幕，可直接提取
   
3. **手动下载后分析**
   - 使用其他工具下载
   - 将文件放入 `uploads/` 目录
   - 直接调用 AI 分析

4. **跳过该视频**
   - 批量处理时，失败的会记录在错误列表
   - 可以单独处理成功的视频

## 📚 参考资源

- **yt-dlp 文档**: https://github.com/yt-dlp/yt-dlp
- **B站 API 说明**: https://socialsisteryi.github.io/bilibili-API-collect/
- **格式选择语法**: https://github.com/yt-dlp/yt-dlp#format-selection

## 🔄 更新日志

- **2024-01-05**: 添加自动格式降级
- **2024-01-05**: 添加诊断脚本
- **2024-01-05**: 添加 Cookie 支持说明


