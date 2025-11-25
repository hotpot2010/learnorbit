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
 * 数学公式组件的样式类
 */
export const mathStyles = {
  blockMath: 'bg-indigo-50 p-4 rounded-lg border border-indigo-200 overflow-x-auto',
  inlineMath: 'bg-indigo-100 px-1 py-0.5 rounded text-indigo-800',
  mathIcon: 'w-6 h-6 rounded-full bg-indigo-400 text-white text-sm font-bold flex items-center justify-center mt-1 transform rotate-12 shadow-sm',
};
