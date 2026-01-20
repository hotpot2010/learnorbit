/**
 * 数学公式渲染配置工具
 * 用于在不同组件中统一LaTeX公式的渲染配置
 */

import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';

/**
 * ReactMarkdown的默认插件配置，包含数学公式支持和HTML支持
 */
export const mathMarkdownPlugins = {
  remarkPlugins: [remarkMath],
  rehypePlugins: [rehypeRaw, rehypeKatex], // rehypeRaw 必须在 rehypeKatex 之前，以支持 HTML 表格
};

/**
 * KaTeX配置选项
 */
export const katexOptions = {
  throwOnError: false, // 数学公式错误时不抛出异常
  errorColor: '#cc0000', // 错误时的颜色
  strict: 'warn', // 对于不识别的命令显示警告
  trust: false, // 出于安全考虑不信任用户输入
  macros: {
    // 可以在这里定义常用的数学宏
    '\\RR': '\\mathbb{R}',
    '\\NN': '\\mathbb{N}',
    '\\ZZ': '\\mathbb{Z}',
    '\\QQ': '\\mathbb{Q}',
    '\\CC': '\\mathbb{C}',
  },
};

/**
 * 检查内容是否包含数学公式
 */
export const containsMath = (content: string): boolean => {
  // 检查块级数学公式 $$...$$
  const blockMathRegex = /\$\$[\s\S]*?\$\$/;
  // 检查行内数学公式 $...$
  const inlineMathRegex = /\$[^$\n]+\$/;
  
  return blockMathRegex.test(content) || inlineMathRegex.test(content);
};

/**
 * 预处理数学公式内容，确保正确的格式
 */
export const preprocessMathContent = (content: string | null | undefined | any): string => {
  // 确保 content 是字符串类型
  // 处理 null、undefined、数字、对象等非字符串类型
  let str: string;
  if (typeof content === 'string') {
    str = content;
  } else if (content == null) {
    // null 或 undefined
    str = '';
  } else if (typeof content === 'number' || typeof content === 'boolean') {
    // 数字或布尔值转换为字符串
    str = String(content);
  } else if (typeof content === 'object') {
    // 对象或数组，尝试 JSON 序列化，如果失败则使用空字符串
    try {
      str = JSON.stringify(content);
    } catch {
      str = '';
    }
  } else {
    // 其他类型，强制转换为字符串
    str = String(content || '');
  }
  
  // 处理常见的LaTeX语法问题
  return str
    // 确保块级公式周围有换行
    .replace(/([^$])\$\$([^$])/g, '$1\n\n$$\n$2')
    .replace(/([^$])\$\$$/g, '$1\n\n$$')
    .replace(/^\$\$([^$])/g, '$$\n$1')
    // 修复常见的转义字符问题
    .replace(/\\{/g, '\\{')
    .replace(/\\}/g, '\\}');
};

/**
 * 自动检测并包裹LaTeX公式
 * 检测包含LaTeX命令但未被$包裹的内容，自动添加$包裹
 * 增加容错机制，修复常见的格式错误
 */
