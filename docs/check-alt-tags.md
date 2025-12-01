# 如何检查图片 alt 标签

## 为什么在网页源代码中看不到？

因为这是一个 **React 客户端渲染应用**，页面内容是动态生成的：
- **查看源代码**（右键 → 查看网页源代码）：只能看到初始 HTML，不包含动态内容
- **开发者工具**：可以看到浏览器实际渲染后的 DOM，包含所有动态内容

## 检查方法

### 方法1：使用浏览器开发者工具（推荐）

1. **打开开发者工具**
   - Chrome/Edge: 按 `F12` 或 `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
   - Firefox: 按 `F12` 或 `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)

2. **查看 Elements/Inspector 面板**
   - 在 Elements（Chrome）或 Inspector（Firefox）面板中
   - 找到图片元素 `<img>` 标签
   - 查看 `alt` 属性

3. **使用选择工具**
   - 点击开发者工具左上角的"选择元素"图标（或按 `Ctrl+Shift+C`）
   - 点击页面上的图片
   - 在右侧面板中查看该图片的 `alt` 属性

### 方法2：在控制台检查

在浏览器控制台（Console）中运行：

```javascript
// 检查所有图片的 alt 标签
document.querySelectorAll('img').forEach((img, index) => {
  console.log(`图片 ${index + 1}:`, {
    src: img.src.substring(0, 50) + '...',
    alt: img.alt || '(无 alt 标签)',
    title: img.title || '(无 title)'
  });
});

// 检查便签中的图片
document.querySelectorAll('[data-note-id] img, .sticky-note img').forEach((img, index) => {
  console.log(`便签图片 ${index + 1}:`, {
    alt: img.alt || '(无 alt 标签)',
    src: img.src.substring(0, 50) + '...'
  });
});
```

### 方法3：检查网络请求

1. 打开开发者工具的 **Network（网络）** 面板
2. 刷新页面
3. 筛选 `Img` 类型
4. 点击图片请求
5. 查看 **Headers** 中的 `alt` 属性（如果有）

### 方法4：使用 SEO 检查工具

- **Google Search Console**: 可以检查图片的 alt 标签
- **Lighthouse**: Chrome 开发者工具中的 Lighthouse 可以检查 SEO，包括图片 alt 标签
- **浏览器扩展**: 如 "SEO META in 1 CLICK" 等可以检查页面 SEO

## 验证 alt 标签是否正确

### 检查点：

1. ✅ **所有图片都有 alt 属性**
   ```html
   <img src="..." alt="图片名称" />
   ```

2. ✅ **alt 内容有意义**
   - ❌ 错误：`alt=""` 或 `alt="图片"` 或 `alt="Image 1"`
   - ✅ 正确：`alt="机器学习算法流程图"` 或 `alt="Python 代码示例"`

3. ✅ **编辑后的图片名会更新 alt 标签**
   - 双击图片名编辑
   - 保存后，alt 标签应该更新为新名称

## 调试代码

如果 alt 标签没有正确更新，可以在代码中添加调试日志：

```typescript
// 在图片渲染时添加日志
<img
  src={image.url}
  alt={image.name || `Image ${index + 1}`}
  onLoad={() => {
    console.log('图片加载:', {
      url: image.url,
      alt: image.name || `Image ${index + 1}`,
      name: image.name
    });
  }}
/>
```

## 常见问题

### Q: 为什么编辑图片名后，alt 标签没有更新？
A: 确保：
1. 图片名已保存到 `notes` 状态
2. React 组件已重新渲染
3. 图片的 `alt` 属性绑定到 `image.name`

### Q: SEO 工具检测不到 alt 标签？
A: 
1. 确保图片是 `<img>` 标签，不是 CSS 背景图
2. 确保 alt 属性有值（不能是空字符串）
3. 等待搜索引擎重新抓取页面

