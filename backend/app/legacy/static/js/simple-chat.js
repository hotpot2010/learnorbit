// 简单聊天功能
console.log('simple-chat.js 加载完成');

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM加载完成，初始化简单聊天功能');
    
    // 获取元素
    const chatButton = document.getElementById('sendChatMessage');
    const chatInput = document.getElementById('chatInput');
    const chatHistory = document.getElementById('chatHistory');
    
    // 检查元素是否存在
    if (!chatButton || !chatInput || !chatHistory) {
        console.error('无法找到聊天组件:', { 
            chatButton: !!chatButton, 
            chatInput: !!chatInput, 
            chatHistory: !!chatHistory 
        });
        return;
    }
    
    console.log('聊天组件已找到，绑定事件');
    
    // 发送按钮点击事件
    chatButton.addEventListener('click', sendMessage);
    
    // 输入框回车事件
    chatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // 发送消息函数
    async function sendMessage() {
        const messageText = chatInput.value.trim();
        if (!messageText) return;
        
        console.log('发送消息:', messageText);
        
        // 创建用户消息元素
        const userMessage = document.createElement('div');
        userMessage.className = 'message user';
        userMessage.textContent = messageText;
        
        // 添加到聊天历史
        chatHistory.appendChild(userMessage);
        
        // 清空输入框
        chatInput.value = '';
        
        // 禁用输入控件
        chatInput.disabled = true;
        chatButton.disabled = true;
        
        // 创建AI消息元素
        const aiMessage = document.createElement('div');
        aiMessage.className = 'message ai';
        aiMessage.textContent = ''; // 初始为空
        
        // 添加到聊天历史
        chatHistory.appendChild(aiMessage);
        chatHistory.scrollTop = chatHistory.scrollHeight;
        
        try {
            // 调用真实API
            console.log('调用API: /api/chat/stream');
            const response = await fetch('/api/chat/stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream'
                },
                body: JSON.stringify({ message: messageText })
            });
            
            // 检查响应状态
            if (!response.ok) {
                throw new Error('API响应错误: ' + response.status);
            }
            
            // 处理流式响应
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let accumulatedResponse = ''; // To store the full response for Markdown parsing
            
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) {
                    console.log('流式响应完成');
                    break;
                }
                
                // 解码收到的数据
                buffer += decoder.decode(value, { stream: true });
                let lines = buffer.split('\n');
                buffer = lines.pop() || '';
                
                // 处理每一行
                for (const line of lines) {
                    if (line.trim() === '' || !line.startsWith('data:')) continue;
                    
                    try {
                        // 解析SSE数据格式
                        const jsonData = line.substring(5).trim();
                        const data = JSON.parse(jsonData);
                        
                        // 处理不同类型的响应
                        if (data.chunk) {
                            // 添加响应块到消息
                            accumulatedResponse += data.chunk;
                            aiMessage.innerHTML = marked.parse(accumulatedResponse);
                            chatHistory.scrollTop = chatHistory.scrollHeight;
                        } else if (data.error) {
                            // 显示错误信息
                            console.error('API返回错误:', data.error);
                            const errorNode = document.createElement('p');
                            errorNode.className = 'error-message';
                            errorNode.textContent = '\n[错误: ' + data.error + ']';
                            aiMessage.appendChild(errorNode);
                            aiMessage.classList.add('error');
                            chatHistory.scrollTop = chatHistory.scrollHeight;
                        } else if (data.done) {
                            // 流结束标记
                            console.log('收到完成标记');
                        }
                    } catch (e) {
                        console.error('解析响应数据出错:', e, line);
                    }
                }
            }
            
        } catch (error) {
            // 处理网络错误
            console.error('API调用出错:', error);
            aiMessage.textContent = `[错误: ${error.message}]`;
            aiMessage.classList.add('error');
            chatHistory.scrollTop = chatHistory.scrollHeight;
        } finally {
            // 重新启用输入控件
            chatInput.disabled = false;
            chatButton.disabled = false;
            chatInput.focus();
        }
    }
    
    // 在页面上显示状态指示
    const statusIndicator = document.createElement('div');
    statusIndicator.textContent = '简单聊天功能已加载 (使用真实API)';
    statusIndicator.style.position = 'fixed';
    statusIndicator.style.bottom = '40px';
    statusIndicator.style.right = '10px';
    statusIndicator.style.backgroundColor = 'rgba(0,0,0,0.6)';
    statusIndicator.style.color = 'white';
    statusIndicator.style.padding = '5px 10px';
    statusIndicator.style.borderRadius = '3px';
    statusIndicator.style.fontSize = '12px';
    statusIndicator.style.zIndex = 9999;
    document.body.appendChild(statusIndicator);
    
    // 几秒后淡出
    setTimeout(function() {
        statusIndicator.style.transition = 'opacity 1s';
        statusIndicator.style.opacity = 0;
        setTimeout(function() {
            statusIndicator.remove();
        }, 1000);
    }, 3000);
}); 