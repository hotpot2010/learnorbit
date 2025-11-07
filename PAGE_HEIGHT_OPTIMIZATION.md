# 页面高度优化说明

## 优化目标

确保视频笔记页面的内容区域从菜单栏下边缘开始，充分利用可视区域，避免内容被遮挡。

## 问题分析

### 布局结构

```
┌────────────────────────────────┐
│      Navbar (sticky)           │ ← 64px高度
├────────────────────────────────┤
│                                │
│      Main Content              │ ← 应该占满剩余空间
│                                │
└────────────────────────────────┘
```

### MarketingLayout结构

```tsx
// src/app/[locale]/(marketing)/layout.tsx
<div className="flex flex-col min-h-screen">
  <Navbar scroll={true} />          {/* sticky, top-0 */}
  <main className="flex-1">{children}</main>
  <ConditionalFooter />
</div>
```

### Navbar特性

- **定位**: `sticky inset-x-0 top-0`
- **层级**: `z-40`
- **Padding**: `py-2`
- **实际高度**: 约64px (包括padding和内容)

## 解决方案

### 1. 添加CSS变量

在全局CSS中定义导航栏高度变量：

```css
/* src/styles/globals.css */
:root {
  /* Layout */
  --navbar-height: 64px; /* Navbar height: py-2 + content */
  
  /* ... other variables */
}
```

### 2. 页面高度计算

使用CSS `calc()` 函数计算可用高度：

```tsx
// src/app/[locale]/(marketing)/video-notes-prototype/page.tsx
<div 
  className="flex flex-col bg-gray-50"
  style={{
    height: 'calc(100vh - var(--navbar-height, 64px))',
    // 100vh - 导航栏高度 = 可用高度
  }}
>
```

**说明**:
- `100vh`: 视口高度（Viewport Height）
- `var(--navbar-height, 64px)`: CSS变量，默认值64px
- `calc()`: 动态计算高度

## 高度计算示例

### 不同屏幕尺寸

| 屏幕高度 | 导航栏 | 可用高度 | 计算 |
|----------|--------|----------|------|
| 1080px | 64px | 1016px | 1080 - 64 |
| 900px | 64px | 836px | 900 - 64 |
| 768px | 64px | 704px | 768 - 64 |
| 600px | 64px | 536px | 600 - 64 |

### 视觉示例

#### 优化前
```
┌─────────────────────────┐ ← 屏幕顶部
│      Navbar (64px)      │
├─────────────────────────┤
│                         │
│  Content (100vh)        │ ← ❌ 超出屏幕
│                         │
│  ...                    │
└─────────────────────────┘
  (底部被遮挡)
```

#### 优化后
```
┌─────────────────────────┐ ← 屏幕顶部
│      Navbar (64px)      │
├─────────────────────────┤
│                         │
│  Content (100vh - 64px) │ ← ✅ 正好充满
│                         │
│                         │
└─────────────────────────┘ ← 屏幕底部
```

## 代码对比

### 修改前
```tsx
<div className="h-screen bg-gray-50 flex flex-col">
  {/* ❌ h-screen = 100vh，没有考虑导航栏 */}
  <div className="flex-1 flex gap-4 p-4 overflow-hidden">
```

### 修改后
```tsx
<div 
  className="flex flex-col bg-gray-50"
  style={{
    height: 'calc(100vh - var(--navbar-height, 64px))',
    // ✅ 减去导航栏高度
  }}
>
  <div className="flex-1 flex gap-4 p-4 overflow-hidden">
```

## 优势

### 1. 精确高度控制

```
准确高度 = 100vh - 导航栏实际高度
```

### 2. 灵活性

如果将来导航栏高度改变，只需修改CSS变量：

```css
:root {
  --navbar-height: 72px; /* 修改这里即可 */
}
```

### 3. 一致性

所有使用 `var(--navbar-height)` 的页面都会自动更新。

