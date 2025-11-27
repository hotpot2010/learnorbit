/**
 * 课程对话页面JavaScript功能
 */

class CourseChatApp {
    constructor() {
        this.conversationHistory = [];
        this.finalLearningGoal = '';
        this.courseDetails = {};
        this.isGeneratingResponse = false;
        this.conversationPhase = 'initial'; // initial, clarifying, ready
        this.hasChatStarted = false; // 追踪对话是否已开始
        
        this.initializeElements();
        this.initializeEventListeners();
        this.setupAutoResize();
        // this.loadCourseRecommendations(); // 注释掉，使用静态推荐课程
    }

    initializeElements() {
        // DOM元素
        this.chatContainer = document.getElementById('chatContainer');
        this.welcomeSection = document.getElementById('welcomeSection');
        this.chatMessages = document.getElementById('chatMessages');
        this.chatInput = document.getElementById('chatInput');
        this.sendButton = document.getElementById('sendButton');
        this.actionContainer = document.getElementById('actionContainer');
        this.generateCourseBtn = document.getElementById('generateCourseBtn');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        
        // Course recommendations elements
        this.courseRecommendations = document.getElementById('courseRecommendations');
        this.courseRecommendationList = document.getElementById('courseRecommendationList');
        
        // Modal元素
        this.courseSummaryModal = document.getElementById('courseSummaryModal');
        this.courseSummary = document.getElementById('courseSummary');
        this.modalCloseBtn = document.getElementById('modalCloseBtn');
        this.editCourseBtn = document.getElementById('editCourseBtn');
        this.confirmCourseBtn = document.getElementById('confirmCourseBtn');
        
        // Topic cards
        this.topicCards = document.querySelectorAll('.topic-card');
    }

