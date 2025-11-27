# Supabase 数据库迁移到飞书多维表格指南

## 📋 需要准备的信息

### 1. 飞书多维表格信息
- **App Token**: 多维表格的应用 Token（在飞书开放平台创建应用后获取）
- **App ID**: 应用 ID
- **App Secret**: 应用密钥
- **Base Token**: 多维表格的 Base Token（每个多维表格的唯一标识）

### 2. 数据库连接信息（用于导出数据）
- **DATABASE_URL**: Supabase 数据库连接字符串
- 或者直接从 Supabase Dashboard 导出数据

### 3. 飞书开放平台配置
- 创建企业自建应用
- 开通"多维表格"权限
- 获取 API Token

---

## 🗂️ 飞书多维表格表结构设计

### 表1: user (用户表)
| 字段名 | 字段类型 | 说明 |
|--------|---------|------|
| id | 文本 | 主键，用户ID |
| name | 文本 | 用户名称 |
| email | 文本 | 邮箱（唯一） |
| email_verified | 复选框 | 邮箱是否已验证 |
| image | 文本 | 头像URL |
| created_at | 日期时间 | 创建时间 |
| updated_at | 日期时间 | 更新时间 |
| role | 单选 | 角色 |
| banned | 复选框 | 是否被封禁 |
| ban_reason | 文本 | 封禁原因 |
| ban_expires | 日期时间 | 封禁过期时间 |
| customer_id | 文本 | 客户ID |
| is_creator | 复选框 | 是否为创作者 |

### 表2: user_courses (用户课程表)
| 字段名 | 字段类型 | 说明 |
|--------|---------|------|
| id | 文本 | 主键，课程ID |
| user_id | 关联字段 | 关联到 user 表 |
| course_plan | 文本（长文本） | JSON格式的课程计划 |
| current_step | 数字 | 当前步骤 |
| status | 单选 | 状态：in-progress/completed |
| tasks_generated | 复选框 | 任务是否已生成 |
| created_at | 日期时间 | 创建时间 |
| updated_at | 日期时间 | 更新时间 |

### 表3: course_tasks (课程任务表)
| 字段名 | 字段类型 | 说明 |
|--------|---------|------|
| id | 文本 | 主键，任务ID |
| course_id | 关联字段 | 关联到 user_courses 表 |
| step_number | 数字 | 步骤编号 |
| task_content | 文本（长文本） | JSON格式的任务内容 |
| created_at | 日期时间 | 创建时间 |
| updated_at | 日期时间 | 更新时间 |

### 表4: course_chat_history (课程聊天历史表)
| 字段名 | 字段类型 | 说明 |
|--------|---------|------|
| id | 文本 | 主键，聊天记录ID |
| course_id | 关联字段 | 关联到 user_courses 表 |
| session_id | 文本 | 会话ID |
| messages | 文本（长文本） | JSON格式的消息数组 |
| created_at | 日期时间 | 创建时间 |
| updated_at | 日期时间 | 更新时间 |

### 表5: creator_courses (创作者课程表)
| 字段名 | 字段类型 | 说明 |
|--------|---------|------|
| id | 文本 | 主键 |
| slug | 文本 | URL标识符（唯一） |
| course_id | 关联字段 | 关联到 user_courses 表 |
| creator_id | 关联字段 | 关联到 user 表 |
| title | 文本 | 标题 |
| description | 文本 | 描述 |
| is_active | 复选框 | 是否激活 |
| created_at | 日期时间 | 创建时间 |
| updated_at | 日期时间 | 更新时间 |

### 表6: key_actions (关键行为表)
| 字段名 | 字段类型 | 说明 |
|--------|---------|------|
| id | 文本 | 主键 |
| event_name | 文本 | 事件名称 |
| timestamp | 数字 | 时间戳 |
| server_timestamp | 日期时间 | 服务器时间戳 |
| session_id | 文本 | 会话ID |
| user_id | 关联字段 | 关联到 user 表 |
| locale | 文本 | 语言环境 |
| device_type | 文本 | 设备类型 |
| user_agent | 文本 | 用户代理 |
| page_path | 文本 | 页面路径 |
| page_title | 文本 | 页面标题 |
| action_data | 文本（长文本） | JSON格式的行为数据 |
| created_at | 日期时间 | 创建时间 |

