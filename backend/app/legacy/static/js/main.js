// 主要的JavaScript文件
console.log('main.js 开始加载');

// 全局变量声明
let codeEditor;

// DOM加载完成后执行初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM内容加载完成 - 开始初始化');
    
    // Initialize CodeMirror
    const codeEditorContainer = document.getElementById('codeEditorContainer');
    if (codeEditorContainer) {
        codeEditor = CodeMirror(codeEditorContainer, {
            mode: 'python',
            theme: 'material-darker', // Match CSS theme
            lineNumbers: true,
            autoCloseBrackets: true,
            indentUnit: 4,
            tabSize: 4,
            lineWrapping: true,
            value: '# Start coding here...\nprint("Hello, AI Tutor!")'
        });
        // Ensure editor fits container
        codeEditor.setSize('100%', '100%'); 
        
        // Refresh editor if container resizes (e.g., window resize)
         window.addEventListener('resize', () => {
            setTimeout(() => codeEditor.refresh(), 100);
         });
    } else {
        console.error("Code editor container not found.");
    }

    // 初始化标签页切换功能
    initTabs();
    
    // 初始化聊天功能
    initChatFunctionality();
    
    console.log('AI学习平台界面初始化完成');
});

// 初始化标签页切换功能
function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    console.log('初始化标签页:', tabButtons.length);
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab;
            console.log('点击标签页:', targetTab);
            
            // 更新按钮状态
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // 更新内容可见性
            tabContents.forEach(content => {
                if (content.id === `${targetTab}Tab`) {
                    content.classList.add('active');
                    // 如果是代码标签页，刷新CodeMirror
                    if (targetTab === 'code' && codeEditor) {
                        setTimeout(() => codeEditor.refresh(), 10);
                    }
                } else {
                    content.classList.remove('active');
                }
            });
        });
    });
}

// 初始化聊天功能
function initChatFunctionality() {
    console.log('开始初始化聊天功能');
    
    // 获取DOM元素
    const chatInput = document.getElementById('chatInput');
    const sendChatButton = document.getElementById('sendChatMessage');
    const chatHistory = document.getElementById('chatHistory');
    
    // 检查元素是否存在
    console.log('聊天元素:', { 
        chatInput: chatInput ? '已找到' : '未找到', 
        sendChatButton: sendChatButton ? '已找到' : '未找到', 
        chatHistory: chatHistory ? '已找到' : '未找到' 
    });
    
    if (!chatInput || !sendChatButton || !chatHistory) {
        console.error('聊天元素未找到，无法初始化聊天功能');
        return;
    }
    
    // 创建消息元素函数
    function createMessageElement(message, type) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');
        
        if (type === 'user') {
            messageDiv.classList.add('user');
        } else if (type === 'ai') {
            messageDiv.classList.add('ai');
        } else if (type === 'ai-error') {
            messageDiv.classList.add('ai');
            messageDiv.classList.add('error');
        }
        
        messageDiv.textContent = message;
        chatHistory.appendChild(messageDiv);
        chatHistory.scrollTop = chatHistory.scrollHeight;
        return messageDiv;
    }
    
    // 重新启用控件函数
    function reEnableControls() {
        console.log('重新启用聊天输入控件');
        chatInput.disabled = false;
        sendChatButton.disabled = false;
        chatInput.focus();
    }
    
    // 添加消息到聊天历史（供其他函数调用）
    window.addMessage = function(message, type) {
        return createMessageElement(message, type);
    };
    
    // 发送消息函数
    async function sendMessage() {
        const message = chatInput.value.trim();
        if (!message) return;
        
        console.log('发送消息:', message);
        
        // 添加用户消息气泡
        createMessageElement(message, 'user');
        
        // 清空输入框并禁用控件
        chatInput.value = '';
        chatInput.disabled = true;
        sendChatButton.disabled = true;
        
        // 创建空的AI消息气泡
        const aiMessageDiv = createMessageElement('', 'ai');
        
        try {
            console.log('调用API: /api/chat/stream');
            const response = await fetch('/api/chat/stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream'
                },
                body: JSON.stringify({ message: message })
            });
            
            console.log('API响应状态:', response.status);
            
            // 处理错误
            if (!response.ok) {
                const errorText = await response.text();
                console.error('API错误:', errorText);
                aiMessageDiv.textContent = `[错误: ${response.status}]`;
                aiMessageDiv.classList.add('error');
                reEnableControls();
                return;
            }
            
            // 处理流式响应
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) {
                    console.log('流式响应结束');
                    break;
                }
                
                buffer += decoder.decode(value, { stream: true });
                let lines = buffer.split('\n');
                buffer = lines.pop() || '';
                
                for (const line of lines) {
                    if (line.trim() === '' || !line.startsWith('data:')) continue;
                    
                    try {
                        const jsonData = line.substring(5).trim();
                        const data = JSON.parse(jsonData);
                        
                        if (data.chunk) {
                            aiMessageDiv.textContent += data.chunk;
                            chatHistory.scrollTop = chatHistory.scrollHeight;
                        } else if (data.error) {
                            aiMessageDiv.textContent += `\n[错误: ${data.error}]`;
                            aiMessageDiv.classList.add('error');
                            chatHistory.scrollTop = chatHistory.scrollHeight;
                        }
                    } catch (e) {
                        console.error('解析SSE数据错误:', e);
                    }
                }
            }
            
        } catch (error) {
            console.error('网络错误:', error);
            aiMessageDiv.textContent = `[网络错误: ${error.message}]`;
            aiMessageDiv.classList.add('error');
        } finally {
            reEnableControls();
        }
    }
    
    // 绑定事件监听器
    console.log('绑定聊天按钮事件');
    
    // 按钮点击事件
    sendChatButton.addEventListener('click', function() {
        console.log('发送按钮被点击');
        sendMessage();
    });
    
    // 输入框回车事件
    chatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            console.log('按下回车键发送');
            e.preventDefault();
            sendMessage();
        }
    });
    
    console.log('聊天功能初始化完成');
}

