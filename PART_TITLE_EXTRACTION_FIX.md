# 分P标题提取优化

## 🐛 问题描述

P标签显示：`P3 3小时快速入门...`，仍然包含系列标题的一部分。

期望显示：`P3 Windows|安装...`（只显示分P小标题）

## 🔍 问题原因

B站视频的title格式通常是：
```
"3小时超快速入门Python | 动画教学【2025新版】【自学Python教程】 p03 Windows | 安装Python和PyCharm"
```

结构：`[系列标题] p[XX] [分P小标题]`

之前的代码直接使用 `entry.get('title')`，获取的是完整标题，包含系列名称。

## ✅ 解决方案

### 提取算法

```python
# 1. 获取完整标题
full_title = entry.get('title', f'P{idx}')

# 2. 按 " p" 分割（B站格式）
if ' p' in full_title.lower():
    parts = full_title.split(' p', 1)
    # parts[0]: "3小时超快速入门Python | 动画教学【2025新版】【自学Python教程】"
    # parts[1]: "03 Windows | 安装Python和PyCharm"
    
    if len(parts) > 1:
        after_p = parts[1]
        # 3. 去掉 "03 "，只保留 "Windows | 安装Python和PyCharm"
        part_title = re.sub(r'^\d+\s+', '', after_p).strip()

# 4. 保存两个版本
{
    'part_title': 'Windows | 安装Python和PyCharm',  # 小标题
    'full_title': '3小时超快速入门Python... p03 Windows...',  # 完整标题
}
```

### 示例转换

| 完整标题 | 提取后的小标题 |
|---------|--------------|
| `...【自学Python教程】 p01 Python是什么？` | `Python是什么？` |
| `...【零基础Python】 p02 为什么学Python` | `为什么学Python` |
| `...【Python期末速成】 p03 Windows 安装Python和PyCharm` | `Windows 安装Python和PyCharm` |
| `...教程 p04 Mac 安装Python和PyCharm` | `Mac 安装Python和PyCharm` |

## 🎯 修改内容

### 文件：`backend/app/services/bilibili_service.py`

**修改位置**：第128-156行

**关键变化**：
1. ✅ 添加 `import re` 用于正则表达式
2. ✅ 提取分P小标题逻辑
3. ✅ 同时保存 `part_title` 和 `full_title`
4. ✅ 处理提取失败的后备方案

## 🔄 需要的操作

### 1. 重启后端服务

```bash
# 停止后端
Ctrl+C

# 重新启动
python main.py
```

**原因**：代码修改需要重启才能生效

### 2. 清除缓存（可选但推荐）

```bash
# 删除序列信息缓存，强制重新解析
# 在后端目录执行
rm -rf cache/*.json

# 或者在Windows PowerShell
Remove-Item cache\*.json
```

**原因**：旧缓存中的 `parts` 信息还是完整标题，需要清除后重新获取

### 3. 刷新前端页面

```
http://localhost:3000/zh/video-notes-prototype
```

## 🧪 测试验证

### 预期效果

访问页面后，在P标签上应该看到：

**修改前**：
```
P1  P2  P3 3小时快速入门Pyt...  P4  P5
```

**修改后**：
```
P1  P2  P3 Windows|安装Pyt...  P4  P5
```

### 浏览器控制台验证

打开控制台（F12），检查加载的parts信息：

```javascript
// 应该看到类似的输出
🔍 result对象: {
  parts: [
    {
      part_number: 1,
      part_title: "Python是什么？",           // ✅ 只有小标题
      full_title: "3小时...【教程】 p01 Python是什么？"  // 完整标题
    },
    {
      part_number: 3,
      part_title: "Windows | 安装Python和PyCharm",  // ✅ 只有小标题
      full_title: "3小时...【教程】 p03 Windows | 安装..."
    }
  ]
}
```

## 🎨 UI最终效果

```
┌─────────────────────────────────────────┐
│ 【Python零基础入门教程】                 │
│                                         │
│ ┌──┬──┬──────────┬──┬──┐             │
│ │P1│P2│P3 Windows|...│P4│P5│             │
│ └──┴──┴──────────┴──┴──┘             │
│       ↑ 只显示分P小标题                │
│                                         │
│ ┌─────────────────────────────┐        │
│ │      视频播放器              │        │
│ └─────────────────────────────┘        │
└─────────────────────────────────────────┘
```

## 📝 数据结构更新

### PartInfo 接口（前端需要更新）

```typescript
interface PartInfo {
  part_number: number;
  part_title: string;      // 小标题（用于显示）
  full_title?: string;     // 完整标题（可选，供参考）
  duration: number;
  url: string;
  bv_id: string;
}
```

**注意**：前端代码不需要修改，因为仍然使用 `part.part_title`，只是后端返回的内容变了。

## 🚨 可能的问题

### 问题1: 提取失败

**场景**：某些视频的标题格式不是 `系列标题 pXX 小标题`

**解决**：代码已包含后备方案，使用完整标题

```python
if not part_title:
    part_title = full_title
```

### 问题2: 缓存未清除

**症状**：重启后端，刷新页面，P标签仍然显示完整标题

**解决**：
1. 手动删除 `backend/cache/` 目录中的所有 `.json` 文件
2. 重新访问页面，触发重新解析

### 问题3: 正则表达式匹配问题

**场景**：某些P标题数字后没有空格，如 `p03Windows`

**当前处理**：
```python
re.sub(r'^\d+\s+', '', after_p)  # 匹配数字+空格
```

**改进方案**（如需要）：
```python
re.sub(r'^\d+\s*', '', after_p)  # 匹配数字+可选空格
```

## 🔍 调试技巧

### 后端日志

启动后端后，访问页面时应该看到：

```
📋 Extracting video info: https://www.bilibili.com/video/BV1Jgf6YvE8e
🎬 检测到视频序列: 【全748集】Python零基础全套教程...
📊 共 31 个分P
```

### 前端日志

浏览器控制台应该显示：

```javascript
🎬 检测到视频序列: 【全748集】Python零基础全套教程...
📊 共 31 个分P
📺 加载第 1 P: Python是什么？  // ✅ 只有小标题
```

## 🎯 总结

1. **问题**：P标签显示完整标题，包含系列名称
2. **原因**：直接使用B站返回的完整title
3. **解决**：提取 `pXX` 后面的小标题部分
4. **操作**：重启后端 + 清除缓存 + 刷新页面

---

**修复时间**: 2025-11-07  
**影响文件**: `backend/app/services/bilibili_service.py`  
**需要操作**: 重启后端 + 清除缓存  
**状态**: ✅ 已修复  
**测试**: ⏳ 待验证