export const autoWrapLatex = (content: string): string => {
  if (!content || typeof content !== 'string') return content;
  
  // 🔧 修复：如果内容包含 HTML 表格，直接返回原内容，交给 rehypeRaw 处理
  // 这样可以避免占位符在 LaTeX 处理过程中被破坏
  const hasHtmlTable = /<table[^>]*>[\s\S]*?<\/table>/i.test(content);
  if (hasHtmlTable) {
    console.log('🔍 检测到 HTML 表格，跳过 autoWrapLatex 处理，交由 rehypeRaw 插件处理');
    return content;
  }
  
  let result = content;
  
  // 🔧 关键修复：在所有处理之前，先提取已存在的 $ 包裹的公式
  // 这样可以保护它们不被后续的正则处理破坏
  const preservedMathBlocks: Array<{ placeholder: string; content: string }> = [];
  let preservedBlockIndex = 0;
  
  // 提取 $$...$$ (块级公式)
  result = result.replace(/\$\$([\s\S]+?)\$\$/g, (match) => {
    const placeholder = `__PRESERVED_MATH_BLOCK_${preservedBlockIndex}__`;
    preservedMathBlocks.push({ placeholder, content: match });
    console.log(`🛡️ [保护块级公式 ${preservedBlockIndex}]:`, match);
    preservedBlockIndex++;
    return placeholder;
  });
  
  // 提取 $...$ (行内公式)
  result = result.replace(/\$([^$]+?)\$/g, (match) => {
    const placeholder = `__PRESERVED_MATH_INLINE_${preservedBlockIndex}__`;
    preservedMathBlocks.push({ placeholder, content: match });
    console.log(`🛡️ [保护行内公式 ${preservedBlockIndex}]:`, match);
    preservedBlockIndex++;
    return placeholder;
  });
  
  console.log(`🛡️ [保护后的内容]:`, result);
  
  // 🔧 容错0.1: 先处理未包裹的数学表达式中的 ~ 符号（优先级最高）
  // 例如：X~U(a,b) 或 \lambda~N(\mu,\sigma^2) 或 X~U
  // 匹配模式：单个大写字母或 LaTeX 命令 + ~ + 单个大写字母或 LaTeX 命令 + 可选的括号参数
  // 使用单词边界 \b 确保只匹配独立的数学表达式，不匹配单词中的部分
  // 注意：使用非贪婪匹配，避免匹配过多内容
  result = result.replace(/\b([A-Z]|\\[a-zA-Z]+)\s*~\s*([A-Z]|\\[a-zA-Z]+)(\([^)]*\))?/g, (match, before, after, params = '') => {
    // 检查是否已经在数学公式中（前后有 $）
    const matchIndex = result.indexOf(match);
    if (matchIndex === -1) return match; // 如果找不到匹配，返回原值
    
    const beforeChar = matchIndex > 0 ? result[matchIndex - 1] : '';
    const afterIndex = matchIndex + match.length;
    const afterChar = afterIndex < result.length ? result[afterIndex] : '';
    
    // 如果不在数学公式中，但看起来像数学表达式（如 X~U 或 X~U(a,b)），替换为 \sim 并包裹
    if (beforeChar !== '$' && afterChar !== '$') {
      // 检查是否是数学表达式：
      // 1. 大写字母（如 X, U, N）
      // 2. LaTeX 命令（如 \lambda, \mu）
      // 3. 后面有括号参数（如 (a,b)）
      const isMathExpression = (/^[A-Z]$/.test(before) && /^[A-Z]$/.test(after)) || 
                               /^\\[a-zA-Z]+$/.test(before) ||
                               /^\\[a-zA-Z]+$/.test(after) ||
                               (params && params.length > 0);
      
      if (isMathExpression) {
        // 如果参数中包含 LaTeX 命令或数学符号，也需要处理参数中的 ~
        const fixedParams = params ? params.replace(/(?<!\\)~/g, '\\sim ') : '';
        // 🔧 修复：将整个表达式用 $ 包裹，确保能够被正确渲染
        return `$${before}\\sim ${after}${fixedParams}$`;
      }
    }
    
    return match;
  });
  
  // 🔧 容错0: 修复数学公式中的 ~ 符号，替换为 \sim（波浪号）
  // 在 LaTeX 中，~ 是不可断行空格，要显示波浪号需要使用 \sim
  // 处理已经包裹的公式 $...$ 和 $$...$$
  // 先处理 $$...$$（块级公式）
  result = result.replace(/\$\$([^$]*?)\$\$/g, (match, formula) => {
    // 将公式中的 ~ 替换为 \sim（但不要替换 \sim 中的 ~）
    const fixedFormula = formula.replace(/(?<!\\)~/g, '\\sim ');
    return `$$${fixedFormula}$$`;
  });
  // 再处理 $...$（行内公式）
  result = result.replace(/\$([^$]+)\$/g, (match, formula) => {
    // 将公式中的 ~ 替换为 \sim（但不要替换 \sim 中的 ~）
    const fixedFormula = formula.replace(/(?<!\\)~/g, '\\sim ');
    return `$${fixedFormula}$`;
  });
  
  // 🔧 容错1: 修复 \begin{cases}$...\end{cases} 这种格式
  // 将 \begin{cases}$...\end{cases} 转换为 $$\begin{cases}...\end{cases}$$
  result = result.replace(/\\begin\{cases\}\$([\s\S]*?)\\end\{cases\}/g, (match, content) => {
    // 移除内容中多余的 $ 符号
    const cleanedContent = content.replace(/\$/g, '');
    return `$$\\begin{cases}${cleanedContent}\\end{cases}$$`;
  });
  
  // 🔧 容错2: 修复 \begin{cases}...\end{cases}$ 这种格式（缺少开头的$）
  result = result.replace(/\$\\begin\{cases\}([\s\S]*?)\\end\{cases\}/g, '$$\\begin{cases}$1\\end{cases}$$');
  
  // 🔧 容错3: 修复 \begin{cases}...\end{cases} 未包裹的情况
  result = result.replace(/([^$])\\begin\{cases\}([\s\S]*?)\\end\{cases\}([^$])/g, '$1$$\\begin{cases}$2\\end{cases}$$$3');
  
  // 🔧 容错4: 修复 $\lambda-1) 这种缺少左括号的情况
  // 匹配 $...变量-数字) 或 $...变量-变量) 的模式，在前面添加 (
  // 例如：$\lambda-1) -> $(\lambda-1)
  // 支持 LaTeX 命令（如 \lambda, \mu 等）
  result = result.replace(/\$([^$]*?)(\\[a-zA-Z]+|\w+)-(\d+)\)/g, '$$1($2-$3)');
  result = result.replace(/\$([^$]*?)(\\[a-zA-Z]+|\w+)-([a-zA-Z_\\]+)\)/g, '$$1($2-$3)');
  
  // 🔧 容错5: 修复 N(\mu,\sigma^2) 这种未包裹的公式
  // 匹配类似 N(...) 或 X(...) 这种单字母+括号的模式，且参数中包含 LaTeX 命令
  result = result.replace(/([^$\\])([A-Z])\s*\(([^)]*)\)/g, (match, before, letter, params) => {
    // 🔧 修复：如果参数中已经包含 $ 符号，说明已被处理过，跳过以避免嵌套
    // 例如：N($μ$, $σ$) 不应该被包裹成 $$N($μ$, $σ$)$$
    if (params.includes('$')) {
      return match;
    }
    
    // 检查参数中是否包含 LaTeX 命令（反斜杠、大括号、希腊字母等）
    if (/\\[a-zA-Z]|[\{\}]|[\u03B1-\u03FF]/.test(params)) {
      return `${before}$$${letter}(${params})$$`;
    }
    return match;
  });
  
  // 🔧 关键修复：容错5 可能生成了新的 $$...$$ 公式，需要立即保护它们
  // 避免后续的容错5.1在其内部重复包裹希腊字母
  result = result.replace(/\$\$([\s\S]+?)\$\$/g, (match) => {
    const placeholder = `__PRESERVED_MATH_BLOCK_${preservedBlockIndex}__`;
    preservedMathBlocks.push({ placeholder, content: match });
    console.log(`🛡️ [保护新生成的块级公式 ${preservedBlockIndex}]:`, match);
    preservedBlockIndex++;
    return placeholder;
  });
  
  // 🔧 容错5.1: 修复单独的希腊字母或数学符号未包裹的情况
  // 例如：λ、μ、σ 等（已经被 $ 包裹的会在最开始被提取保护，这里只处理未包裹的）
  // 匹配：希腊字母 + 可选的上标字符（²³¹⁰⁴⁵⁶⁷⁸⁹⁺⁻⁼等）
  result = result.replace(/([^$\\])([\u03B1-\u03FF])([\u00B2\u00B3\u00B9\u2070-\u209F]*)/g, (match, before, greek, superscript) => {
    console.log(`🔧 [包裹希腊字母]:`, match, '→', `${before}$${greek}${superscript}$`);
    return `${before}$${greek}${superscript}$`;
  });
  
  // 🔧 容错6: 将 \(...\) 转换为 $...$
  result = result.replace(/\\\((.*?)\\\)/g, '$$$1$$');
  
  // 🔧 容错7: 将 \[...\] 转换为 $$...$$（块级公式）
  result = result.replace(/\\\[([\s\S]*?)\\\]/g, '\n\n$$$$1$$\n\n');
  
  // 🔧 容错8: 修复 (\lim 或 (\ 开头的错误格式（LLM有时会输出这种格式）
  // 将 (\... 替换为 $\...
  result = result.replace(/\(\\([a-zA-Z]+)/g, '$\\$1');
  
  // 🔧 容错9: 修复 \) 结尾的错误格式
  // 将 ...\) 替换为 ...$
  result = result.replace(/\\\)/g, '$$');
  
  // 🔧 容错10: 修复 \end{cases} 后面缺少闭合 $ 的情况
  result = result.replace(/\\end\{cases\}([^$])/g, '\\end{cases}$$$1');
  
  // 🔧 容错11: 检查$符号是否配对
  const dollarCount = (result.match(/\$/g) || []).length;
  if (dollarCount % 2 !== 0) {
    console.warn('⚠️ LaTeX 公式括号不匹配，尝试修复...', result);
    // 在末尾添加$
    result += '$';
  }
  
  // 如果内容已经包含$包裹的公式，跳过后续的自动包裹处理
  // 但仍然需要恢复占位符
  const hasWrappedFormulas = /\$[^$]+\$/.test(result) || /\$\$[\s\S]*?\$\$/.test(result);
  if (hasWrappedFormulas) {
    // 🔧 恢复所有保护的公式后再返回
    preservedMathBlocks.forEach(({ placeholder, content }) => {
      result = result.replace(placeholder, content);
      console.log(`🛡️ [恢复保护的公式]:`, placeholder, '→', content);
    });
    console.log(`✅ [最终处理结果 - 提前返回]:`, result);
    return result;
  }
  
  // 匹配LaTeX命令模式：\command{...} 或 \command 或 \command{...}{...}
  // 包括常见的数学符号和命令
  const latexPattern = /\\[a-zA-Z]+\*?(?:\{[^}]*\})*(?:\{[^}]*\})*/g;
  
  const matches: Array<{ start: number; end: number; text: string }> = [];
  
  let match;
  while ((match = latexPattern.exec(result)) !== null) {
    // 检查是否已经被$包裹
    const before = result.substring(Math.max(0, match.index - 1), match.index);
    const after = result.substring(match.index + match[0].length, match.index + match[0].length + 1);
    
    if (before !== '$' && after !== '$') {
      // 尝试找到完整的公式（包括后续的数学符号）
      let formulaEnd = match.index + match[0].length;
      
      // 向后查找，找到公式结束（遇到空格、标点或换行）
      for (let i = formulaEnd; i < result.length; i++) {
        const char = result[i];
        // 如果遇到数学符号或字母数字，继续
        if (/[a-zA-Z0-9_^{}\\]/.test(char)) {
          formulaEnd = i + 1;
        } 
        // 如果遇到空格、标点或换行，且不在大括号内，停止
        else if (/[\s\n\r,.;:!?)]/.test(char)) {
          break;
        } else {
          formulaEnd = i + 1;
        }
      }
      
      const formulaText = result.substring(match.index, formulaEnd);
      // 避免重复添加
      if (!matches.some(m => m.start <= match.index && m.end >= formulaEnd)) {
        matches.push({ start: match.index, end: formulaEnd, text: formulaText });
      }
    }
  }
  
  // 按位置排序并合并重叠的匹配
  matches.sort((a, b) => b.start - a.start); // 从后向前排序，避免索引变化
  
  // 从后向前替换
  for (const match of matches) {
    result = result.substring(0, match.start) + 
             `$${match.text}$` + 
             result.substring(match.end);
  }
  
  // 🔧 最后：恢复所有在开始时保护的公式
  preservedMathBlocks.forEach(({ placeholder, content }) => {
    result = result.replace(placeholder, content);
    console.log(`🛡️ [恢复保护的公式]:`, placeholder, '→', content);
  });
  
  console.log(`✅ [最终处理结果]:`, result);
  
  return result;
};

/**
 * 数学公式组件的样式类
 */
export const mathStyles = {
  blockMath: 'bg-indigo-50 p-4 rounded-lg border border-indigo-200 overflow-x-auto',
  inlineMath: 'bg-indigo-100 px-1 py-0.5 rounded text-indigo-800',
  mathIcon: 'w-6 h-6 rounded-full bg-indigo-400 text-white text-sm font-bold flex items-center justify-center mt-1 transform rotate-12 shadow-sm',
};
