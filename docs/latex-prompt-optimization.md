# LaTeX 公式 Prompt 优化说明

## 📝 优化目标

确保 AI 生成的内容中的数学公式能够被前端正确渲染，避免格式错误导致的显示问题。

## 🎯 前端渲染支持

### 支持的格式

前端使用 `remark-math` 和 `rehype-katex` 进行 LaTeX 渲染：

- **行内公式**：`$...$` 
  - 示例：`$\frac{1}{2}$`、`$\sin x$`
  
- **块级公式**：`$$...$$`
  - 示例：`$$\int_0^1 x dx$$`

### 容错机制

前端已实现自动容错（`autoWrapLatex`），可处理：
- `\(...\)` 自动转换为 `$...$`
- `\[...\]` 自动转换为 `$$...$$`
- 不配对的 `$` 符号自动补全
- 检测未包裹的 LaTeX 命令并自动添加 `$`

## ✅ 优化内容

### 1. 问答功能 (answer-question)

#### 中文 Prompt 增加内容：

```
5. **数学公式必须使用 LaTeX 格式，用 $ 包裹**：
   - 行内公式：用单个 $ 包裹，例如 $\frac{1}{2}$ 或 $\sin x$
   - 块级公式：用双 $$ 包裹，例如 $$\int_0^1 x dx$$
   - 常用符号：$\pi$、$\infty$、$\alpha$、$\sum$、$\int$ 等
   - 分数：$\frac{分子}{分母}$
   - 极限：$\lim_{x \to 0}$
   - 根号：$\sqrt{x}$ 或 $\sqrt[n]{x}$
   - 上标：$x^2$，下标：$x_i$
6. **绝对不要使用以下错误格式**：
   - ❌ \(...\) 或 \[...\]
   - ❌ 不加 $ 的纯 LaTeX 命令
   - ❌ 公式中的反斜杠未转义
```

#### 英文 Prompt 增加内容：

```
5. **For mathematical formulas, MUST use LaTeX format with $ delimiters**:
   - Inline formula: wrap with single $, e.g., $\frac{1}{2}$ or $\sin x$
   - Block formula: wrap with double $$, e.g., $$\int_0^1 x dx$$
   - Common symbols: $\pi$, $\infty$, $\alpha$, $\sum$, $\int$, etc.
   - Fractions: $\frac{numerator}{denominator}$
   - Limits: $\lim_{x \to 0}$
   - Square roots: $\sqrt{x}$ or $\sqrt[n]{x}$
   - Superscripts: $x^2$, Subscripts: $x_i$
6. **NEVER use these incorrect formats**:
   - ❌ \(...\) or \[...\]
   - ❌ Plain LaTeX without $ delimiters
   - ❌ Unescaped backslashes in formulas
```

### 2. 练习生成功能 (generate-exercise)

#### 中文 Prompt 优化：

**新增 LaTeX 规范专区：**

```
**LaTeX 公式规范（重要！）**：
- ✅ 正确格式：在 JSON 中，所有反斜杠必须转义为双反斜杠 \\
- ✅ 行内公式：$\\frac{1}{2}$、$\\sin x$、$\\pi$
- ✅ 块级公式：$$\\int_0^1 x dx$$
- ✅ 常用符号：$\\alpha$、$\\beta$、$\\sum$、$\\lim_{x \\to 0}$
- ✅ 分数：$\\frac{分子}{分母}$
- ✅ 根号：$\\sqrt{x}$、$\\sqrt[3]{x}$
- ✅ 上下标：$x^2$、$x_i$、$x_{ij}$（多字符下标需要大括号）
- ❌ 错误格式：\frac{1}{2}（单反斜杠）、\(...\)、\[...\]
```

**更新示例，包含实际公式：**

```json
{
  "type": "multiple_choice",
  "question": "已知函数 $f(x) = \\frac{x^2 + 1}{x - 1}$，求 $\\lim_{x \\to 1} f(x)$ 的值",
  "choices": [
    {"label": "A", "content": "$\\frac{1}{2}$"},
    {"label": "B", "content": "$1$"},
    {"label": "C", "content": "$2$"},
    {"label": "D", "content": "不存在"}
  ],
  "solution": "D",
  "hints": [
    "提示1：首先检查函数在 $x = 1$ 处是否连续",
    "提示2：注意分母为零的情况，需要使用极限的定义",
    "提示3：可以分别计算左极限 $\\lim_{x \\to 1^-}$ 和右极限 $\\lim_{x \\to 1^+}$"
  ]
}
```

