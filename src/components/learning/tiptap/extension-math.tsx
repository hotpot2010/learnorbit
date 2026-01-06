import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import { useState, useEffect, useRef } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

// React Component for the Node View
const MathComponent = ({ node, updateAttributes, selected }: any) => {
  const [isEditing, setIsEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const latex = node.attrs.latex || ''

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isEditing])

  // 双击进入编辑模式，或者在选中状态下点击
  const handleClick = (e: React.MouseEvent) => {
    // 阻止冒泡，避免触发父级的点击事件
    e.stopPropagation();
    setIsEditing(true)
  }
  
  const handleBlur = () => {
    setIsEditing(false)
  }
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setIsEditing(false)
    }
  }

  return (
    <NodeViewWrapper className="inline-flex items-center align-middle mx-1 relative">
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={latex}
          onChange={(e) => updateAttributes({ latex: e.target.value })}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="border border-blue-500 rounded px-1 text-sm font-mono bg-white min-w-[50px] shadow-sm z-10"
          placeholder="输入 LaTeX 公式..."
        />
      ) : (
        <span 
          onClick={handleClick}
          className={`cursor-pointer px-1 rounded transition-colors hover:bg-gray-100 ${selected ? 'ring-2 ring-blue-300 bg-blue-50' : ''}`}
          title="点击编辑公式"
          dangerouslySetInnerHTML={{ 
            __html: katex.renderToString(latex || '?', { 
              throwOnError: false,
              displayMode: false 
            }) 
          }} 
        />
      )}
    </NodeViewWrapper>
  )
}

export const MathExtension = Node.create({
  name: 'math',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      latex: {
        default: 'E=mc^2',
      },
    }
  },

  parseHTML() {
    return [{ 
      tag: 'span[data-type="math"]',
      getAttrs: (node) => {
        if (typeof node === 'string') return false;
        const element = node as HTMLElement;
        const latex = element.getAttribute('data-latex') || '';
        return { latex };
      }
    }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'math' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathComponent)
  },
  
  // 添加输入规则：输入 $E=mc^2$ 然后按空格，转换为公式 (简单实现)
  // 这里暂时省略复杂正则，可以通过命令插入
})

