/**
 * 学习计划进度管理
 */
document.addEventListener('DOMContentLoaded', function() {
    // 获取DOM元素
    const submitTaskBtn = document.getElementById('submitTaskBtn');
    const learningTimelineElement = document.querySelector('.learning-timeline');
    const currentTaskHeader = document.querySelector('.current-task-header');
    const currentTaskTitle = document.querySelector('.current-task-title');
    const currentTaskDesc = document.querySelector('.current-task-desc');
    
    // 获取各个编辑区的按钮元素
    const quizTabBtn = document.getElementById('quizTabBtn');
    const codeTabBtn = document.getElementById('codeTabBtn');
    const webTabBtn = document.getElementById('webTabBtn');
    
    // 获取选择题相关元素
    const quizQuestion = document.getElementById('quizQuestion');
    const quizOptions = document.getElementById('quizOptions');
    
    // 学习计划数据
    let learningPlan = null;
    // 当前步骤索引（0-based）
    let currentStepIndex = 0;
    
    // 监听学习计划生成事件
    window.addEventListener('learningPlanGenerated', function(e) {
        learningPlan = e.detail;
        // 重置进度
        currentStepIndex = 0;
        // 更新UI
        updateLearningProgress();
    });
    
    // 监听学习计划更新事件
    window.addEventListener('learningPlanUpdated', function(e) {
        learningPlan = e.detail;
        // 查找当前进行的步骤索引
        currentStepIndex = learningPlan.plan.findIndex(step => step.status === '当前进行');
        // 更新UI
        updateLearningProgress();
    });
    
    // 监听当前任务更新事件
    window.addEventListener('currentTaskUpdated', function(e) {
        // 获取更新的任务步骤
        const updatedStep = e.detail;
        
        // 确保currentTaskTitle和currentTaskDesc与学习计划保持一致
        if (currentTaskTitle && updatedStep) {
            currentTaskTitle.textContent = updatedStep.title || '';
        }
        
        if (currentTaskDesc && updatedStep) {
            currentTaskDesc.textContent = updatedStep.description || '';
        }
        
        // 根据任务类型切换到合适的编辑区
        if (updatedStep) {
            determineTaskType(updatedStep);
        }
    });
    
    // 注意：提交按钮点击事件已移至learning-plan.js中统一处理
    // 这里不再添加重复的事件处理器
    
    /**
     * 更新学习进度UI
     */
    function updateLearningProgress() {
        if (!learningPlan || !learningPlan.plan || !learningPlan.plan.length) return;
        
        // 1. 更新学习计划节点状态
        if (learningTimelineElement) {
            const nodes = learningTimelineElement.querySelectorAll('.timeline-node');
            
            nodes.forEach((node, index) => {
                // 移除所有状态类
                node.classList.remove('completed', 'current');
                
                // 根据状态添加类
                if (index < currentStepIndex) {
                    node.classList.add('completed');
                } else if (index === currentStepIndex) {
                    node.classList.add('current');
                }
            });
        }
        
        // 2. 更新当前任务信息
        if (currentTaskTitle && currentTaskDesc) {
            const currentStep = learningPlan.plan[currentStepIndex];
            currentTaskTitle.textContent = currentStep.title || '';
            
            // 使用描述字段更新，确保与学习计划区域保持一致
            currentTaskDesc.textContent = currentStep.description || '';
            
            // 3. 根据任务类型自动切换到合适的编辑区
            determineTaskType(currentStep);
        }
    }
    
    /**
     * 根据任务类型自动切换到合适的编辑区
     * @param {Object} step - 当前步骤对象
     */
    function determineTaskType(step) {
        // 移除默认切换到代码编辑器的逻辑。
        // 标签页的切换现在由 learning-plan.js 中的 showQuizQuestions 和 showCodingTask 函数处理。
        console.log('determineTaskType: 标签页切换逻辑已移至显示函数中处理，此处不再切换。');
        // 可以在这里添加基于 description 或未来可能的 step.type 的类型判断逻辑，
        // 但不应直接调用 activateTabButton。
        
        // // 默认使用代码编辑区 (此行已注释掉)
        // activateTabButton(codeTabBtn);
    }
    
    /**
     * 激活指定的标签页按钮
     * @param {HTMLElement} tabButton - 要激活的标签页按钮
     */
    function activateTabButton(tabButton) {
        if (!tabButton) return;
        
        // 模拟点击事件
        tabButton.click();
    }
    
    /**
     * 渲染选择/填空题内容
     * @param {Object} step - 当前步骤对象
     */
    function renderQuizContent(step) {
        if (!quizQuestion || !quizOptions) return;
        
        // 清空现有内容
        quizQuestion.innerHTML = '';
        quizOptions.innerHTML = '';
        
        // 添加题目内容
        const questionEl = document.createElement('p');
        questionEl.textContent = step.task;
        quizQuestion.appendChild(questionEl);
        
        // 检测并创建选项（如果是选择题）
        const optionsMatch = step.task.match(/[A-Z]\..*?(?=[A-Z]\.|$)/g);
        
        if (optionsMatch && optionsMatch.length > 0) {
            // 选择题模式
            optionsMatch.forEach(option => {
                const optionEl = document.createElement('div');
                optionEl.className = 'quiz-option';
                
                const optionLetter = option.charAt(0);
                
                optionEl.innerHTML = `
                    <input type="radio" name="quizOption" value="${optionLetter}" class="quiz-option-input">
                    <span>${option.trim()}</span>
                `;
                
                // 添加点击事件
                optionEl.addEventListener('click', function() {
                    // 移除其他选项的选中状态
                    document.querySelectorAll('.quiz-option').forEach(el => {
                        el.classList.remove('selected');
                    });
                    
                    // 选中当前选项
                    this.classList.add('selected');
                    this.querySelector('input').checked = true;
                });
                
                quizOptions.appendChild(optionEl);
            });
        } else {
            // 填空题模式
            const inputEl = document.createElement('input');
            inputEl.type = 'text';
            inputEl.className = 'quiz-input-field';
            inputEl.placeholder = '请在此处输入你的答案...';
            quizOptions.appendChild(inputEl);
        }
    }
    
    /**
     * 判断是否为代码类型任务
     * @param {string} task - 任务内容
     * @returns {boolean} - 是否为代码类型任务
     */
    function isCodeTask(task) {
        // 包含代码相关关键词
        const codeKeywords = [
            'def ', 'function', 'class', 'import', 'return', 'for', 'while', 
            '编写函数', '实现算法', '编程实现', '编写代码', '编程题'
        ];
        
        return codeKeywords.some(keyword => task.includes(keyword));
    }
    
    /**
     * 判断是否为网页类型任务
     * @param {string} task - 任务内容
     * @returns {boolean} - 是否为网页类型任务
     */
    function isWebTask(task) {
        // 1. 检查任务中是否包含URL
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const containsURL = urlRegex.test(task);
        
        // 2. 包含网页浏览相关关键词
        const webKeywords = [
            'URL', '网页', '浏览', '访问网站', '打开链接', 
            '网站', '打开页面', '查看网页', '浏览器'
        ];
        const containsWebKeywords = webKeywords.some(keyword => 
            task.toLowerCase().includes(keyword.toLowerCase())
        );
        
        return containsURL || containsWebKeywords;
    }
    
    /**
     * 加载网页任务的URL
     * @param {string} task - 任务内容
     */
    function loadTaskURL(task) {
        // 查找任务中的URL
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urls = task.match(urlRegex);
        
        // 获取网页浏览器元素
        const urlInput = document.getElementById('urlInput');
        const webBrowser = document.getElementById('webBrowser');
        
        if (urls && urls.length > 0 && urlInput && webBrowser) {
            // 取第一个URL进行加载
            const url = urls[0];
            
            // 更新URL输入框
            urlInput.value = url;
            
            // 加载URL到iframe
            try {
                webBrowser.src = url;
                console.log('任务URL已加载: ' + url);
            } catch (error) {
                console.error('加载任务URL错误: ' + error);
            }
        } else if (urlInput) {
            // 如果任务中没有显式URL，但包含网页相关关键词，使用默认URL
            urlInput.value = 'https://www.example.com';
            
            // 尝试从任务描述中提取可能的域名
            const domainMatch = task.match(/([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)/);
            if (domainMatch && domainMatch[0].includes('.')) {
                urlInput.value = 'https://' + domainMatch[0];
            }
            
            // 不自动加载，等用户点击加载按钮
        }
    }
    
    /**
     * 显示通知消息
     */
    function showNotification(message, type = 'info') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        // 添加到页面
        document.body.appendChild(notification);
        
        // 显示通知
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // 自动移除
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 500);
        }, 3000);
    }
}); 