### 表7: session (会话表)
| 字段名 | 字段类型 | 说明 |
|--------|---------|------|
| id | 文本 | 主键 |
| expires_at | 日期时间 | 过期时间 |
| token | 文本 | Token（唯一） |
| created_at | 日期时间 | 创建时间 |
| updated_at | 日期时间 | 更新时间 |
| ip_address | 文本 | IP地址 |
| user_agent | 文本 | 用户代理 |
| user_id | 关联字段 | 关联到 user 表 |
| impersonated_by | 文本 | 被谁模拟 |

### 表8: account (账户表)
| 字段名 | 字段类型 | 说明 |
|--------|---------|------|
| id | 文本 | 主键 |
| account_id | 文本 | 账户ID |
| provider_id | 文本 | 提供商ID |
| user_id | 关联字段 | 关联到 user 表 |
| access_token | 文本 | 访问令牌 |
| refresh_token | 文本 | 刷新令牌 |
| id_token | 文本 | ID令牌 |
| access_token_expires_at | 日期时间 | 访问令牌过期时间 |
| refresh_token_expires_at | 日期时间 | 刷新令牌过期时间 |
| scope | 文本 | 权限范围 |
| password | 文本 | 密码（加密） |
| created_at | 日期时间 | 创建时间 |
| updated_at | 日期时间 | 更新时间 |

### 表9: verification (验证表)
| 字段名 | 字段类型 | 说明 |
|--------|---------|------|
| id | 文本 | 主键 |
| identifier | 文本 | 标识符 |
| value | 文本 | 验证值 |
| expires_at | 日期时间 | 过期时间 |
| created_at | 日期时间 | 创建时间 |
| updated_at | 日期时间 | 更新时间 |

### 表10: payment (支付表)
| 字段名 | 字段类型 | 说明 |
|--------|---------|------|
| id | 文本 | 主键 |
| price_id | 文本 | 价格ID |
| type | 文本 | 类型 |
| interval | 文本 | 间隔 |
| user_id | 关联字段 | 关联到 user 表 |
| customer_id | 文本 | 客户ID |
| subscription_id | 文本 | 订阅ID |
| status | 文本 | 状态 |
| period_start | 日期时间 | 周期开始 |
| period_end | 日期时间 | 周期结束 |
| cancel_at_period_end | 复选框 | 是否在周期结束时取消 |
| trial_start | 日期时间 | 试用开始 |
| trial_end | 日期时间 | 试用结束 |
| created_at | 日期时间 | 创建时间 |
| updated_at | 日期时间 | 更新时间 |

---

## 📝 迁移步骤

### 步骤1: 在飞书开放平台创建应用
1. 访问 [飞书开放平台](https://open.feishu.cn/)
2. 创建企业自建应用
3. 开通"多维表格"权限
4. 获取 App ID 和 App Secret

### 步骤2: 创建多维表格并获取 Base Token
1. 在飞书中创建多维表格
2. 获取 Base Token（在表格设置中查看）

### 步骤3: 创建表结构
按照上面的表结构设计，在飞书多维表格中创建对应的表

### 步骤4: 导出 Supabase 数据
使用提供的迁移脚本导出数据

### 步骤5: 导入数据到飞书多维表格
使用飞书 API 批量导入数据

---

## 🔧 需要提供的环境变量

在 `.env.local` 或 `.env` 中添加：

```bash
# 飞书多维表格配置
FEISHU_APP_ID=your_app_id
FEISHU_APP_SECRET=your_app_secret
FEISHU_BASE_TOKEN=your_base_token

# Supabase 数据库（用于导出）
DATABASE_URL=your_supabase_database_url
```

---

## 📦 迁移脚本

我会为您创建以下脚本：
1. `scripts/migrate-to-feishu.ts` - 数据迁移脚本
2. `src/lib/feishu-client.ts` - 飞书 API 客户端封装

---

## ⚠️ 注意事项

1. **数据量限制**: 飞书多维表格有行数限制（免费版10万行，企业版更多）
2. **JSON字段**: JSONB 字段需要转换为文本存储
3. **关联字段**: 需要先创建关联表，再设置关联关系
4. **批量导入**: 建议分批导入，避免API限流
5. **数据验证**: 迁移后需要验证数据完整性

---

## 🚀 下一步

请提供以下信息，我将为您创建迁移脚本：
1. 飞书 App ID
2. 飞书 App Secret  
3. 飞书 Base Token
4. 确认是否需要迁移所有表，还是只迁移部分表

