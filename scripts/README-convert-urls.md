# 课程URL转换脚本使用说明

## 功能描述

这个脚本用于将带用户ID的课程URL转换为简洁的创作者URL，提高搜索引擎收录效果。

### 转换示例
- **原URL**: `/study/vibe-coding-basics-ue1G1axIf1esrqak3aNxjwmWNOHaulP0`
- **新URL**: `/study/vibe-coding-basics`

## 使用方法

### 1. 预览模式（推荐先使用）
查看哪些课程可以转换，不会修改任何数据：
```bash
pnpm run convert-urls:preview
```

### 2. 执行转换（保留原记录）
执行转换但保留原始课程记录：
```bash
pnpm run convert-urls:execute
```

### 3. 执行转换并删除原记录
执行转换并删除原始带用户ID的课程记录：
```bash
pnpm run convert-urls:clean
```

⚠️ **警告**: 使用 `convert-urls:clean` 会永久删除原始记录，请确保已备份数据库！

## 工作原理

1. **查找公开课程**: 脚本会查找所有标记为公开的用户课程
2. **生成简洁URL**: 为每个课程生成不带用户ID的简洁slug
3. **创建创作者记录**: 在 `creator_courses` 表中创建新记录
4. **可选删除原记录**: 根据参数决定是否删除原始记录

## 转换条件

脚本只会转换满足以下条件的课程：
- 课程必须标记为公开 (`coursePlan.isPublic = true`)
- 课程尚未创建创作者URL记录
- 能够提取有效的课程标题

## 数据库操作

### 创建的记录
- 在 `creator_courses` 表中创建新记录
- 包含简洁的slug、课程ID、创作者ID等信息

### 可选删除的记录
- 如果使用 `--delete-original` 参数，会删除 `user_courses` 表中的原记录
- 相关的任务、聊天记录等会通过外键级联删除

## 安全提示

1. **备份数据库**: 执行前请备份数据库
2. **先预览**: 建议先使用预览模式查看转换计划
3. **测试环境**: 建议先在测试环境中运行
4. **逐步执行**: 可以先不删除原记录，确认转换效果后再考虑清理

## 故障排除

### 常见错误
- **slug已被占用**: 如果生成的简洁URL已存在，脚本会跳过该课程
- **课程未公开**: 只有公开的课程才能转换
- **数据库连接错误**: 确保数据库连接正常

### 日志说明
- ✅ 成功操作
- ❌ 失败或跳过
- 🔍 查找和分析
- 📝 处理中
- 🗑️ 删除操作

## 相关文件

- **脚本文件**: `scripts/convert-course-urls.ts`
- **数据库Schema**: `src/db/schema.ts`
- **URL生成逻辑**: `src/lib/creator-utils.ts`
- **API路由**: `src/app/api/creator-courses/`
