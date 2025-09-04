# 创作者功能部署指南

## 🚀 部署步骤

### 1. 数据库更新

#### 方式一：使用Drizzle迁移（推荐）
```bash
# 已生成迁移文件: src/db/migrations/0004_clumsy_prism.sql
pnpm db:push
```

#### 方式二：手动SQL执行
如果遇到问题，可直接在数据库中执行：
```sql
-- 给用户表添加创作者标识字段
ALTER TABLE "user" ADD COLUMN "is_creator" boolean DEFAULT false NOT NULL;

-- 创建创作者课程映射表
CREATE TABLE "creator_courses" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"course_id" text NOT NULL,
	"creator_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- 添加外键约束
ALTER TABLE "creator_courses" ADD CONSTRAINT "creator_courses_course_id_user_courses_id_fk"
FOREIGN KEY ("course_id") REFERENCES "user_courses"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "creator_courses" ADD CONSTRAINT "creator_courses_creator_id_user_id_fk"
FOREIGN KEY ("creator_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;

-- 添加唯一索引
CREATE UNIQUE INDEX "creator_courses_slug_unique" ON "creator_courses" ("slug");

-- 设置指定邮箱为创作者
UPDATE "user" SET "is_creator" = true WHERE "email" IN ('zhouletao20@gmail.com', 'ritafeng1234@gmail.com');
```

### 2. 设置创作者账号

```bash
# 确保设置了数据库连接
export DATABASE_URL="your_database_url"

# 运行创作者设置脚本
pnpm setup-creators
```

预期输出：
```
🔧 Setting up creator accounts...
📧 Found 2 users with creator emails: [emails]
✅ Set zhouletao20@gmail.com as creator
✅ Set ritafeng1234@gmail.com as creator
🎉 Creator setup complete!
```

### 3. 验证功能

#### 测试工具函数
```bash
pnpm test-creator
```

#### 手动验证步骤
1. **创作者登录**
   - 使用指定邮箱登录：`zhouletao20@gmail.com` 或 `ritafeng1234@gmail.com`

2. **创建并发布课程**
   - 创建新的学习计划
   - 点击"发布"按钮
   - 检查控制台日志确认创建了映射

3. **验证URL访问**
   - 访问简洁URL：`/study/课程标题slug`
   - 确认页面正常加载

4. **检查Sitemap**
   - 访问：`/sitemap.xml`
   - 确认包含创作者课程URL

### 4. 构建和部署

```bash
# 安装依赖（包含新增的数学公式库）
pnpm install

# 构建应用
pnpm build

# 启动生产服务器
pnpm start
```

### 5. 环境变量检查

确保以下环境变量已正确配置：

```env
# 必需
DATABASE_URL=postgresql://...
NEXT_PUBLIC_BASE_URL=https://www.aitutorly.ai

# 其他现有变量...
OPENAI_API_KEY=...
AUTH_SECRET=...
# 等等
```

## 🔍 故障排除

### 数据库推送问题
如果 `pnpm db:push` 询问表是否重命名：
```
Is creator_courses table created or renamed from another table?
❯ + creator_courses                    create table
  ~ analytics_events › creator_courses rename table
```
**选择：`+ creator_courses (create table)`**

### 依赖问题
如果遇到缺失依赖：
```bash
# 重新安装依赖
pnpm install

# 或单独安装数学公式相关包
pnpm add remark-math rehype-katex katex
```

### 创作者账号未生效
如果创作者功能不工作：
```bash
# 检查数据库中的用户状态
# 在数据库中运行：
SELECT email, is_creator FROM "user" WHERE email IN ('zhouletao20@gmail.com', 'ritafeng1234@gmail.com');

# 手动设置（如果需要）
UPDATE "user" SET "is_creator" = true WHERE "email" = 'zhouletao20@gmail.com';
UPDATE "user" SET "is_creator" = true WHERE "email" = 'ritafeng1234@gmail.com';
```

### 构建错误
如果构建失败，检查：
1. 所有依赖是否已安装
2. TypeScript类型错误
3. 环境变量是否完整

## 📊 监控和验证

### 1. 功能验证清单
- [ ] 创作者能正常登录
- [ ] 创作者发布课程时自动创建简洁URL
- [ ] 简洁URL能正常访问课程
- [ ] Sitemap包含创作者课程
- [ ] 普通用户功能不受影响

### 2. SEO验证
- [ ] Google Search Console提交新sitemap
- [ ] 检查创作者课程页面的meta标签
- [ ] 验证简洁URL的索引状态

### 3. 性能监控
- [ ] 检查新API端点响应时间
- [ ] 监控数据库查询性能
- [ ] 验证sitemap生成时间

## 🎯 成功标志

部署成功后，您应该能看到：

1. **创作者课程URL格式**：
   ```
   https://www.aitutorly.ai/study/can-i-learn-ai-without-coding
   ```

2. **Sitemap包含创作者课程**：
   ```xml
   <url>
     <loc>https://www.aitutorly.ai/study/can-i-learn-ai-without-coding</loc>
     <lastmod>2024-01-01T00:00:00.000Z</lastmod>
     <priority>0.8</priority>
     <changefreq>monthly</changefreq>
   </url>
   ```

3. **控制台日志**：
   ```
   ✅ Created creator course mapping: /study/can-i-learn-ai-without-coding
   ✅ Added 5 creator courses to sitemap
   ```

## 📞 支持

如果在部署过程中遇到问题，请检查：

1. **日志文件** - 查看应用和数据库日志
2. **网络连接** - 确保数据库连接正常
3. **权限设置** - 确保应用有数据库写权限
4. **版本兼容** - 确保Node.js和数据库版本兼容

部署完成后，创作者功能将立即生效！🎉