### 4. 响应式

在不同设备上自动适配：

```
移动端: 100vh - 64px
平板:   100vh - 64px
桌面:   100vh - 64px
```

## 其他页面应用

如果其他页面也需要从导航栏下边缘开始，可以使用相同方法：

```tsx
// 任何全屏页面
<div style={{ height: 'calc(100vh - var(--navbar-height))' }}>
  {/* 内容 */}
</div>
```

## 替代方案

### 方案1: Tailwind自定义类（更推荐）

如果多个页面需要这个高度，可以在Tailwind配置中添加自定义类：

```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      height: {
        'screen-minus-nav': 'calc(100vh - var(--navbar-height, 64px))',
      },
    },
  },
} satisfies Config;
```

使用：
```tsx
<div className="h-screen-minus-nav">
  {/* 内容 */}
</div>
```

### 方案2: 使用dvh（动态视口高度）

对于移动端更好的支持：

```css
height: calc(100dvh - var(--navbar-height, 64px));
```

`dvh` (Dynamic Viewport Height) 会考虑移动浏览器地址栏的动态变化。

## 测试检查清单

- [ ] 页面高度正好充满屏幕
- [ ] 内容不被导航栏遮挡
- [ ] 滚动条按预期工作
- [ ] 不同屏幕尺寸正常显示
- [ ] 缩放浏览器窗口，高度自适应

## 浏览器兼容性

| 特性 | Chrome | Firefox | Safari | Edge |
|------|--------|---------|--------|------|
| `calc()` | ✅ 26+ | ✅ 16+ | ✅ 7+ | ✅ 12+ |
| `var()` | ✅ 49+ | ✅ 31+ | ✅ 9.1+ | ✅ 15+ |
| `100vh` | ✅ 20+ | ✅ 19+ | ✅ 6+ | ✅ 12+ |

**结论**: 所有现代浏览器完全支持 ✅

## 调试技巧

### 1. 检查实际高度

在浏览器开发者工具中：

```javascript
// 获取页面高度
const pageHeight = document.querySelector('.flex.flex-col.bg-gray-50').offsetHeight;
console.log('Page height:', pageHeight);

// 获取视口高度
console.log('Viewport height:', window.innerHeight);

// 获取导航栏高度
const navbarHeight = getComputedStyle(document.documentElement)
  .getPropertyValue('--navbar-height');
console.log('Navbar height:', navbarHeight);

// 计算结果
console.log('Expected:', window.innerHeight - 64);
```

### 2. 视觉调试

添加临时边框查看高度：

```tsx
<div 
  className="flex flex-col bg-gray-50"
  style={{
    height: 'calc(100vh - var(--navbar-height, 64px))',
    border: '2px solid red', // 临时边框
  }}
>
```

### 3. CSS变量检查

在浏览器控制台：

```javascript
getComputedStyle(document.documentElement)
  .getPropertyValue('--navbar-height');
// 应该返回 "64px"
```

## 性能影响

✅ **无性能影响**:
- CSS `calc()` 在渲染时计算，无JavaScript开销
- CSS变量被浏览器原生支持，性能优秀
- 不需要监听resize事件
- 不需要动态JavaScript计算

## 总结

### 修改的文件
1. ✅ `src/styles/globals.css` - 添加 `--navbar-height` CSS变量
2. ✅ `src/app/[locale]/(marketing)/video-notes-prototype/page.tsx` - 使用高度计算

### 效果
- ✅ 页面内容从导航栏下边缘开始
- ✅ 充分利用可视区域
- ✅ 无内容遮挡
- ✅ 响应式适配

### 关键代码
```css
/* CSS变量定义 */
--navbar-height: 64px;
```

```tsx
/* 使用 */
style={{ height: 'calc(100vh - var(--navbar-height, 64px))' }}
```

🎉 **现在刷新页面，内容区域应该完美适配屏幕高度！**

