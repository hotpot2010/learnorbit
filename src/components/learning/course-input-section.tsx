'use client';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { LoginRequiredDialog } from '@/components/auth/login-required-dialog';
import { Loader2, Send, Upload, X, File as FileIcon, Paperclip } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useLocaleRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { useCurrentUser } from '@/hooks/use-current-user';
import { authClient } from '@/lib/auth-client';
import { trackKeyActionSafely } from '@/lib/key-actions-analytics';

interface CourseInputSectionProps {
  className?: string;
}

export function CourseInputSection({ className }: CourseInputSectionProps) {
  const t = useTranslations('LearningPlatform');
  const router = useLocaleRouter();
  const currentUser = useCurrentUser();
  const { isPending: authPending } = authClient.useSession();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 页面加载时恢复文件上传状态
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const fileName = sessionStorage.getItem('uploadedFileName');
      if (fileName) {
        // 创建一个虚拟的File对象用于显示
        const virtualFile = new File([''], fileName, { type: 'application/octet-stream' });
        setUploadedFile(virtualFile);
      }
    }
  }, []);

  // 文件上传处理
  const handleFileUpload = async (file: File) => {
    // 如果认证状态还在加载中，等待加载完成
    if (authPending) {
      console.log('🔄 认证状态加载中，请稍候...');
      return;
    }
    
    // 如果用户未登录，显示登录对话框
    if (!currentUser) {
      console.log('🔐 用户未登录，显示登录对话框');
      setShowLoginDialog(true);
      return;
    }
    
    console.log('✅ 用户已登录，开始上传文件:', currentUser.id);

    // 移除文件上传事件跟踪，只在页面切换时上报

    setIsUploading(true);
    const uploadStartTime = Date.now();
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      // 生成会话ID用于关联文档（将连字符替换为下划线以符合Milvus要求）
      const sessionId = crypto.randomUUID().replace(/-/g, '_');
      formData.append('chat_id', sessionId);
      
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('文件上传成功:', result);
        setUploadedFile(file);
        
        // 保存会话ID和文件上传状态到sessionStorage
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('uploadSessionId', sessionId);
          sessionStorage.setItem('hasUploadedFile', 'true');
          sessionStorage.setItem('uploadedFileName', file.name);
        }

        // 移除文件上传成功事件跟踪
      } else {
        console.error('文件上传失败:', response.statusText);
        
        // 移除文件上传失败事件跟踪
        
        alert('文件上传失败，请重试');
      }
    } catch (error) {
      console.error('文件上传出错:', error);
      
      // 移除文件上传异常事件跟踪
      
      alert('文件上传出错，请重试');
    } finally {
      setIsUploading(false);
    }
  };

  // 处理文件选择
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  // 移除上传的文件
  const handleRemoveFile = () => {
    setUploadedFile(null);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('uploadSessionId');
      sessionStorage.removeItem('hasUploadedFile');
      sessionStorage.removeItem('uploadedFileName');
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!input.trim()) return;

    // 不再跟踪学习计划开始事件，只在页面切换时上报

    // 检查用户登录状态
    if (!currentUser) {
      setShowLoginDialog(true);
      return;
    }

    setIsLoading(true);

    // 🎯 关键行为打点：生成课程
    trackKeyActionSafely('generate_course', {
      input_text: input.trim(),
      input_length: input.trim().length,
      has_uploaded_file: !!uploadedFile,
      uploaded_file_name: uploadedFile?.name || null,
      generation_type: uploadedFile ? 'with_file' : 'text_only',
      is_authenticated: true, // 已通过登录检查
    }, currentUser);

    // 保存用户输入并立即跳转
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('learningInput', input);
      sessionStorage.removeItem('aiResponse'); // 清除之前的响应
    }

    console.log('首页输入框调用chat1接口:', input);
    console.log('首页API调用: /api/chat1/stream');

    // 立即跳转到课程定制页面
    router.push('/custom');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className={`w-full max-w-2xl mx-auto ${className}`}>
      <div className="relative">
        <Textarea
          placeholder={t('inputPlaceholder')}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full min-h-[50px] lg:min-h-[80px] resize-none text-base lg:text-sm px-4 py-3 lg:py-3 pr-24 lg:pr-4 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-xl shadow-sm focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all duration-200"
          disabled={isLoading}
          style={{ fontSize: '16px' }} // 防止iOS缩放
          rows={1}
        />

        {/* 移动端按钮组 - 右侧内嵌 */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 lg:hidden">
          {/* 文件上传按钮 */}
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || isUploading || authPending}
            size="sm"
            variant="ghost"
            className="p-2 min-h-[40px] min-w-[40px] text-gray-400 hover:text-gray-600 hover:bg-gray-100/50 rounded-lg transition-colors"
            title={authPending ? "加载中..." : "上传文件"}
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : authPending ? (
              <Loader2 className="w-4 h-4 animate-spin opacity-50" />
            ) : (
              <Paperclip className="w-4 h-4" />
            )}
          </Button>

          {/* 发送按钮 */}
          <Button
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading}
            size="sm"
            className="p-2 min-h-[40px] min-w-[40px] bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-colors"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* 桌面端按钮布局 - 保持原样 */}
        <div className="hidden lg:block">
          {/* 文件上传按钮 - 左下角 */}
          <div className="absolute bottom-3 left-3 flex items-center gap-2">
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || isUploading || authPending}
              size="sm"
              variant="ghost"
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100/50 rounded-lg transition-colors"
              title={authPending ? "加载中..." : "上传文件"}
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : authPending ? (
                <Loader2 className="w-4 h-4 animate-spin opacity-50" />
              ) : (
                <Paperclip className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* 发送按钮 - 右下角 */}
          <div className="absolute bottom-3 right-3">
            <Button
              onClick={handleSubmit}
              disabled={!input.trim() || isLoading}
              size="sm"
              className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-colors"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Send className="w-3.5 h-3.5 mr-1" />
                  {t('generatePlan')}
                </>
              )}
            </Button>
          </div>
        </div>

        {/* 已上传文件标签 - 移动端显示在输入框下方 */}
        {uploadedFile && (
          <div className="mt-2 lg:hidden">
            <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded-md text-xs w-fit">
              <FileIcon className="w-3 h-3" />
              <span className="max-w-32 truncate">{uploadedFile.name}</span>
              <button
                onClick={handleRemoveFile}
                className="ml-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* 桌面端文件标签 - 保持原位置 */}
        {uploadedFile && (
          <div className="absolute bottom-3 left-16 hidden lg:flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded-md text-xs">
            <FileIcon className="w-3 h-3" />
            <span className="max-w-20 truncate">{uploadedFile.name}</span>
            <button
              onClick={handleRemoveFile}
              className="ml-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* 隐藏的文件输入 */}
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileChange}
          className="hidden"
          accept=".pdf,.doc,.docx,.txt,.md"
        />
      </div>
      
      {/* 登录验证弹窗 */}
      <LoginRequiredDialog
        open={showLoginDialog}
        onOpenChange={setShowLoginDialog}
      />
    </div>
  );
}
