# 创作者账号功能说明

## 功能概述

本功能为指定的创作者账号提供简洁的课程URL，不包含用户ID，便于SEO优化和Google收录。

## 创作者邮箱

- `zhouletao20@gmail.com`
- `ritafeng1234@gmail.com`

## URL格式对比

### 普通用户课程URL
```
https://www.aitutorly.ai/study/can-i-learn-ai-without-coding-LtjybdHpSNLwkP0JlobVQA8lAzgjKPf2
```

### 创作者课程URL（简洁）
```
https://www.aitutorly.ai/study/can-i-learn-ai-without-coding
```

## 实现细节

### 数据库更改

1. **用户表添加创作者标识**
   - 添加 `is_creator` 字段标识创作者账号

2. **新增创作者课程映射表**
   - `creator_courses` 表存储简洁URL到课程的映射关系
   - 包含slug、课程ID、创作者ID等信息

### API端点

1. **`/api/creator-courses/[slug]`** - 获取创作者课程数据
2. **`/api/creator-courses`** - 管理创作者课程映射

### 路由处理

学习页面 `/study/[id]` 支持两种URL格式：
1. 简洁URL（创作者） - 优先尝试创作者课程API
2. 标准URL（普通用户） - 回退到普通公共课程API

### Sitemap集成

创作者课程的简洁URL自动添加到sitemap中，便于Google收录。

## 部署步骤

1. **推送数据库更改**
   ```bash
   pnpm db:push
   ```
   选择 "create table" 创建新表

2. **设置创作者账号**
   ```bash
   pnpm setup-creators
   ```

3. **重新构建和部署应用**
   ```bash
   pnpm build
   ```

## 使用流程

1. 创作者登录并创建课程
2. 完成课程内容并点击"发布"
3. 系统自动：
   - 将课程设为公开
   - 创建简洁URL映射
   - 添加到sitemap
4. 课程可通过简洁URL访问：`/study/课程标题slug`

## 注意事项

- 创作者身份基于邮箱验证
- 简洁URL slug必须唯一，重复时会报错
- 只有公开课程才能创建简洁URL
- sitemap在下次构建时自动更新

## 测试

创作者发布课程后，可以通过以下方式验证：

1. 访问简洁URL确认页面正常加载
2. 检查sitemap.xml包含新的URL
3. 在Google Search Console提交sitemap

## 文件修改清单

### 新增文件
- `src/lib/creator-utils.ts` - 创作者工具函数
- `src/app/api/creator-courses/route.ts` - 创作者课程管理API
- `src/app/api/creator-courses/[slug]/route.ts` - 创作者课程查询API
- `scripts/setup-creators.ts` - 创作者账号设置脚本

### 修改文件
- `src/db/schema.ts` - 添加创作者相关表和字段
- `src/app/sitemap.ts` - 集成创作者课程URL
- `src/app/[locale]/(marketing)/study/[id]/page.tsx` - 支持简洁URL路由
- `src/app/[locale]/(marketing)/my-courses/page.tsx` - 发布时自动创建映射
- `src/app/[locale]/(marketing)/course-marketplace/page.tsx` - 显示创作者信息
- `src/app/api/public-courses/route.ts` - 返回创作者标识
- `package.json` - 添加设置脚本
