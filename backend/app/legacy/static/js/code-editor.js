// Code Editor Configuration and Initialization
console.log('code-editor.js 开始加载');

document.addEventListener('DOMContentLoaded', () => {
    console.log('CodeEditor - DOM内容加载完成，准备初始化编辑器');
    
    // 加载CodeMirror库
    if (typeof CodeMirror === 'undefined') {
        console.log('CodeMirror未加载，开始动态加载脚本');
        loadCodeMirrorScripts();
    } else {
        console.log('CodeMirror已加载，直接初始化编辑器');
        initializeCodeEditor();
    }
});

function loadCodeMirrorScripts() {
    // 加载所需的CodeMirror脚本
    const scripts = [
        'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/codemirror.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/mode/python/python.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/addon/edit/closebrackets.min.js'
    ];
    
    const styles = [
        'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/codemirror.min.css',
        'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.2/theme/material-darker.min.css'
    ];
    
    // 加载CSS文件
    styles.forEach(styleSrc => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = styleSrc;
        document.head.appendChild(link);
        console.log('加载CSS:', styleSrc);
    });
    
    // 按顺序加载脚本
    let promise = Promise.resolve();
    scripts.forEach(scriptSrc => {
        promise = promise.then(() => {
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = scriptSrc;
                script.onload = () => {
                    console.log('脚本加载成功:', scriptSrc);
                    resolve();
                };
                script.onerror = (err) => {
                    console.error('脚本加载失败:', scriptSrc, err);
                    reject(err);
                };
                document.head.appendChild(script);
            });
        });
    });
    
    // 所有脚本加载完毕后初始化编辑器
    promise.then(() => {
        console.log('所有CodeMirror脚本加载完成');
        setTimeout(initializeCodeEditor, 100); // 短暂延迟确保所有内容加载完毕
    }).catch(error => {
        console.error('加载CodeMirror脚本失败:', error);
    });
}

function initializeCodeEditor() {
    console.log('开始初始化代码编辑器');
    const codeEditorContainer = document.getElementById('codeEditorContainer');
    
    if (!codeEditorContainer) {
        console.error('未找到代码编辑器容器');
        return;
    }
    
    if (typeof CodeMirror === 'undefined') {
        console.error('CodeMirror未定义，无法初始化编辑器');
        return;
    }
    
    try {
        // 初始化代码编辑器
        console.log('创建CodeMirror实例');
        window.codeEditor = CodeMirror(codeEditorContainer, {
            mode: 'python',
            theme: 'material-darker',
            lineNumbers: true,
            autoCloseBrackets: true,
            indentUnit: 4,
            tabSize: 4,
            lineWrapping: true,
            matchBrackets: true,
            autofocus: true,
            value: '# 在此编写代码...'
        });
        
        // 确保编辑器适应容器大小并处理窗口调整大小事件
        window.codeEditor.setSize('100%', '100%');
        window.addEventListener('resize', () => {
            setTimeout(() => window.codeEditor.refresh(), 100);
        });
        
        // 更新状态栏
        const statusIndicator = document.querySelector('.status-indicators');
        
        if (statusIndicator) {
            window.codeEditor.on('cursorActivity', editor => {
                const cursor = editor.getCursor();
                statusIndicator.textContent = `Python • 行: ${cursor.line + 1}, 列: ${cursor.ch}`;
            });
        } else {
            console.warn('未找到状态指示器元素');
        }
        
        // 监听学习计划更新事件
        window.addEventListener('learningPlanUpdated', function(e) {
            const learningPlan = e.detail;
            if (learningPlan && learningPlan.plan) {
                // 查找当前进行中的步骤
                const currentStep = learningPlan.plan.find(step => step.status === '当前进行');
                if (currentStep && currentStep.answer && currentStep.answer.trim()) {
                    // 如果答案是编程题，则更新编辑器内容
                    if (isCodeAnswer(currentStep.answer)) {
                        updateEditorWithAnswer(currentStep.answer);
                    }
                }
            }
        });
        
        // 添加运行代码按钮功能
        const runCodeBtn = document.querySelector('.action-buttons .btn-secondary');
        
        if (runCodeBtn) {
            runCodeBtn.addEventListener('click', () => {
                console.log('点击运行代码按钮');
                alert('代码执行功能尚未实现');
            });
        } else {
            console.warn('未找到运行代码按钮');
        }
        
        // 添加提交按钮功能（之前错误地标识为保存按钮）
        const submitTaskBtn = document.querySelector('.action-buttons .btn-primary');
        
        if (submitTaskBtn) {
            // 移除之前的点击事件处理
            submitTaskBtn.removeEventListener('click', () => {});
            
            // 在submitTaskBtn上添加数据属性，标记为已处理
            // 但不添加新的事件监听器，因为事件在learning-plan.js中已处理
            submitTaskBtn.dataset.handledByCodeEditor = 'true';
            console.log('提交按钮已处理，静默提交模式');
        } else {
            console.warn('未找到提交按钮');
        }
        
        console.log('代码编辑器初始化成功');
    } catch (err) {
        console.error('初始化代码编辑器时出错:', err);
    }
}

/**
 * 更新编辑器内容，用于显示学习计划中的答案代码
 * @param {string} answerCode - 答案代码
 */
function updateEditorWithAnswer(answerCode) {
    if (!window.codeEditor) return;
    
    // 如果答案代码不是格式化的Python代码，先格式化它
    let formattedCode = answerCode;
    if (!answerCode.startsWith('#') && !answerCode.startsWith('import') && !answerCode.startsWith('def')) {
        formattedCode = `# 当前任务答案\n\n${answerCode}`;
    }
    
    // 更新编辑器内容
    window.codeEditor.setValue(formattedCode);
    // 刷新编辑器
    setTimeout(() => window.codeEditor.refresh(), 100);
}

/**
 * 判断答案是否是代码类型
 * @param {string} answer - 答案内容
 * @returns {boolean} - 是否是代码类型答案
 */
function isCodeAnswer(answer) {
    // 检查答案是否包含常见编程语言的特征
    const codePatterns = [
        /\bdef\b.*\(.*\):/,      // Python函数定义
        /\bclass\b.*\{/,          // 类定义
        /\bfunction\b.*\{/,       // JavaScript函数
        /\bif\b.*\(.*\)/,         // if语句
        /\bfor\b.*\(.*\)/,        // for循环
        /\bwhile\b.*\(.*\)/,      // while循环
        /\bimport\b/,             // import语句
        /\breturn\b/,             // return语句
        /==|!=|<=|>=|&&|\|\|/     // 常见操作符
    ];
    
    return codePatterns.some(pattern => pattern.test(answer));
} 