    initializeEventListeners() {
        // 发送消息按钮
        this.sendButton.addEventListener('click', () => this.handleSendMessage());
        
        // 输入框回车发送
        this.chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSendMessage();
            }
        });
        
        // 输入框内容变化
        this.chatInput.addEventListener('input', () => this.updateSendButton());
        
        // Topic cards点击
        this.topicCards.forEach(card => {
            card.addEventListener('click', () => {
                const topic = card.getAttribute('data-topic');
                this.selectTopic(topic);
            });
        });
        
        // Course recommendation items点击 (左侧面板)
        document.addEventListener('click', (e) => {
            const recItem = e.target.closest('.course-recommendation-item');
            if (recItem) {
                const topic = recItem.getAttribute('data-topic');
                if (topic) {
                    this.selectTopic(topic);
                }
            }
        });
        
        // 生成课程按钮
        this.generateCourseBtn.addEventListener('click', () => this.handleGenerateCourse());
        
        // Modal相关
        this.modalCloseBtn.addEventListener('click', () => this.closeModal());
        this.editCourseBtn.addEventListener('click', () => this.editCourse());
        this.confirmCourseBtn.addEventListener('click', () => this.confirmCourse());
        
        // 点击modal背景关闭
        this.courseSummaryModal.addEventListener('click', (e) => {
            if (e.target === this.courseSummaryModal) {
                this.closeModal();
            }
        });
    }

    setupAutoResize() {
        // 自动调整textarea高度
        this.chatInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
        });
    }

    updateSendButton() {
        const hasContent = this.chatInput.value.trim().length > 0;
        this.sendButton.disabled = !hasContent || this.isGeneratingResponse;
    }

    selectTopic(topic) {
        this.chatInput.value = topic;
        this.updateSendButton();
        this.handleSendMessage();
    }

    async handleSendMessage() {
        const message = this.chatInput.value.trim();
        if (!message || this.isGeneratingResponse) return;

        // 第一次对话时切换到分屏模式
        if (!this.hasChatStarted) {
            this.enableSplitMode();
            this.hasChatStarted = true;
        }

        // 添加用户消息
        this.addMessage(message, 'user');
        this.chatInput.value = '';
        this.updateSendButton();

        // 显示正在输入状态
        this.isGeneratingResponse = true;
        this.showTypingIndicator();

        try {
            // 调用AI生成回复
            const response = await this.generateAIResponse(message);
            this.hideTypingIndicator();
            this.addMessage(response, 'ai');
            
            // 更新对话历史
            this.conversationHistory.push(
                { role: 'user', content: message },
                { role: 'assistant', content: response }
            );

            // 检查是否可以生成课程
            this.checkIfReadyToGenerate();

        } catch (error) {
            console.error('生成AI回复失败:', error);
            this.hideTypingIndicator();
            this.addMessage('抱歉，我现在无法回复。请稍后再试。', 'ai');
        } finally {
            this.isGeneratingResponse = false;
            this.updateSendButton();
        }
    }

    // 启用分屏模式
    enableSplitMode() {
        this.chatContainer.classList.add('split-mode');
        
        // 调整body样式以适应全屏布局
        document.body.style.padding = '0';
        document.body.style.height = '100vh';
        document.body.style.overflow = 'hidden';
        
        // 隐藏欢迎区域，显示聊天区域
        this.welcomeSection.style.display = 'none';
        this.chatMessages.classList.add('active');
        
        // 确保左侧推荐课程可见
        this.courseRecommendations.style.display = 'block';
    }

    // 加载课程推荐
    async loadCourseRecommendations() {
        try {
            const response = await fetch('/api/courses/list');
            const data = await response.json();
            
            if (data.success && data.courses) {
                this.displayCourseRecommendations(data.courses);
            }
        } catch (error) {
            console.error('加载课程推荐失败:', error);
        }
    }

    // 显示课程推荐
    displayCourseRecommendations(courses) {
        this.courseRecommendationList.innerHTML = '';
        
        // 限制显示最多6个推荐课程
        const recommendedCourses = courses.slice(0, 6);
        
        recommendedCourses.forEach(course => {
            const courseItem = document.createElement('div');
            courseItem.className = 'course-recommendation-item';
            courseItem.setAttribute('data-course-id', course.id);
            
            const iconMap = {
                'ai': 'psychology',
                'programming': 'code',
                'ml': 'analytics',
                'algorithm': 'functions',
                'default': 'school'
            };
            
            const icon = iconMap[course.type] || iconMap['default'];
            
            courseItem.innerHTML = `
                <div class="course-rec-header">
                    <span class="material-icons-outlined course-rec-icon">${icon}</span>
                    <div class="course-rec-title">${course.title}</div>
                </div>
                <div class="course-rec-description">${course.description}</div>
                <div class="course-rec-stats">
                    <div class="course-rec-stat">
                        <span class="material-icons-outlined">schedule</span>
                        ${course.duration}
                    </div>
                    <div class="course-rec-stat">
                        <span class="material-icons-outlined">bar_chart</span>
                        ${course.difficulty}
                    </div>
                    <div class="course-rec-stat">
                        <span class="material-icons-outlined">list</span>
                        ${course.steps}步
                    </div>
                </div>
            `;
            
            // 添加点击事件
            courseItem.addEventListener('click', () => {
                this.selectCourseRecommendation(course);
            });
            
            this.courseRecommendationList.appendChild(courseItem);
        });
    }

    // 选择课程推荐
    selectCourseRecommendation(course) {
        // 将课程信息填入对话
        const courseMessage = `我想学习${course.title}，${course.description}`;
        this.chatInput.value = courseMessage;
        this.updateSendButton();
        
        // 高亮选中的课程
        document.querySelectorAll('.course-recommendation-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        const selectedItem = document.querySelector(`[data-course-id="${course.id}"]`);
        if (selectedItem) {
            selectedItem.classList.add('selected');
        }
        
        // 自动发送消息
        if (!this.isGeneratingResponse) {
            this.handleSendMessage();
        }
    }

    addMessage(content, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.innerHTML = `<span class="material-icons-outlined">
            ${type === 'user' ? 'person' : 'smart_toy'}
        </span>`;
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.textContent = content;
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(messageContent);
        
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    showTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message ai typing-indicator';
        typingDiv.innerHTML = `
            <div class="message-avatar">
                <span class="material-icons-outlined">smart_toy</span>
            </div>
            <div class="message-content">
                <div class="typing-dots">
                    <span></span><span></span><span></span>
                </div>
            </div>
        `;
        
        this.chatMessages.appendChild(typingDiv);
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        const typingIndicator = this.chatMessages.querySelector('.typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    async generateAIResponse(userMessage) {
        // 构建对话上下文
        const messages = [
            {
                role: 'system',
                content: `你是一个专业的学习顾问AI助手。你的任务是通过对话了解用户的学习需求，包括：
1. 学习目标和兴趣领域
2. 当前技能水平
3. 期望的学习时长
4. 学习方式偏好
5. 具体想要掌握的技能

请通过自然的对话方式获取这些信息，不要一次性问太多问题。根据用户的回答，逐步深入了解细节。
当你认为已经充分了解用户需求时，请在回复末尾加上："[READY_TO_GENERATE]"标记。

请保持对话自然、友好，给出具体的引导性问题。`
            },
            ...this.conversationHistory,
            { role: 'user', content: userMessage }
        ];

        const response = await fetch('/api/chat/stream', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: userMessage,
                conversation_history: this.conversationHistory
            })
        });

        if (!response.ok) {
            throw new Error('Failed to get AI response');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let result = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.chunk) {
                            result += data.chunk;
                        }
                        if (data.done) {
                            return result;
                        }
                    } catch (e) {
                        // 忽略解析错误
                    }
                }
            }
        }

        return result;
    }

    checkIfReadyToGenerate() {
        // 检查最后的AI回复是否包含准备生成的标记
        const lastAIMessage = this.conversationHistory[this.conversationHistory.length - 1];
        if (lastAIMessage && lastAIMessage.role === 'assistant' && 
            lastAIMessage.content.includes('[READY_TO_GENERATE]')) {
            
            // 清理标记并更新消息
            lastAIMessage.content = lastAIMessage.content.replace('[READY_TO_GENERATE]', '').trim();
            
            // 更新UI显示的最后一条消息
            const lastMessageElement = this.chatMessages.lastElementChild;
            if (lastMessageElement && lastMessageElement.classList.contains('ai')) {
                const messageContent = lastMessageElement.querySelector('.message-content');
                if (messageContent) {
                    messageContent.textContent = lastAIMessage.content;
                }
            }
            
            // 显示生成课程按钮
            this.showGenerateCourseButton();
        }
    }

    showGenerateCourseButton() {
        this.actionContainer.style.display = 'block';
        this.actionContainer.scrollIntoView({ behavior: 'smooth' });
    }

    async handleGenerateCourse() {
        // 提取学习目标
        this.extractLearningGoal();
        
        // 显示加载状态
        this.showLoading();
        
        try {
            // 生成课程摘要
            await this.generateCourseSummary();
            
            // 显示课程摘要模态框
            this.showCourseSummary();
            
        } catch (error) {
            console.error('生成课程摘要失败:', error);
            alert('生成课程时出错，请稍后重试。');
        } finally {
            this.hideLoading();
        }
    }

    extractLearningGoal() {
        // 从对话历史中提取学习目标
        const conversation = this.conversationHistory.map(msg => 
            `${msg.role === 'user' ? '用户' : 'AI'}: ${msg.content}`
        ).join('\n');
        
        this.finalLearningGoal = conversation;
    }

    async generateCourseSummary() {
        const summaryResponse = await fetch('/api/course/summary', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                conversation_history: this.conversationHistory
            })
        });

        if (summaryResponse.ok) {
            this.courseDetails = await summaryResponse.json();
        } else {
            // 使用默认摘要
            this.courseDetails = {
                title: '个性化学习计划',
                description: '基于您的需求定制的学习计划',
                duration: '预计 4-6 周',
                difficulty: '根据您的水平调整',
                topics: [
                    '基础概念理解',
                    '核心技能掌握',
                    '实践项目练习',
                    '高级应用拓展'
                ]
            };
        }
    }

    showCourseSummary() {
        // 填充课程摘要内容
        this.courseSummary.innerHTML = `
            <h4>${this.courseDetails.title || '个性化学习计划'}</h4>
            <p><strong>课程描述：</strong>${this.courseDetails.description || '基于您的对话需求定制的专属学习计划'}</p>
            <p><strong>预计时长：</strong>${this.courseDetails.duration || '4-6 周'}</p>
            <p><strong>难度等级：</strong>${this.courseDetails.difficulty || '适中'}</p>
            <h4>学习内容：</h4>
            <ul>
                ${(this.courseDetails.topics || [
                    '基础知识梳理',
                    '核心技能训练', 
                    '项目实战演练',
                    '进阶应用拓展'
                ]).map(topic => `<li>${topic}</li>`).join('')}
            </ul>
        `;
        
        this.courseSummaryModal.style.display = 'flex';
    }

    closeModal() {
        this.courseSummaryModal.style.display = 'none';
    }

    editCourse() {
        this.closeModal();
        // 可以添加修改课程的逻辑
    }

    confirmCourse() {
        // 跳转到学习平台主页面
        const learningGoal = this.conversationHistory
            .filter(msg => msg.role === 'user')
            .map(msg => msg.content)
            .join(' ');
            
        // 将学习目标存储到sessionStorage，供主页面使用
        sessionStorage.setItem('learningGoal', learningGoal);
        sessionStorage.setItem('courseDetails', JSON.stringify(this.courseDetails));
        
        // 跳转到主学习页面
        window.location.href = '/learning';
    }

    showLoading() {
        this.loadingOverlay.style.display = 'flex';
    }

    hideLoading() {
        this.loadingOverlay.style.display = 'none';
    }
}

// 添加打字机效果的CSS
const typingCSS = `
.typing-dots {
    display: flex;
    align-items: center;
    gap: 4px;
}

.typing-dots span {
    width: 8px;
    height: 8px;
    background: #757575;
    border-radius: 50%;
    animation: typingBounce 1.4s infinite ease-in-out both;
}

.typing-dots span:nth-child(1) { animation-delay: -0.32s; }
.typing-dots span:nth-child(2) { animation-delay: -0.16s; }

@keyframes typingBounce {
    0%, 80%, 100% {
        transform: scale(0.8);
        opacity: 0.5;
    }
    40% {
        transform: scale(1);
        opacity: 1;
    }
}

.course-recommendation-item.selected {
    border-color: var(--cognitive-gray);
    background: var(--bg-light);
    box-shadow: 0 4px 12px var(--shadow-color);
}
`;

// 注入打字机效果CSS
const style = document.createElement('style');
style.textContent = typingCSS;
document.head.appendChild(style);

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new CourseChatApp();
}); 