import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Typography from '@tiptap/extension-typography'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import { MathExtension } from './extension-math'
import { marked } from 'marked'
import TurndownService from 'turndown'
import { useEffect, useCallback, useState } from 'react'
import { 
  Bold, Italic, Underline as UnderlineIcon, 
  Highlighter, Sigma
} from 'lucide-react'
import { autoWrapLatex } from '@/lib/math-renderer'

interface NoteEditorProps {
  content: string;
  onChange: (markdown: string) => void;
  editable?: boolean;
}

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced'
});

// Add rule for math
turndownService.addRule('math', {
  filter: (node) => {
    return node.nodeName === 'SPAN' && node.getAttribute('data-type') === 'math';
  },
  replacement: (content, node) => {
    const latex = (node as Element).getAttribute('data-latex') || '';
    return ` $${latex}$ `; 
  }
});

// Simple pre-processor for $...$ to custom HTML
const preProcessMarkdown = (md: string) => {
  if (!md) return '';
  // 🔧 修复：先使用 autoWrapLatex 处理未包裹的数学表达式（如 X~U(a,b)）
  const processedMd = autoWrapLatex(md);
  
  // 🔧 修复：使用更精确的正则表达式，避免误匹配
  // 匹配 $...$ 格式的数学公式，但排除已经处理过的 HTML 标签
  return processedMd.replace(/(?<!\\)\$([^\$<>]+)(?<!\\)\$/g, (match, latex) => {
    // 跳过已经是 HTML 标签的内容
    if (latex.includes('<span') || latex.includes('</span>')) {
      return match;
    }
    // 修复用户反馈的 ~ 显示问题，替换为 \sim（双重保险）
    const fixedLatex = latex.replace(/~/g, '\\sim ');
    return `<span data-type="math" data-latex="${fixedLatex}"></span>`;
  });
};

export const NoteEditor = ({ content, onChange, editable = true }: NoteEditorProps) => {
  const [showToolbar, setShowToolbar] = useState(false);
  
  const editor = useEditor({
    extensions: [
      StarterKit,
      Typography,
      MathExtension,
      Underline,
      Highlight.configure({ multicolor: true }),
    ],
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[100px] p-2',
      },
    },
    content: '', 
    editable,
    immediatelyRender: false,
    onFocus: () => {
      setShowToolbar(true);
    },
    onBlur: ({ editor }) => {
      setShowToolbar(false);
      const html = editor.getHTML();
      const markdown = turndownService.turndown(html);
      onChange(markdown);
    },
  });

  useEffect(() => {
    if (editor && content) {
      const parseContent = async () => {
        const processedMd = preProcessMarkdown(content);
        const html = await marked.parse(processedMd);
        
        if (editor.isEmpty) {
          editor.commands.setContent(html);
        }
      };
      parseContent();
    }
  }, [content, editor]);

  // Insert Math Formula
  const addMath = useCallback(() => {
    if (editor) {
      editor.chain().focus().insertContent({ type: 'math', attrs: { latex: '' } }).run();
    }
  }, [editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="relative group/editor">
      {/* Custom Floating Toolbar */}
      {editable && showToolbar && (
        <div 
          className="absolute -top-12 left-0 z-10 flex bg-white shadow-xl border border-gray-200 rounded-lg overflow-hidden divide-x animate-in fade-in slide-in-from-bottom-2 duration-200"
          onMouseDown={(e) => e.preventDefault()} // 防止点击工具栏导致编辑器失去焦点
        >
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-2 hover:bg-gray-100 transition-colors ${editor.isActive('bold') ? 'text-blue-600 bg-blue-50' : 'text-gray-600'}`}
            title="加粗"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`p-2 hover:bg-gray-100 transition-colors ${editor.isActive('underline') ? 'text-blue-600 bg-blue-50' : 'text-gray-600'}`}
            title="下划线"
          >
            <UnderlineIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            className={`p-2 hover:bg-gray-100 transition-colors ${editor.isActive('highlight') ? 'text-blue-600 bg-blue-50' : 'text-gray-600'}`}
            title="高亮"
          >
            <Highlighter className="w-4 h-4" />
          </button>
          <button
            onClick={addMath}
            className={`p-2 hover:bg-gray-100 transition-colors ${editor.isActive('math') ? 'text-blue-600 bg-blue-50' : 'text-gray-600'}`}
            title="插入公式"
          >
            <Sigma className="w-4 h-4" />
          </button>
        </div>
      )}

      <EditorContent editor={editor} />
    </div>
  )
}
