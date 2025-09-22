# 特定课程URL转换脚本使用说明

## 功能描述

这个脚本用于将您指定的带用户ID的课程URL转换为简洁的创作者URL，提高搜索引擎收录效果。

### 转换示例
- **输入**: `study/vibe-coding-basics-ue1G1axIf1esrqak3aNxjwmWNOHaulP0`
- **输出**: `study/vibe-coding-basics`

## 使用方法

### 1. 转换单个URL
```bash
pnpm run convert-url "study/vibe-coding-basics-ue1G1axIf1esrqak3aNxjwmWNOHaulP0"
```

### 2. 转换多个URL
```bash
pnpm run convert-url "study/course1-userId1" "study/course2-userId2" "study/course3-userId3"
```

### 3. 转换并删除原记录
```bash
pnpm run convert-url "study/vibe-coding-basics-ue1G1axIf1esrqak3aNxjwmWNOHaulP0" --delete-original
```

⚠️ **警告**: 使用 `--delete-original` 会永久删除原始记录，请确保已备份数据库！

## 支持的URL格式

脚本支持以下格式的URL输入：

1. **相对路径**: `study/course-name-userId`
2. **绝对路径**: `/study/course-name-userId`
3. **完整URL**: `https://www.aitutorly.ai/study/course-name-userId`

## 工作流程

1. **解析URL**: 从输入的URL中提取课程标题和用户ID
2. **查找课程**: 在数据库中查找匹配的课程记录
3. **验证条件**: 检查课程是否公开且满足转换条件
4. **创建简洁URL**: 在 `creator_courses` 表中创建新记录
5. **可选删除**: 根据参数决定是否删除原始记录

## 转换条件

脚本只会转换满足以下条件的课程：
- ✅ 课程必须标记为公开 (`coursePlan.isPublic = true`)
- ✅ 课程尚未创建创作者URL记录
- ✅ 能够从URL中正确解析出标题和用户ID
- ✅ 生成的简洁slug未被占用

## 输出说明

### 成功转换
```
📝 处理课程: Vibe Coding Basics
   创作者: John Doe (john@example.com)
   原URL: /study/vibe-coding-basics-ue1G1axIf1esrqak3aNxjwmWNOHaulP0
   新URL: /study/vibe-coding-basics
   ✅ 创建简洁URL成功: /study/vibe-coding-basics
```

### 跳过情况
- `❌ 无效的URL格式` - URL格式不正确
- `❌ 未找到匹配的课程` - 数据库中找不到对应课程
- `❌ 课程未公开，跳过转换` - 课程未标记为公开
- `⏭️ 已存在创作者URL记录，跳过` - 已经转换过
- `❌ slug已被占用，跳过` - 生成的URL已存在

## 使用示例

### 示例1: 转换单个课程
```bash
pnpm run convert-url "study/vibe-coding-basics-ue1G1axIf1esrqak3aNxjwmWNOHaulP0"
```

输出：
```
🎯 特定课程URL转换脚本
==================================================

🔄 开始处理 1 个URL...

🔍 处理URL: study/vibe-coding-basics-ue1G1axIf1esrqak3aNxjwmWNOHaulP0
   标题部分: vibe-coding-basics
   用户ID: ue1G1axIf1esrqak3aNxjwmWNOHaulP0
📝 处理课程: Vibe Coding Basics
   创作者: User Name (user@email.com)
   原URL: /study/vibe-coding-basics-ue1G1axIf1esrqak3aNxjwmWNOHaulP0
   新URL: /study/vibe-coding-basics
   ✅ 创建简洁URL成功: /study/vibe-coding-basics

📊 处理完成:
   ✅ 成功: 1 个
   ❌ 失败/跳过: 0 个
   💡 原记录保留，如需删除请使用 --delete-original 参数
```

### 示例2: 转换多个课程并删除原记录
```bash
pnpm run convert-url "study/course1-userId1" "study/course2-userId2" --delete-original
```

## 安全提示

1. **备份数据库**: 执行前请备份数据库
2. **测试环境**: 建议先在测试环境中测试
3. **逐步操作**: 先不删除原记录，确认效果后再考虑清理
4. **验证结果**: 转换后验证新URL是否正常访问

## 故障排除

### 常见问题
1. **URL格式错误**: 确保URL包含用户ID部分
2. **课程未找到**: 检查URL中的用户ID和课程标题是否正确
3. **权限问题**: 确保有数据库操作权限
4. **slug冲突**: 如果生成的简洁URL已存在，需要手动处理

### 调试技巧
- 查看详细的控制台输出来了解处理过程
- 使用数据库工具验证转换结果
- 检查 `creator_courses` 表中的新记录
