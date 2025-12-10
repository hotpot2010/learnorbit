/**
 * 数学公式渲染配置工具
 * 用于在不同组件中统一LaTeX公式的渲染配置
 */

import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

/**
 * ReactMarkdown的默认插件配置，包含数学公式支持
 */
export const mathMarkdownPlugins = {
  remarkPlugins: [remarkMath],
  rehypePlugins: [rehypeKatex],
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
 */
export const autoWrapLatex = (content: string): string => {
  if (!content || typeof content !== 'string') return content;
  
  // 如果内容已经包含$包裹的公式，直接返回
  if (/\$[^$]+\$/.test(content) || /\$\$[\s\S]*?\$\$/.test(content)) {
    return content;
  }
  
  // 匹配LaTeX命令模式：\command{...} 或 \command 或 \command{...}{...}
  // 包括常见的数学符号和命令
  const latexPattern = /\\[a-zA-Z]+\*?(?:\{[^}]*\})*(?:\{[^}]*\})*/g;
  
  let result = content;
  const matches: Array<{ start: number; end: number; text: string }> = [];
  
  let match;
  while ((match = latexPattern.exec(content)) !== null) {
    // 检查是否已经被$包裹
    const before = content.substring(Math.max(0, match.index - 1), match.index);
    const after = content.substring(match.index + match[0].length, match.index + match[0].length + 1);
    
    if (before !== '$' && after !== '$') {
      // 尝试找到完整的公式（包括后续的数学符号）
      let formulaEnd = match.index + match[0].length;
      
      // 向后查找，找到公式结束（遇到空格、标点或换行）
      for (let i = formulaEnd; i < content.length; i++) {
        const char = content[i];
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
      
      const formulaText = content.substring(match.index, formulaEnd);
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
