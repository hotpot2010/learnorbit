/**
 * 任务交互增强模块
 * 提供任务生成、展示和交互相关功能
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('任务交互模块初始化');

    // 获取DOM元素
    // const submitTaskBtn = document.getElementById('submitTaskBtn'); // 不再需要监听此按钮
    
    // 跟踪当前任务状态
    let currentTaskDataForEvaluation = null; // 新变量，存储包含答案的完整任务数据
    
    // 监听任务提交按钮 - 此监听器已移至 learning-plan.js，此处移除或注释掉
    /*
    if (submitTaskBtn) {
        submitTaskBtn.addEventListener('click', function() {
            if (currentTaskDataForEvaluation) {
                evaluateTask(currentTaskDataForEvaluation); // evaluateTask 也将不再需要
            } else {
                showNotification('没有活动的任务可提交', 'warning');
            }
        });
    }
    */
    
    // 监听当前任务更新事件
    window.addEventListener('currentTaskUpdated', function(e) {
        const taskStep = e.detail;
        if (taskStep) {
            updateTaskStatus('准备中...', 'generating'); // 状态: 生成中
            currentTaskDataForEvaluation = null; // 重置任务数据，等待新任务生成
        }
    });
    
    // 监听生成的任务数据
    window.addEventListener('taskGenerated', function(e) {
        currentTaskDataForEvaluation = e.detail; // 存储包含答案的完整数据
        console.log('接收到新任务数据 (包含答案):', currentTaskDataForEvaluation);
        updateTaskStatus('已准备好', 'ready'); // 状态: 已就绪
    });
    
    /**
     * 评估用户完成的任务
     * @param {Object} task - 当前任务数据
     */
    /*
    function evaluateTask(task) { ... }
    */
    
    /**
     * 评估测验题回答
     * @param {Object} task - 测验任务数据
     */
    /*
    function evaluateQuiz(task) { ... }
    */
    
    /**
     * 评估代码任务
     * @param {Object} task - 代码任务数据
     */
    /*
    function evaluateCode(task) { ... }
    */
    
    /**
     * 更新任务状态指示器
     * @param {string} statusText - 状态文本
     * @param {string} statusType - 状态类型 ('info', 'generating', 'ready', 'error')
     */
    function updateTaskStatus(statusText, statusType = 'info') {
        const tabsContainer = document.querySelector('.workspace-tabs');
        if (!tabsContainer) {
            console.error("未找到 .workspace-tabs 容器无法放置状态指示器");
            return;
        }
        
        let statusIndicator = tabsContainer.querySelector('.task-status-indicator');
        
        if (!statusIndicator) {
            // 如果不存在，则创建一个新的
            statusIndicator = document.createElement('span'); 
            statusIndicator.className = 'task-status-indicator';
            tabsContainer.appendChild(statusIndicator); // 追加到 tabs 容器末尾
        }
        
        // 更新文本
        statusIndicator.textContent = statusText; 
        
        // 移除所有可能的状态类
        statusIndicator.classList.remove('info', 'generating', 'ready', 'error');
        
        // 添加当前状态类
        statusIndicator.classList.add(statusType);
    }
    
    /**
     * 将任务生成的数据通过事件通知本模块
     * @param {Object} taskData - 任务数据
     */
    window.notifyTaskGenerated = function(taskData) {
        const event = new CustomEvent('taskGenerated', {
            detail: taskData // 发送包含答案的完整数据
        });
        window.dispatchEvent(event);
    };

    /**
     * 暴露获取当前任务数据的函数给 learning-plan.js 使用
     */
    window.getCurrentInteractionTask = function() {
        return currentTaskDataForEvaluation;
    };
}); 