// 运行代码
function runCode() {
    if (!codeEditor) {
        console.error('代码编辑器未初始化，无法运行代码');
        return;
    }
    
    const code = codeEditor.getValue();
    console.log('运行代码:', code.substring(0, 50) + '...');
    
    // 目前仅显示提示
    alert('代码运行功能尚未实现');
    
    // 未来实现代码运行功能的占位符
    /*
    fetch('/run-code', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code: code })
    })
    .then(response => response.json())
    .then(data => {
        if (window.addMessage) {
            window.addMessage('代码输出:\n' + data.output, 'ai');
        }
    })
    .catch(error => {
        console.error('错误:', error);
        if (window.addMessage) {
            window.addMessage('运行代码时出错。', 'ai-error');
        }
    });
    */
}

// 提交解决方案
function submitSolution() {
    if (!codeEditor) {
        console.error('代码编辑器未初始化，无法提交解决方案');
        return;
    }
    
    const code = codeEditor.getValue();
    const exercise = document.getElementById('exerciseSelect')?.value;
    
    if (!exercise) {
        alert('请先选择一个练习！');
        return;
    }
    
    console.log('提交解决方案:', { exercise, codeLength: code.length });
    
    // 目前仅显示提示
    alert('提交解决方案功能尚未实现');
    
    // 未来实现提交解决方案功能的占位符
    /*
    fetch('/submit-solution', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            code: code,
            exercise: exercise
        })
    })
    .then(response => response.json())
    .then(data => {
        if (window.addMessage) {
            window.addMessage(data.feedback, 'ai');
        }
    })
    .catch(error => {
        console.error('错误:', error);
        if (window.addMessage) {
            window.addMessage('提交解决方案时出错。', 'ai-error');
        }
    });
    */
}

// Function to display suggested questions
function displaySuggestedQuestions(questions, contextType = 'new_task') {
    const container = document.getElementById('suggestedQuestionsContainer');
    const listElement = container?.querySelector('.suggested-questions-list');
    const chatInput = document.getElementById('chatInput');
    const titleElement = container?.querySelector('.suggested-questions-title');

    if (!container || !listElement || !chatInput || !titleElement) {
        console.error("Cannot display suggested questions: Missing required elements.");
        return;
    }

    // Clear previous suggestions
    listElement.innerHTML = '';

    // Update style and title based on context
    if (contextType === 'error_correction') {
        container.classList.add('error-context');
        titleElement.textContent = '💡 针对您的错误，可以尝试问：';
    } else { // 'new_task' or default
        container.classList.remove('error-context');
        titleElement.textContent = '💡 推荐问题：';
    }

    if (questions && questions.length > 0) {
        questions.forEach(q => {
            const button = document.createElement('button');
            button.className = 'suggested-question';
            button.textContent = q;
            button.addEventListener('click', () => {
                chatInput.value = q; 
                chatInput.focus(); 
                // container.style.display = 'none'; // Optionally hide after click
            });
            listElement.appendChild(button);
        });
        container.style.display = 'block'; // Show the container
    } else {
        container.style.display = 'none'; // Hide if no questions
    }
}