**关键要点明确：**

```
1. JSON 中的反斜杠必须双写：\\ 而不是 \
2. 公式必须用 $ 包裹，否则无法渲染
3. 多字符的上下标要用大括号：$x_{ij}$ 而不是 $x_ij$
4. 所有 choices、solution、hints 中的公式都要遵循相同规范
```

#### 英文 Prompt 优化：

与中文版相同的规范和示例，用英文表述。

## 🔍 关键改进点

### 1. **明确格式要求**
   - 强调必须使用 `$...$` 包裹
   - 明确禁止 `\(...\)` 和 `\[...\]` 格式
   - 说明 JSON 中反斜杠转义规则

### 2. **提供丰富示例**
   - 分数、极限、根号、上下标等常用格式
   - 展示完整的 JSON 示例，包含实际公式
   - 选择题和填空题都包含公式示例

### 3. **强调多字符下标**
   - `$x_{ij}$` ✅ 正确
   - `$x_ij$` ❌ 错误（会渲染为 $x_i j$）

### 4. **JSON 转义说明**
   - 单反斜杠 `\` → JSON 中写为双反斜杠 `\\`
   - 示例：`\frac{1}{2}` → JSON 中写为 `\\frac{1}{2}`

## 📊 效果预期

### 优化前可能出现的问题：

1. ❌ `计算极限 (\lim_{x → 0} \frac{\sin x}{x}\) 的值`
   - 使用了错误的 `\(...\)` 格式

2. ❌ `答案是 \frac{1}{2}`
   - 缺少 `$` 包裹

3. ❌ JSON 中 `"solution": "\frac{1}{2}"`
   - 单反斜杠，JSON 解析错误

4. ❌ `$x_ij$`
   - 多字符下标未使用大括号

### 优化后预期输出：

1. ✅ `计算极限 $\lim_{x \to 0} \frac{\sin x}{x}$ 的值`
   - 正确使用 `$...$` 包裹

2. ✅ `答案是 $\frac{1}{2}$`
   - 正确包裹

3. ✅ JSON 中 `"solution": "$\\frac{1}{2}$"`
   - 双反斜杠转义

4. ✅ `$x_{ij}$`
   - 正确使用大括号

## 🛠️ 前端容错

即使 AI 输出了部分错误格式，前端的 `autoWrapLatex` 函数也会尝试自动修复：

```typescript
// 自动转换常见错误格式
result = result.replace(/\\\((.*?)\\\)/g, '$$$1$$');  // \(...\) → $...$
result = result.replace(/\\\[([\s\S]*?)\\\]/g, '\n\n$$$$1$$\n\n');  // \[...\] → $$...$$
result = result.replace(/\(\\([a-zA-Z]+)/g, '$\\$1');  // (\lim → $\lim
```

但最佳实践是从源头确保格式正确！

## 📝 测试建议

### 测试用例：

1. **简单公式**：`$\frac{1}{2}$`、`$\sin x$`
2. **复杂公式**：`$\lim_{x \to 0} \frac{\sin x - x}{x^3}$`
3. **多字符下标**：`$x_{ij}$`、`$\sum_{i=1}^{n}$`
4. **块级公式**：`$$\int_0^1 x^2 dx = \frac{1}{3}$$`
5. **混合内容**：文字 + 行内公式 + 文字

### 验证清单：

- [ ] 公式被正确渲染
- [ ] 没有出现原始 LaTeX 命令
- [ ] JSON 可以正常解析
- [ ] 前端控制台无错误
- [ ] 公式显示清晰，符号正确

## 🔗 相关文件

- **后端 API**: `backend/app/api/routes/notes.py`
- **前端渲染**: `src/lib/math-renderer.ts`
- **组件使用**: `src/app/[locale]/(marketing)/video-notes-prototype/page.tsx`

## 📚 参考资源

- [KaTeX 支持的函数列表](https://katex.org/docs/supported.html)
- [LaTeX 数学符号大全](https://oeis.org/wiki/List_of_LaTeX_mathematical_symbols)
- [remark-math 文档](https://github.com/remarkjs/remark-math)
- [rehype-katex 文档](https://github.com/remarkjs/remark-math/tree/main/packages/rehype-katex)

