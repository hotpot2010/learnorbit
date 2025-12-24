# 国际化默认语言修改为中文

## 概述

将应用的默认语言从英文（`en`）修改为中文（`zh`），使所有页面（包括 video note 相关页面）默认显示中文内容。

## 修改内容

### 配置文件修改

**文件：** `src/config/website.tsx`

**修改前（第51行）：**
```typescript
i18n: {
  defaultLocale: 'en',  // ❌ 默认英文
  locales: {
    en: {
      flag: '🇺🇸',
      name: 'English',
    },
    zh: {
      flag: '🇨🇳',
      name: '中文',
    },
  },
},
```

**修改后：**
```typescript
i18n: {
  defaultLocale: 'zh',  // ✅ 默认中文
  locales: {
    en: {
      flag: '🇺🇸',
      name: 'English',
    },
    zh: {
      flag: '🇨🇳',
      name: '中文',
    },
  },
},
```

## 影响范围

### 受影响的页面

修改后，以下所有页面的默认语言都将变为中文：

1. ✅ **视频笔记页面** (`/video-notes-prototype`)
   - 默认加载中文界面
   - 默认使用中文进行视频分析
   - 默认生成中文笔记和知识点

2. ✅ **视频入口页面** (`/video-entry`)
   - 默认显示中文搜索界面
   - 默认使用中文视频搜索

3. ✅ **首页** (`/` 或 `/home`)
   - 默认显示中文欢迎页面

4. ✅ **学习页面** (`/study/[id]`)
   - 默认使用中文进行学习

5. ✅ **所有其他页面**
   - 登录/注册页面
   - 定价页面
   - 关于页面
   - 等等...

### URL 行为变化

#### 修改前（默认英文）

| 访问URL | 实际显示 | 说明 |
|---------|---------|------|
| `/video-entry` | `/en/video-entry` | 自动跳转到英文版 |
| `/video-notes-prototype` | `/en/video-notes-prototype` | 自动跳转到英文版 |
| `/zh/video-entry` | `/zh/video-entry` | 显示中文版 |

#### 修改后（默认中文）

| 访问URL | 实际显示 | 说明 |
|---------|---------|------|
| `/video-entry` | `/video-entry` | 直接显示中文版（无前缀）✅ |
| `/video-notes-prototype` | `/video-notes-prototype` | 直接显示中文版（无前缀）✅ |
| `/en/video-entry` | `/en/video-entry` | 显示英文版 |

**注意：** 由于 `localePrefix: 'as-needed'` 配置，默认语言（zh）不会在URL中显示前缀。

## 功能逻辑不变

以下基于 `locale` 的动态功能逻辑**不受影响**，仍然正常工作：

### 1. 视频源选择

```typescript
// video-notes-prototype/page.tsx
// 中文模式：使用B站视频
// 英文模式：支持YouTube视频
if (locale === 'en') {
  // YouTube logic
} else {
  // Bilibili logic
}
```

### 2. 字体选择

```typescript
// video-entry/page.tsx
// 移动端英文：使用系统字体
// 其他情况：使用卡通字体
const fontFamily = isMobile && locale === 'en'
  ? 'ui-sans-serif, system-ui, ...'
  : '"Comic Sans MS", "Marker Felt", "Kalam", cursive';
```

### 3. YouTube播放器

```typescript
// video-notes-prototype/page.tsx
// 仅在英文模式加载YouTube iframe API
useEffect(() => {
  if (locale === 'en' && !(window as any).YT) {
    // Load YouTube API
  }
}, [locale]);
```

这些逻辑都是根据**当前实际的 locale** 动态判断的，不依赖于默认语言配置。

## 语言切换功能

用户仍然可以通过语言切换器手动切换语言：

```tsx
// 语言切换器位置
<LocaleSwitcher />  // 在导航栏右上角

// 可选语言
- 🇨🇳 中文 (默认)
- 🇺🇸 English
```

切换语言后，URL会相应改变：
- 切换到英文：`/en/video-entry`
- 切换到中文：`/video-entry`（无前缀）

## Cookie 存储

语言偏好会存储在 `NEXT_LOCALE` Cookie 中：

```typescript
// i18n/routing.ts
export const LOCALE_COOKIE_NAME = 'NEXT_LOCALE';

// Cookie 行为
localeCookie: {
  name: LOCALE_COOKIE_NAME,
}
```

一旦用户手动切换语言，该偏好会被记住，后续访问将使用用户选择的语言，而不是默认语言。