// Make the function globally accessible (or use a more structured approach like modules/events)
window.displaySuggestedQuestions = displaySuggestedQuestions;

// Add CSS for the temporary streaming class if needed
// .message.ai-stream {}
// .message.thinking {}
// .message.error {}
// .message.placeholder { font-style: italic; color: var(--text-secondary); }
// .message.error { background-color: #fdd; color: #a00; border: 1px solid #fbb; }

// Function to update the radar chart
function updateRadarChart() {
    const scores = window.getCurrentAbilityScores ? window.getCurrentAbilityScores() : null;
    console.log("Attempting to update radar chart with current scores:", scores);
    
    if (!scores) {
        console.error("Could not get current ability scores (window.getCurrentAbilityScores() failed or missing).");
        return;
    }
    if (!window.radarChartInstance) {
        console.error("Radar chart instance (window.radarChartInstance) not found.");
        return;
    }

    const chartLabels = [
        'theoretical_knowledge', 
        'practical_ability', 
        'problem_solving', 
        'algorithm_optimization', 
        'programming_skills'
    ];

    // Data is already on 0-100 scale and cumulative
    const newChartData = chartLabels.map(labelKey => {
        const score = scores[labelKey];
        // Use the score directly, but ensure it's valid
        if (typeof score === 'number' && score >= 0 && score <= 100) {
            return score;
        } else {
            console.warn(`Invalid score for ${labelKey} (${score}), using default 10.`);
            return 10; // Default to baseline 10 if score is somehow invalid
        }
    });

    console.log("Updating chart with data:", newChartData);

    // Update the chart data
    window.radarChartInstance.data.datasets[0].data = newChartData;
    
    // Refresh the chart
    window.radarChartInstance.update();
    console.log("Radar chart updated.");
}

// Make the function globally accessible
window.updateRadarChart = updateRadarChart;

// Initialize the radar chart instance (example, adjust as needed)
function initializeRadarChart() {
     console.log('正在初始化雷达图...');
     setTimeout(function() { // Use setTimeout as in index.html example
        try {
            const ctx = document.getElementById('skillRadarChart');
            if (!ctx) {
                console.error('雷达图容器未找到');
                return;
            }
            if (typeof Chart === 'undefined') {
                 console.error('Chart.js未加载');
                 return;
            }
             // Ensure the container is empty before creating canvas
             ctx.innerHTML = '';
             const canvas = document.createElement('canvas');
             // It's better to let Chart.js handle canvas size via options
             // canvas.width = ctx.clientWidth;
             // canvas.height = ctx.clientHeight;
             ctx.appendChild(canvas);
             
             // Store the chart instance globally
             window.radarChartInstance = new Chart(canvas, {
                type: 'radar',
                data: {
                    labels: ['理论知识', '实践能力', '问题解决', '算法优化', '编程技巧'], // Must match updateRadarChart order
                    datasets: [{
                        label: '能力水平',
                        data: [10, 10, 10, 10, 10], // Initial scores (10 maps to 100)
                        backgroundColor: 'rgba(66, 133, 244, 0.2)',
                        borderColor: 'rgba(66, 133, 244, 1)',
                        pointBackgroundColor: 'rgba(66, 133, 244, 1)',
                        pointBorderColor: '#fff',
                        pointHoverBackgroundColor: '#fff',
                        pointHoverBorderColor: 'rgba(66, 133, 244, 1)'
                    }]
                },
                 options: {
                     responsive: true,
                     maintainAspectRatio: false,
                     scales: {
                         r: {
                             angleLines: { display: true },
                             suggestedMin: 0,
                             suggestedMax: 100, // Max score is 100 now
                             ticks: {
                                 stepSize: 20,
                                 showLabelBackdrop: false,
                                 font: { size: 10 }
                             },
                             pointLabels: { font: { size: 12 } }
                         }
                     },
                     plugins: { legend: { display: false } }
                 }
             });
             console.log('雷达图创建成功并存储在 window.radarChartInstance');
        } catch (err) {
             console.error('创建雷达图时出错:', err);
        }
    }, 500); // Delay as in original code
}

// Ensure radar chart initialization is called after DOM is ready
document.addEventListener('DOMContentLoaded', initializeRadarChart); 