## 中间件配置

国际化中间件配置保持不变：

```typescript
// middleware.ts
const intlMiddleware = createMiddleware(routing);

export default async function middleware(req: NextRequest) {
  return intlMiddleware(req);
}
```

中间件会：
1. 检查 Cookie 中的语言偏好
2. 如果没有偏好，使用 `defaultLocale`（现在是 `zh`）
3. 自动重定向或应用相应的语言

## 测试验证

### 测试步骤

1. **清除浏览器 Cookie**
   ```javascript
   // 在浏览器控制台执行
   document.cookie.split(";").forEach(c => {
     document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
   });
   ```

2. **访问根路径**
   ```
   http://localhost:3000/
   ```
   - ✅ 应该显示中文内容
   - ✅ URL应该是 `/`（无语言前缀）

3. **访问 video-entry**
   ```
   http://localhost:3000/video-entry
   ```
   - ✅ 应该显示中文搜索界面
   - ✅ URL应该是 `/video-entry`

4. **访问 video-notes-prototype**
   ```
   http://localhost:3000/video-notes-prototype?taskId=xxx
   ```
   - ✅ 应该显示中文视频笔记界面
   - ✅ 知识点生成应该使用中文

5. **手动切换到英文**
   - 点击语言切换器，选择 "English"
   - ✅ URL应该变为 `/en/video-entry`
   - ✅ 界面应该切换为英文

6. **刷新页面**
   - ✅ 应该保持英文界面（Cookie记住了偏好）

7. **切换回中文**
   - 点击语言切换器，选择 "中文"
   - ✅ URL应该变为 `/video-entry`（移除 `/en` 前缀）
   - ✅ 界面应该切换为中文

## 用户体验改进

### 修改前 ❌

```
用户访问：http://localhost:3000/video-entry
↓
自动重定向：http://localhost:3000/en/video-entry
↓
显示英文界面（对于中国用户不友好）
```

### 修改后 ✅

```
用户访问：http://localhost:3000/video-entry
↓
直接显示：http://localhost:3000/video-entry
↓
显示中文界面（对于中国用户友好）✅
```

### 优势

1. **更好的本地化体验**
   - 中国用户访问时直接看到中文界面
   - 减少用户困惑和学习成本

2. **更简洁的URL**
   - 默认语言不需要 `/zh` 前缀
   - URL更简洁美观

3. **保持灵活性**
   - 英文用户仍可通过 `/en/` 前缀访问
   - 语言切换功能仍然正常工作

4. **SEO友好**
   - 中文是主要目标用户的语言
   - 默认中文有利于搜索引擎优化

## 相关配置文件

### 主要配置

1. **`src/config/website.tsx`** ✅（已修改）
   - 定义 `defaultLocale: 'zh'`

2. **`src/i18n/routing.ts`**（无需修改）
   - 使用 `websiteConfig.i18n.defaultLocale`
   - 配置语言前缀规则

3. **`src/middleware.ts`**（无需修改）
   - 应用国际化中间件
   - 自动处理语言路由

### 翻译文件

翻译文件位置保持不变：

```
src/i18n/messages/
├── en/
│   └── ... (英文翻译)
└── zh/
    └── ... (中文翻译)
```

## 注意事项

### 开发环境

- 修改后需要**重启开发服务器**：
  ```bash
  # 停止当前服务器（Ctrl+C）
  npm run dev  # 或 pnpm dev
  ```

### 生产环境

- 需要**重新构建**应用：
  ```bash
  npm run build
  npm run start
  ```

### Cookie 清除

如果在测试时发现语言没有切换：
1. 检查浏览器 Cookie 中的 `NEXT_LOCALE` 值
2. 手动删除该 Cookie 或使用隐私模式测试

## 回滚方案

如果需要恢复为默认英文，只需修改回原值：

```typescript
// src/config/website.tsx
i18n: {
  defaultLocale: 'en',  // 恢复为英文
  // ...
}
```

然后重启服务器。

## 相关文档

- Next.js 国际化：https://nextjs.org/docs/app/building-your-application/routing/internationalization
- next-intl 文档：https://next-intl.dev/docs/routing
- 语言前缀配置：https://next-intl.dev/docs/routing#locale-prefix

## 修改日期

2024-12-24

## 相关功能

- [x] 默认语言修改为中文 ✅（本次）
- [x] 视频笔记功能
- [x] 视频搜索功能
- [x] 多语言支持
- [x] 语言切换器
- [x] Cookie 语言偏好存储

