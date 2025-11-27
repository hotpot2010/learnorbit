/**
 * 学习计划生成和管理
 */
document.addEventListener('DOMContentLoaded', function() {
    // 检查是否从课程对话页面跳转而来
    checkForCourseTransfer();
    
    // 获取DOM元素
    const learningGoalInput = document.getElementById('learningGoal');
    const createPlanBtn = document.getElementById('createPlanBtn');
    const uploadBtn = document.getElementById('uploadBtn');
    const learningTimelineElement = document.querySelector('.learning-timeline');
    const submitTaskBtn = document.getElementById('submitTaskBtn');
    
    // 全局变量保存当前学习计划
    let currentPlanData = null;
    // 全局变量保存当前累积能力分数 (0-100 scale)
    let currentAbilityScores = {
        theoretical_knowledge: 10, 
        practical_ability: 10, 
        problem_solving: 10, 
        algorithm_optimization: 10, 
        programming_skills: 10
    };
    // 全局变量存储当前任务数据（用于评估）
    let currentTaskDataForEval = null;
    
    // 为学习目标输入框添加按键处理
    if (learningGoalInput) {
        learningGoalInput.addEventListener('keydown', function(event) {
            // 检查是否按下回车键且没有同时按下Shift键
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault(); // 阻止默认的换行行为
                
                // 模拟点击创建计划按钮
                if (createPlanBtn && !createPlanBtn.disabled) {
                    createPlanBtn.click();
                }
            }
            // 如果是Shift+回车，则允许默认行为（换行）
        });
    }
    
    // 添加创建计划按钮点击事件
    if (createPlanBtn) {
        createPlanBtn.addEventListener('click', function() {
            const learningGoal = learningGoalInput.value.trim();
            
            if (!learningGoal) {
                showNotification('请输入学习目标', 'error');
                return;
            }
            
            // !!! 重置分数 !!!
            resetAbilityScores(); 
            
            // 显示加载状态
            createPlanBtn.disabled = true;
            createPlanBtn.innerHTML = '<span class="material-icons-outlined btn-icon">hourglass_top</span> 生成中...';
            
            // 调用API生成学习计划
            generateLearningPlan(learningGoal);
        });
    }
    
    // 添加提交任务按钮点击事件
    if (submitTaskBtn) {
        submitTaskBtn.addEventListener('click', async function() {
            submitTaskBtn.disabled = true;
            submitTaskBtn.textContent = '评估中...';

            clearErrorHighlights();

            const currentActiveTask = getCurrentActiveTask();
            const currentLearningStep = getCurrentLearningStep();

            if (!currentActiveTask || !currentLearningStep) {
                showNotification('无法找到当前活动任务或学习步骤信息', 'error');
                submitTaskBtn.disabled = false;
                submitTaskBtn.textContent = '提交';
                return;
            }

            const taskType = currentActiveTask.type;
            const stepTitle = currentLearningStep.title;
            const stepDescription = currentLearningStep.description;
            let userSubmission = getUserSubmission(taskType, currentActiveTask);

            if (userSubmission === null) {
                showNotification('无法获取用户提交内容', 'error');
                submitTaskBtn.disabled = false;
                submitTaskBtn.textContent = '提交';
                return;
            }

            let evaluationCorrect = false;
            let primaryEvalResult = null;

            // 4. 调用后端主要评估API
            try {
                const response = await fetch('/api/task/evaluate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        task_type: taskType,
                        submission: userSubmission,
                        task_data: currentActiveTask
                    })
                });

                primaryEvalResult = await response.json();
                console.log('评估API 响应状态:', response.status);
                console.log('收到的原始评估结果 (JSON Parsed):', JSON.stringify(primaryEvalResult, null, 2));

                if (!response.ok) {
                    throw new Error(primaryEvalResult.error || `评估请求失败 (${response.status})`);
                }

                // 5. 处理主要评估结果（仅记录对错，显示通知/高亮）
                console.log('检查 primaryEvalResult.is_correct ...');
                if (primaryEvalResult && primaryEvalResult.is_correct === true) {
                    evaluationCorrect = true;
                    showNotification('回答正确！', 'success');
                } else {
                    evaluationCorrect = false;
                    let errorMessage = '回答错误，请检查后重试';
                    let errorReasonForSuggestion = null;
                    if (primaryEvalResult && taskType === 'coding' && primaryEvalResult.error_reason) {
                        errorMessage = `代码评估: ${primaryEvalResult.error_reason}`;
                        errorReasonForSuggestion = primaryEvalResult.error_reason;
                    } else if (primaryEvalResult && taskType === 'quiz' && primaryEvalResult.error_reason) {
                        errorMessage = `测验评估: ${primaryEvalResult.error_reason}`;
                        errorReasonForSuggestion = primaryEvalResult.error_reason; // Could be generic like "部分答案错误"
                    }
                    showNotification(errorMessage, 'error');
                    if (primaryEvalResult && taskType === 'quiz' && primaryEvalResult.incorrect_indices) {
                        highlightIncorrectQuizItems(primaryEvalResult.incorrect_indices);
                    }

                    // --- 回答错误时，触发基于错误的推荐问题 ---
                    console.log("[推荐问题] 回答错误，准备生成错误相关问题。");
                    if (stepTitle && stepDescription && userSubmission !== undefined) {
                        fetchSuggestedQuestions(stepTitle, stepDescription, userSubmission, errorReasonForSuggestion);
                    } else {
                        console.warn("无法为错误生成推荐问题：缺少上下文。");
                    }
                    // --------------------------------------
                }

                // --- 触发能力评估 (无论对错都触发，在 primary eval 成功后) ---
                const abilityTaskTitle = stepTitle; // Use learning step title for consistency
                const abilityTaskDesc = stepDescription; // Use learning step description
                console.log(`[能力评估] 使用上下文: Title='${abilityTaskTitle}', Desc='${abilityTaskDesc}'`);
                if (abilityTaskTitle && abilityTaskDesc && userSubmission !== undefined) {
                    triggerAbilityAssessment(abilityTaskTitle, abilityTaskDesc, userSubmission)
                         .then(() => console.log("[能力评估] API调用已发出。"))
                         .catch(err => console.error("[能力评估] 调用时出错:", err));
                } else {
                    console.warn("无法触发能力评估：缺少学习步骤标题、描述或用户提交内容。");
                }
                // ---------------------------------------------------------

            } catch (error) {
                console.error('主要评估API调用或处理失败:', error);
                showNotification(`评估失败: ${error.message}`, 'error');
                submitTaskBtn.disabled = false;
                submitTaskBtn.textContent = '提交';
                return;
            } 

            // 6. 根据主要评估结果决定是否切换步骤 
            if (evaluationCorrect) {
                console.log("主要评估正确，切换到下一步骤");
                completeCurrentStep(); // completeCurrentStep 内部会调用 updateCurrentTask
                                   // updateCurrentTask 内部会调用常规的 fetchSuggestedQuestions
            } else {
                 console.log("主要评估错误，停留在当前步骤，错误推荐问题已触发（如果适用）。");
            }

            // 7. 重新启用按钮 (在所有处理完成后)
            submitTaskBtn.disabled = false;
            submitTaskBtn.textContent = '提交';
        });
    }
    
    // 上传按钮点击事件（示例）
    if (uploadBtn) {
        uploadBtn.addEventListener('click', function() {
            // 这里可以实现文件上传逻辑
            showNotification('文件上传功能尚未实现', 'info');
        });
    }
    
    // 刷新任务按钮点击事件
    const refreshTaskBtn = document.getElementById('refreshTaskBtn');
    if (refreshTaskBtn) {
        refreshTaskBtn.addEventListener('click', function() {
            refreshCurrentTask();
        });
    }
    
    // 缓存任务按钮点击事件
    const cacheTaskBtn = document.getElementById('cacheTaskBtn');
    if (cacheTaskBtn) {
        cacheTaskBtn.addEventListener('click', function() {
            cacheCurrentTask();
        });
    }
    
    /**
     * 完成当前步骤
     */
    function completeCurrentStep() {
        console.log('[completeCurrentStep] 开始执行'); // 添加日志
        if (!currentPlanData) {
            console.log('[completeCurrentStep] 失败：currentPlanData 不存在');
            return;
        }
        
        // 查找当前进行中的步骤
        const currentStepIndex = currentPlanData.plan.findIndex(step => step.status === '当前进行');
        console.log(`[completeCurrentStep] 查找到当前步骤索引: ${currentStepIndex}`);
        if (currentStepIndex === -1) {
            console.log('[completeCurrentStep] 失败：找不到当前进行中的步骤');
            return;
        }
        
        // 更新当前步骤状态
        currentPlanData.plan[currentStepIndex].status = '已完成';
        console.log(`[completeCurrentStep] 步骤 ${currentStepIndex + 1} 状态更新为 '已完成'`);
        
        // 获取当前步骤节点并标记为已完成
        const stepNode = document.querySelectorAll('.timeline-node')[currentStepIndex]; // 使用索引更可靠
        if (stepNode) {
            stepNode.classList.remove('current');
            stepNode.classList.add('completed');
            console.log(`[completeCurrentStep] DOM 节点 ${currentStepIndex + 1} 标记为 completed`);
            
            // 更新步骤状态文本
            const statusEl = stepNode.querySelector('.node-status');
            if (statusEl) {
                statusEl.textContent = '已完成';
            }
        } else {
            console.warn(`[completeCurrentStep] 未找到步骤 ${currentStepIndex + 1} 的 DOM 节点`);
        }
        
        // 查找并激活下一个步骤
        if (currentStepIndex + 1 < currentPlanData.plan.length) {
            console.log(`[completeCurrentStep] 准备激活下一个步骤: ${currentStepIndex + 2}`);
            // 更新下一个步骤状态为"当前进行"
            currentPlanData.plan[currentStepIndex + 1].status = '当前进行';
            
            // 获取下一个步骤节点
            const nextStepNode = stepNode.nextElementSibling;
            if (nextStepNode) {
                nextStepNode.classList.add('current');
                
                // 更新步骤状态文本
                const nextStatusEl = nextStepNode.querySelector('.node-status');
                if (nextStatusEl) {
                    nextStatusEl.textContent = '当前进行';
                }
            }
            
            // 通知其他模块计划已更新
            const event = new CustomEvent('learningPlanUpdated', {
                detail: currentPlanData
            });
            window.dispatchEvent(event);
            
            // 更新当前任务区域
            updateCurrentTask(currentPlanData.plan[currentStepIndex + 1]);
        } else {
            console.log('[completeCurrentStep] 已是最后一个步骤，显示完成信息');
            // 最后一个步骤已完成
            showNotification('恭喜！您已完成所有学习步骤', 'success');
            
            // 更新工作区显示祝贺信息
            const taskTitle = document.querySelector('.current-task-title');
            const taskDesc = document.querySelector('.current-task-desc');
            const activeTabContent = document.querySelector('.tab-content.active');
            const statusIndicator = document.querySelector('.task-status-indicator');

            if (taskTitle) taskTitle.textContent = '恭喜！';
            if (taskDesc) taskDesc.textContent = '您已成功完成本次学习计划的所有任务！';
            if (statusIndicator) statusIndicator.style.display = 'none'; // 隐藏状态指示器

            if (activeTabContent) {
                activeTabContent.innerHTML = '<div style="padding: 20px; text-align: center; font-size: 1.2em; color: #34A853;">🎉 学习完成！🎉</div>';
            }
            // 可以在这里禁用提交按钮等
            if (submitTaskBtn) submitTaskBtn.disabled = true;
        }
        console.log('[completeCurrentStep] 执行完毕'); // 添加日志
    }
    
    // 监听学习计划节点点击事件 (使用事件委托)
    document.addEventListener('click', function(event) {
        // 查找被点击的学习计划节点
        const timelineNode = event.target.closest('.timeline-node');
        if (!timelineNode) return;
        
        // 如果点击的是已完成节点，则不做操作
        if (timelineNode.classList.contains('completed')) return;
        
        // 如果点击的是当前节点，则将其标记为已完成，并激活下一个节点
        if (timelineNode.classList.contains('current')) {
            markStepAsCompleted(timelineNode);
        }
    });
    
    /**
     * 将步骤标记为已完成并激活下一个步骤
     * @param {HTMLElement} stepNode - 步骤节点元素
     */
    function markStepAsCompleted(stepNode) {
        if (!currentPlanData) return;
        
        // 获取当前步骤编号
        const stepNumber = parseInt(stepNode.querySelector('.node-marker').textContent);
        
        // 更新内存中的计划数据
        const stepIndex = stepNumber - 1;
        if (stepIndex < 0 || stepIndex >= currentPlanData.plan.length) return;
        
        // 更新当前步骤状态为"已完成"
        currentPlanData.plan[stepIndex].status = '已完成';
        
        // UI更新 - 标记当前步骤为已完成
        stepNode.classList.remove('current');
        stepNode.classList.add('completed');
        
        // 更新步骤状态文本
        const statusEl = stepNode.querySelector('.node-status');
        if (statusEl) {
            statusEl.textContent = '已完成';
        }
        
        // 查找并激活下一个步骤
        if (stepIndex + 1 < currentPlanData.plan.length) {
            // 更新下一个步骤状态为"当前进行"
            currentPlanData.plan[stepIndex + 1].status = '当前进行';
            
            // 获取下一个步骤节点
            const nextStepNode = stepNode.nextElementSibling;
            if (nextStepNode) {
                nextStepNode.classList.add('current');
                
                // 更新步骤状态文本
                const nextStatusEl = nextStepNode.querySelector('.node-status');
                if (nextStatusEl) {
                    nextStatusEl.textContent = '当前进行';
                }
            }
            
            // 通知其他模块计划已更新
            const event = new CustomEvent('learningPlanUpdated', {
                detail: currentPlanData
            });
            window.dispatchEvent(event);
            
            // 更新当前任务区域
            updateCurrentTask(currentPlanData.plan[stepIndex + 1]);
        } else {
            // 最后一个步骤已完成
            showNotification('恭喜！您已完成所有学习步骤', 'success');
            
            // 更新工作区显示祝贺信息
            const taskTitle = document.querySelector('.current-task-title');
            const taskDesc = document.querySelector('.current-task-desc');
            const activeTabContent = document.querySelector('.tab-content.active');
            const statusIndicator = document.querySelector('.task-status-indicator');

            if (taskTitle) taskTitle.textContent = '恭喜！';
            if (taskDesc) taskDesc.textContent = '您已成功完成本次学习计划的所有任务！';
            if (statusIndicator) statusIndicator.style.display = 'none'; // 隐藏状态指示器

            if (activeTabContent) {
                activeTabContent.innerHTML = '<div style="padding: 20px; text-align: center; font-size: 1.2em; color: #34A853;">🎉 学习完成！🎉</div>';
            }
            // 可以在这里禁用提交按钮等
            if (submitTaskBtn) submitTaskBtn.disabled = true;
        }
    }
    
    /**
     * 更新当前任务区域
     * @param {Object} taskStep - 当前执行的步骤
     */
    function updateCurrentTask(taskStep) {
        const taskTitleElement = document.querySelector('.current-task-title');
        
        // Update title only
        if (taskTitleElement && taskStep) {
            taskTitleElement.textContent = taskStep.title || '';
        }
        
        // 设置当前显示步骤
        if (window.taskQueueManager && taskStep) {
            window.taskQueueManager.setCurrentDisplayStep(taskStep.step);
        }
        
        // --- Fetch and display suggested questions FOR NEW TASK --- 
        if (taskStep && taskStep.title && taskStep.description) {
            // Call with only title and description for new task context
            fetchSuggestedQuestions(taskStep.title, taskStep.description);
        } else {
             if(window.displaySuggestedQuestions) window.displaySuggestedQuestions([]);
        }
        // ---------------------------------------------

        // 检查任务队列中的任务状态
        if (window.taskQueueManager && taskStep) {
            const taskStatus = window.taskQueueManager.getTaskStatus(taskStep.step);
            console.log(`[更新任务] 步骤${taskStep.step}任务状态: ${taskStatus}`);
            
            if (taskStatus === 'ready') {
                // 任务已就绪，直接显示
                const taskData = window.taskQueueManager.getTaskForStep(taskStep.step);
                displayTaskContent(taskData);
            } else if (taskStatus === 'generating') {
                // 任务生成中
                showTaskGeneratingStatus();
            } else if (taskStatus === 'pending') {
                // 任务等待生成
                showTaskPendingStatus();
            } else if (taskStatus === 'failed') {
                // 任务生成失败
                showTaskFailedStatus();
            } else {
                // 回退到原有逻辑（兼容性）
                generateAndDisplayTask(taskStep);
            }
        } else {
            // 回退到原有逻辑（兼容性）
            generateAndDisplayTask(taskStep);
        }
        
        // Trigger event (optional, if other modules need to know the *step* updated)
        const taskUpdateEvent = new CustomEvent('currentTaskUpdated', {
            detail: taskStep 
        });
        window.dispatchEvent(taskUpdateEvent);
    }

    /**
     * 显示任务内容
     */
    function displayTaskContent(taskData) {
        console.log('[事件监听] 显示任务内容:', taskData);
        
        // Reset submit button state when displaying new content
        const submitBtn = document.getElementById('submitTaskBtn');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '提交';
        }
        
        // Store the task data with answers for evaluation
        if (taskData) {
            storeTaskDataForEvaluation(taskData);
        } else {
            console.error("taskData为空");
            storeTaskDataForEvaluation(null);
            return;
        }
        
        // Notify interaction module (if needed for other purposes)
        if (window.notifyTaskGenerated && taskData) {
            window.notifyTaskGenerated(taskData);
        }
        
        // Handle display based on task type
        console.log('[事件监听] 任务类型:', taskData.type);
        
        if (taskData.type === 'quiz') {
            showQuizQuestions(taskData);
        } else if (taskData.type === 'coding') {
            showCodingTask(taskData);
        } else {
            console.warn('未知的任务类型:', taskData.type);
        }
    }

    /**
     * 显示任务生成中状态
     */
    function showTaskGeneratingStatus() {
        console.log('[任务状态] 显示生成中状态');
        const activeTabContent = document.querySelector('.tab-content.active');
        if (activeTabContent) {
            // 不要覆盖整个内容，而是隐藏现有内容并显示状态
            hideTabContent(activeTabContent);
            showStatusOverlay(activeTabContent, `
                <div class="task-status-container">
                    <div class="loading-spinner"></div>
                    <p>任务生成中，请稍候...</p>
                </div>
            `);
        }
    }

    /**
     * 显示任务等待状态
     */
    function showTaskPendingStatus() {
        console.log('[任务状态] 显示等待中状态');
        const activeTabContent = document.querySelector('.tab-content.active');
        if (activeTabContent) {
            hideTabContent(activeTabContent);
            showStatusOverlay(activeTabContent, `
                <div class="task-status-container">
                    <div class="pending-icon">⏳</div>
                    <p>任务在队列中等待生成...</p>
                </div>
            `);
        }
    }

    /**
     * 显示任务失败状态
     */
    function showTaskFailedStatus() {
        console.log('[任务状态] 显示失败状态');
        const activeTabContent = document.querySelector('.tab-content.active');
        if (activeTabContent) {
            hideTabContent(activeTabContent);
            showStatusOverlay(activeTabContent, `
                <div class="task-status-container">
                    <div class="error-icon">❌</div>
                    <p>任务生成失败，请刷新重试</p>
                </div>
            `);
        }
    }

    /**
     * 隐藏标签页内容
     */
    function hideTabContent(tabContent) {
        const children = tabContent.children;
        for (let i = 0; i < children.length; i++) {
            if (!children[i].classList.contains('status-overlay')) {
                children[i].style.display = 'none';
            }
        }
    }

    /**
     * 显示状态覆盖层
     */
    function showStatusOverlay(tabContent, statusHtml) {
        // 移除现有的状态覆盖层
        const existingOverlay = tabContent.querySelector('.status-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }
        
        // 创建新的状态覆盖层
        const overlay = document.createElement('div');
        overlay.className = 'status-overlay';
        overlay.innerHTML = statusHtml;
        tabContent.appendChild(overlay);
    }

    /**
     * 恢复标签页内容
     */
    function restoreTabContent(tabContent) {
        // 移除状态覆盖层
        const overlay = tabContent.querySelector('.status-overlay');
        if (overlay) {
            overlay.remove();
        }
        
        // 恢复原有内容显示
        const children = tabContent.children;
        for (let i = 0; i < children.length; i++) {
            children[i].style.display = '';
        }
    }

    /**
     * 生成并显示任务（回退逻辑）
     */
    function generateAndDisplayTask(taskStep) {
        console.log('[回退逻辑] 使用原有任务生成方式');
        const useMock = currentPlanData && currentPlanData.is_mock;
        
        generateTask(taskStep.description, useMock)
            .then(taskData => {
                console.log('生成的任务数据:', taskData);
                
                if (taskData.task) {
                    displayTaskContent(taskData.task);
                } else {
                    console.error('taskData中缺少task属性:', taskData);
                }
            })
            .catch(error => {
                console.error('生成任务失败:', error);
                showNotification('生成任务失败: ' + error.message, 'error');
                storeTaskDataForEvaluation(null);
                if(window.displaySuggestedQuestions) window.displaySuggestedQuestions([]);
            });
    }

    // --- New helper function to store task data ---
    function storeTaskDataForEvaluation(taskData) {
        console.log("Storing task data for evaluation:", taskData);
        currentTaskDataForEval = taskData;
    }
    
    // --- Modify getCurrentActiveTask to use the local variable ---
    function getCurrentActiveTask() {
         if (currentTaskDataForEval) {
             console.log("Retrieved stored task data for evaluation:", currentTaskDataForEval);
             return currentTaskDataForEval;
         }
         console.error("无法获取当前活动任务数据!");
         return null; 
    }

    // --- Modify fetchSuggestedQuestions to accept optional error context and pass contextType
    async function fetchSuggestedQuestions(title, description, submissionForError = null, reasonForError = null) {
        const isErrorContext = !!submissionForError;
        console.log(`Fetching suggested questions. Title: ${title}. Is error context: ${isErrorContext}`);
        let requestBody = {
            task_title: title,
            task_description: description
        };

        if (isErrorContext) {
            requestBody.user_submission = submissionForError;
            if (reasonForError !== null) {
                requestBody.error_reason = reasonForError;
            }
        }

        try {
            const response = await fetch('/api/ai/suggest_questions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                console.error('Suggest questions API request failed:', response.status);
                 if(window.displaySuggestedQuestions) window.displaySuggestedQuestions([], isErrorContext ? 'error_correction' : 'new_task');
                return;
            }
            const data = await response.json();
            if (data.questions && window.displaySuggestedQuestions) {
                window.displaySuggestedQuestions(data.questions, isErrorContext ? 'error_correction' : 'new_task');
            } else {
                 if(window.displaySuggestedQuestions) window.displaySuggestedQuestions([], isErrorContext ? 'error_correction' : 'new_task');
            }
        } catch (error) {
            console.error('Error fetching suggested questions:', error);
             if(window.displaySuggestedQuestions) window.displaySuggestedQuestions([], isErrorContext ? 'error_correction' : 'new_task');
        }
    }
    
    /**
     * 显示测验问题
     * @param {Object} taskData - 任务数据
     */
    function showQuizQuestions(taskData) {
        console.log('[显示测验问题] 开始显示测验问题');
        
        // Reset submit button state
        resetSubmitButtonState();
        
        // 先激活测验标签页
        const quizTabBtn = document.getElementById('quizTabBtn');
        if (quizTabBtn) {
            quizTabBtn.click();
        }
        console.log('[显示测验问题] 测验标签页已激活'); 
        
        // 等待标签页切换完成后再获取DOM元素
        setTimeout(() => {
            // 获取当前活动的标签页内容
            const activeTabContent = document.querySelector('.tab-content.active');
            if (activeTabContent) {
                // 恢复标签页内容（移除状态覆盖层）
                restoreTabContent(activeTabContent);
            }
            
            // 然后获取测验区域元素
            const quizQuestion = document.getElementById('quizQuestion');
            const quizOptions = document.getElementById('quizOptions');
            const pptSlideContainer = document.getElementById('pptSlideContainer');
            const pptSlideTitle = document.getElementById('pptSlideTitle');
            const pptSlideContent = document.getElementById('pptSlideContent');
            
            console.log('[显示测验问题] 测验区域元素:', quizQuestion, quizOptions, pptSlideContainer, pptSlideTitle, pptSlideContent);
            if (!quizQuestion || !quizOptions) {
                console.error('[显示测验问题] 无法找到测验区域元素，延迟重试');
                // 如果还是找不到，再等待一次
                setTimeout(() => {
                    const retryQuizQuestion = document.getElementById('quizQuestion');
                    const retryQuizOptions = document.getElementById('quizOptions');
                    if (!retryQuizQuestion || !retryQuizOptions) {
                        console.error('[显示测验问题] 重试后仍无法找到测验区域元素');
                        return;
                    }
                    continueShowingQuiz(taskData, retryQuizQuestion, retryQuizOptions, pptSlideContainer, pptSlideTitle, pptSlideContent);
                }, 200);
                return;
            }
            
            continueShowingQuiz(taskData, quizQuestion, quizOptions, pptSlideContainer, pptSlideTitle, pptSlideContent);
        }, 100);
    }

    // 提取测验显示逻辑到单独函数
    function continueShowingQuiz(taskData, quizQuestion, quizOptions, pptSlideContainer, pptSlideTitle, pptSlideContent) {
        console.log('[显示测验问题] 测验区域元素存在');
        // 显示PPT内容（如果有）
        if (taskData.ppt_slide && pptSlideContainer && pptSlideTitle && pptSlideContent) {
            pptSlideTitle.textContent = taskData.ppt_slide.title || '知识点';
            pptSlideContent.innerHTML = '';
            
            if (taskData.ppt_slide.content && Array.isArray(taskData.ppt_slide.content)) {
                // 使用动画引擎解析内容
                if (window.animationEngine) {
                    const parsedContent = window.animationEngine.parseContent(taskData.ppt_slide.content);
                    
                    // 将普通文本内容合并为markdown并渲染
                    if (parsedContent.textContent.length > 0) {
                        const markdownContent = parsedContent.textContent.join('\n\n');
                        const markdownContainer = document.createElement('div');
                        markdownContainer.className = 'ppt-markdown-content';
                        
                        // 使用marked.js渲染markdown
                        if (typeof marked !== 'undefined') {
                            markdownContainer.innerHTML = marked.parse(markdownContent);
                        } else {
                            // 回退方案：简单的文本显示
                            markdownContainer.innerHTML = markdownContent.replace(/\n/g, '<br>');
                        }
                        
                        pptSlideContent.appendChild(markdownContainer);
                    }
                    
                    // 渲染动画（如果有）
                    if (parsedContent.animations.length > 0) {
                        const animationContainer = document.createElement('div');
                        animationContainer.className = 'ppt-animation-container';
                        
                        pptSlideContent.appendChild(animationContainer);
                        window.animationEngine.renderAnimations(parsedContent.animations, animationContainer);
                    }
                } else {
                    // 回退到原有逻辑
                    const markdownContent = taskData.ppt_slide.content.join('\n\n');
                    const markdownContainer = document.createElement('div');
                    markdownContainer.className = 'ppt-markdown-content';
                    
                    if (typeof marked !== 'undefined') {
                        markdownContainer.innerHTML = marked.parse(markdownContent);
                    } else {
                        markdownContainer.innerHTML = markdownContent.replace(/\n/g, '<br>');
                    }
                    
                    pptSlideContent.appendChild(markdownContainer);
                }
            }
            
            pptSlideContainer.style.display = 'block';
        } else if (pptSlideContainer) {
            pptSlideContainer.style.display = 'none';
        }
        
        console.log('[显示测验问题] 测验内容已填充');
        // 清空现有题目内容
        quizQuestion.innerHTML = '';
        quizOptions.innerHTML = '';
        
        // 提取问题数组，兼容不同的数据结构
        const questions = taskData.questions || [];
        
        // 显示所有题目（支持1-3道题目）
        if (questions && questions.length > 0) {
            // 创建问题容器
            const questionContainer = document.createElement('div');
            questionContainer.className = 'quiz-questions-list';
            
            // 遍历所有问题
            questions.forEach((question, questionIndex) => {
                // 创建单个问题项
                const questionItem = document.createElement('div');
                questionItem.className = 'quiz-question-item';
                questionItem.setAttribute('data-question-index', questionIndex);
                
                // 添加问题文本
                const questionEl = document.createElement('p');
                questionEl.className = 'quiz-question-text';
                const questionNumber = questions.length > 1 ? `题目 ${questionIndex + 1}: ` : '问题: ';
                questionEl.innerHTML = `<strong>${questionNumber}</strong> ${question.question}`;
                questionItem.appendChild(questionEl);
                
                // 如果有选项，直接添加在问题下方
                if (question.options && question.options.length) {
                    const optionsContainer = document.createElement('div');
                    optionsContainer.className = 'options-container';
                    
                    question.options.forEach((option, optIndex) => {
                        const optionEl = document.createElement('div');
                        optionEl.className = 'quiz-option';
                        
                        optionEl.innerHTML = `
                            <input type="radio" name="question${questionIndex}" id="q${questionIndex}opt${optIndex}" value="${option}" class="quiz-option-input">
                            <label for="q${questionIndex}opt${optIndex}">${option}</label>
                        `;
                        
                        optionsContainer.appendChild(optionEl);
                    });
                    
                    questionItem.appendChild(optionsContainer);
                } else {
                    // 如果没有选项，添加文本输入框
                    const inputEl = document.createElement('input');
                    inputEl.type = 'text';
                    inputEl.className = 'quiz-input-field';
                    inputEl.placeholder = '请在此处输入你的答案...';
                    inputEl.name = `question${questionIndex}-input`;
                    inputEl.id = `question${questionIndex}-input`;
                    questionItem.appendChild(inputEl);
                }
                
                questionContainer.appendChild(questionItem);
            });
            
            quizQuestion.appendChild(questionContainer);
            
            // 添加提示信息
            const hintContainer = document.createElement('div');
            hintContainer.className = 'quiz-hint';
            const questionCount = questions.length;
            const hintText = questionCount > 1 ? 
                `共 ${questionCount} 道题目，完成所有题目后请点击下方的"提交"按钮` : 
                '完成后请点击下方的"提交"按钮';
            hintContainer.innerHTML = `<p>${hintText}</p>`;
            quizOptions.appendChild(hintContainer);
        }
    }
    
    /**
     * 显示编程任务
     * @param {Object} taskData - 任务数据
     */
    function showCodingTask(taskData) {
        console.log('[显示编程任务] 开始显示编程任务');
        
        // Reset submit button state
        resetSubmitButtonState();
        
        // 激活代码编辑器标签页
        const codeTabBtn = document.getElementById('codeTabBtn');
        if (codeTabBtn) {
            codeTabBtn.click();
        }
        
        // 获取当前活动的标签页内容并恢复
        const activeTabContent = document.querySelector('.tab-content.active');
        if (activeTabContent) {
            // 恢复标签页内容（移除状态覆盖层）
            restoreTabContent(activeTabContent);
        }
        
        // 显示PPT内容（如果有）
        const pptSlideContainer = document.getElementById('codePptSlideContainer');
        const pptSlideTitle = document.getElementById('codePptSlideTitle');
        const pptSlideContent = document.getElementById('codePptSlideContent');
        
        if (taskData.ppt_slide && pptSlideContainer && pptSlideTitle && pptSlideContent) {
            pptSlideTitle.textContent = taskData.ppt_slide.title || '知识点';
            pptSlideContent.innerHTML = '';
            
            if (taskData.ppt_slide.content && Array.isArray(taskData.ppt_slide.content)) {
                // 使用动画引擎解析内容
                if (window.animationEngine) {
                    const parsedContent = window.animationEngine.parseContent(taskData.ppt_slide.content);
                    
                    // 将普通文本内容合并为markdown并渲染
                    if (parsedContent.textContent.length > 0) {
                        const markdownContent = parsedContent.textContent.join('\n\n');
                        const markdownContainer = document.createElement('div');
                        markdownContainer.className = 'ppt-markdown-content';
                        
                        // 使用marked.js渲染markdown
                        if (typeof marked !== 'undefined') {
                            markdownContainer.innerHTML = marked.parse(markdownContent);
                        } else {
                            // 回退方案：简单的文本显示
                            markdownContainer.innerHTML = markdownContent.replace(/\n/g, '<br>');
                        }
                        
                        pptSlideContent.appendChild(markdownContainer);
                    }
                    
                    // 显示动画（如果有）
                    if (parsedContent.animations.length > 0) {
                        const animationContainer = document.createElement('div');
                        animationContainer.className = 'animation-container';
                        pptSlideContent.appendChild(animationContainer);
                        
                        // 渲染动画
                        window.animationEngine.renderAnimations(parsedContent.animations, animationContainer);
                    }
                } else {
                    // 回退方案：将普通文本内容合并为markdown并渲染
                    const markdownContent = taskData.ppt_slide.content.join('\n\n');
                    const markdownContainer = document.createElement('div');
                    markdownContainer.className = 'ppt-markdown-content';
                    
                    // 使用marked.js渲染markdown
                    if (typeof marked !== 'undefined') {
                        markdownContainer.innerHTML = marked.parse(markdownContent);
                    } else {
                        // 回退方案：简单的文本显示
                        markdownContainer.innerHTML = markdownContent.replace(/\n/g, '<br>');
                    }
                    
                    pptSlideContent.appendChild(markdownContainer);
                }
            }
            
            pptSlideContainer.style.display = 'block';
        } else {
            if (pptSlideContainer) {
                pptSlideContainer.style.display = 'none';
            }
        }
        
        // 更新任务描述区域
        const taskDescriptionArea = document.getElementById('taskDescriptionArea');
        if (taskDescriptionArea) {
            const existingDesc = taskDescriptionArea.querySelector('.task-description');
            if (existingDesc) {
                existingDesc.remove();
            }
            
            const descContainer = document.createElement('div');
            descContainer.className = 'task-description';
            
            // 使用正确的路径获取任务信息
            const taskTitle = taskData.task?.title || '编程任务';
            const taskDescription = taskData.task?.description || '请根据要求完成编程任务';
            
            descContainer.innerHTML = `
                <h4>${taskTitle}</h4>
                <p>${taskDescription}</p>
            `;
            taskDescriptionArea.appendChild(descContainer);
            taskDescriptionArea.style.display = 'block';
        }
        
        // 更新代码编辑器
        if (window.codeEditor) {
            const starterCode = taskData.task?.starter_code || taskData.starter_code || '# 在这里编写你的代码\n\n';
            window.codeEditor.setValue(starterCode);
            window.codeEditor.clearSelection();
        }
        
        // 显示提示信息
        const hintContainer = document.getElementById('hintContainer');
        if (hintContainer) {
            hintContainer.innerHTML = '<p>完成后请点击下方的"提交"按钮</p>';
            hintContainer.style.display = 'block';
        }
        
        // 存储任务数据用于评估
        storeTaskDataForEvaluation(taskData);
        
        // 获取并显示推荐问题 - 使用正确的任务信息
        const taskTitle = taskData.task?.title || taskData.ppt_slide?.title || '编程任务';
        const taskDescription = taskData.task?.description || '编程任务';
        
        if (taskTitle && taskDescription) {
            fetchSuggestedQuestions(taskTitle, taskDescription);
        }
    }
    
    /**
     * 调用API生成学习计划
     * @param {string} learningGoal - 学习目标
     */
    function generateLearningPlan(learningGoal) {
        // 清空任务队列
        if (window.taskQueueManager) {
            window.taskQueueManager.clearQueue();
            console.log('[学习计划] 已清空任务队列');
        }
        
        // 判断是否使用模拟数据
        const useMock = learningGoal === "测试";
        
        // 获取选中的课程内容
        const courseContent = window.selectedCourseContent || null;
        console.log('生成学习计划时使用的课程内容:', courseContent);
        
        // 显示适当的提示
        if (useMock) {
            showNotification('使用模拟数据进行测试', 'info');
        } else if (courseContent) {
            showNotification('基于选中课程生成学习计划', 'info');
        }
        
        // 显示生成进度动画
        showGeneratingAnimation();
        
        // 准备学习计划容器
        prepareTimelineContainer();
        
        // 初始化计划数据
        currentPlanData = {
            plan: [],
            is_mock: useMock  // 添加模拟状态标识
        };
        
        // API请求参数
        const requestData = {
            learning_goal: learningGoal,
            use_mock: useMock,
            course_content: courseContent  // 添加课程内容参数
        };
        
        // 使用流式API
        if ('EventSource' in window) {
            // 构建查询参数
            const queryParams = new URLSearchParams(requestData).toString();
            
            // 创建SSE连接
            const eventSource = new EventSource(`/api/learning/plan/stream?${queryParams}`);
            
            // 监听消息事件
            eventSource.addEventListener('message', function(event) {
                try {
                    const data = JSON.parse(event.data);
                    
                    if (data.error) {
                        // 处理错误
                        showNotification(`生成学习计划失败: ${data.error}`, 'error');
                        eventSource.close();
                        
                        // 恢复按钮状态
                        createPlanBtn.disabled = false;
                        createPlanBtn.innerHTML = '<span class="material-icons-outlined btn-icon">psychology</span> 生成计划';
                        
                        // 移除生成动画
                        removeGeneratingAnimation();
                        return;
                    }
                    
                    if (data.step) {
                        // 收到新步骤
                        const stepData = data.step;
                        
                        // 添加到计划数据
                        currentPlanData.plan.push(stepData);
                        
                        // 立即显示步骤
                        appendPlanStep(stepData);
                    }
                    
                    if (data.done) {
                        // 计划生成完成
                        eventSource.close();
                        
                        // 恢复按钮状态
                        createPlanBtn.disabled = false;
                        createPlanBtn.innerHTML = '<span class="material-icons-outlined btn-icon">psychology</span> 生成计划';
                        
                        // 移除生成动画
                        removeGeneratingAnimation();
                        
                        // 显示完成通知
                        showNotification('学习计划生成成功！', 'success');
                        
                        // 触发学习计划生成事件
                        const event = new CustomEvent('learningPlanGenerated', {
                            detail: currentPlanData
                        });
                        window.dispatchEvent(event);
                    }
                } catch (error) {
                    console.error('解析SSE消息出错:', error);
                }
            });
            
            // 监听错误事件
            eventSource.addEventListener('error', function() {
                console.error('SSE连接错误');
                eventSource.close();
                
                // 恢复按钮状态
                createPlanBtn.disabled = false;
                createPlanBtn.innerHTML = '<span class="material-icons-outlined btn-icon">psychology</span> 生成计划';
                
                // 移除生成动画
                removeGeneratingAnimation();
                
                // 使用传统API作为备选方案
                fallbackToTraditionalAPI(requestData);
            });
        } else {
            // 浏览器不支持EventSource，使用传统API
            fallbackToTraditionalAPI(requestData);
        }
    }
    
    /**
     * 准备时间线容器
     */
    function prepareTimelineContainer() {
        // 移除示例标签
        const exampleBadge = document.querySelector('.learning-plan-content .example-badge');
        if (exampleBadge) {
            exampleBadge.style.display = 'none';
        }
        
        // 准备学习计划容器
        const planContainer = document.querySelector('.learning-plan-content');
        if (planContainer) {
            const title = planContainer.querySelector('.block-title');
            const titleHTML = title ? title.outerHTML : '<h3 class="block-title">学习计划</h3>';
            
            planContainer.innerHTML = `
                ${titleHTML}
                <div class="example-content">
                    <div class="learning-timeline"></div>
                </div>
            `;
        }
    }
    
    /**
     * 添加新的计划步骤到UI
     * @param {Object} step - 步骤数据
     */
    function appendPlanStep(step) {
        const timelineElement = document.querySelector('.learning-timeline');
        if (!timelineElement) return;
        
        // 添加步骤到任务队列
        if (window.taskQueueManager) {
            window.taskQueueManager.addStep(step);
        }
        
        // 创建步骤节点
        const nodeElement = document.createElement('div');
        
        // 根据状态添加不同的CSS类
        let nodeClass = 'timeline-node';
        if (step.status === '当前进行') {
            nodeClass += ' current';
        } else if (step.status === '已完成') {
            nodeClass += ' completed';
        }
        
        nodeElement.className = nodeClass;
        nodeElement.style.opacity = '0';
        nodeElement.style.transform = 'translateY(10px)';
        nodeElement.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        
        // 构建节点HTML，不再显示学习时间
        nodeElement.innerHTML = `
            <div class="node-marker">${step.step}</div>
            <div class="node-content">
                <h4 class="node-title">${step.title}</h4>
                <div class="node-status">${step.status}</div>
            </div>
        `;
        
        timelineElement.appendChild(nodeElement);
        
        // 触发渲染并添加显示动画
        setTimeout(() => {
            nodeElement.style.opacity = '1';
            nodeElement.style.transform = 'translateY(0)';
            
            // 如果是第一个步骤并且是当前进行状态，立即更新任务区域
            const stepNumber = parseInt(step.step);
            if (stepNumber === 1 && step.status === '当前进行') {
                console.log('第一个步骤已生成，立即更新任务区域');
                updateCurrentTask(step);
                showNotification('第一个学习步骤已就绪', 'info');
            }
        }, 100);
    }
    
    /**
     * 当SSE不可用时回退到传统API
     * @param {Object} requestData - 请求数据
     */
    function fallbackToTraditionalAPI(requestData) {
        console.log('回退到传统API请求');
        showNotification('使用备选通道生成学习计划', 'info');
        
        // 发送API请求
        fetch('/api/learning/plan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        })
        .then(response => response.json())
        .then(data => {
            // 恢复按钮状态
            createPlanBtn.disabled = false;
            createPlanBtn.innerHTML = '<span class="material-icons-outlined btn-icon">psychology</span> 生成计划';
            
            // 移除生成动画
            removeGeneratingAnimation();
            
            if (data.error) {
                showNotification(`生成学习计划失败: ${data.error}`, 'error');
                return;
            }
            
            if (data.success && data.plan) {
                // 保存学习计划数据
                currentPlanData = data.plan;
                
                // 展示学习计划
                displayLearningPlan(data.plan);
                showNotification('学习计划生成成功！', 'success');
                
                // 更新当前任务区域，显示第一个任务
                if (data.plan.plan && data.plan.plan.length > 0) {
                    updateCurrentTask(data.plan.plan[0]);
                }
            } else {
                showNotification('返回数据格式错误', 'error');
            }
        })
        .catch(error => {
            console.error('生成学习计划出错:', error);
            createPlanBtn.disabled = false;
            createPlanBtn.innerHTML = '<span class="material-icons-outlined btn-icon">psychology</span> 生成计划';
            // 移除生成动画
            removeGeneratingAnimation();
            showNotification('请求失败，请稍后重试', 'error');
        });
    }
    
    /**
     * 显示生成进度动画
     */
    function showGeneratingAnimation() {
        // 获取学习计划容器
        const planContainer = document.querySelector('.learning-plan-content');
        if (!planContainer) return;
        
        // 清除现有内容但保留标题
        const title = planContainer.querySelector('.block-title');
        const titleHTML = title ? title.outerHTML : '<h3 class="block-title">学习计划</h3>';
        
        // 创建动画HTML
        planContainer.innerHTML = `
            ${titleHTML}
            <div class="generating-animation">
                <div class="loading-spinner"></div>
                <div class="generating-text">
                    <p>正在生成学习计划...</p>
                    <div class="progress-dots">
                        <span class="dot dot1"></span>
                        <span class="dot dot2"></span>
                        <span class="dot dot3"></span>
                    </div>
                </div>
            </div>
        `;
        
        // 移除示例标签
        const exampleBadge = document.querySelector('.learning-plan-content .example-badge');
        if (exampleBadge) {
            exampleBadge.style.display = 'none';
        }
    }
    
    /**
     * 移除生成进度动画
     */
    function removeGeneratingAnimation() {
        const animation = document.querySelector('.generating-animation');
        if (animation) {
            animation.classList.add('fade-out');
            setTimeout(() => {
                if (animation.parentNode) {
                    animation.parentNode.removeChild(animation);
                }
            }, 300);
        }
    }
    
    /**
     * 展示学习计划
     * @param {Object} planData - 学习计划数据
     */
    function displayLearningPlan(planData) {
        if (!learningTimelineElement || !planData || !planData.plan || !Array.isArray(planData.plan)) {
            console.error('无法显示学习计划: 缺少必要元素或数据');
            return;
        }
        
        // 清空现有的学习计划
        learningTimelineElement.innerHTML = '';
        
        // 移除示例标签
        const exampleBadge = document.querySelector('.learning-plan-content .example-badge');
        if (exampleBadge) {
            exampleBadge.style.display = 'none';
        }
        
        // 准备学习计划容器
        const planContainer = document.querySelector('.learning-plan-content');
        if (planContainer) {
            const title = planContainer.querySelector('.block-title');
            const titleHTML = title ? title.outerHTML : '<h3 class="block-title">学习计划</h3>';
            
            planContainer.innerHTML = `
                ${titleHTML}
                <div class="example-content">
                    <div class="learning-timeline"></div>
                </div>
            `;
        }
        
        // 获取更新后的学习计划元素
        const updatedTimelineElement = document.querySelector('.learning-timeline');
        if (!updatedTimelineElement) return;
        
        // 逐步显示每个计划步骤
        let stepIndex = 0;
        
        function addNextStep() {
            if (stepIndex < planData.plan.length) {
                const step = planData.plan[stepIndex];
                const nodeElement = document.createElement('div');
                
                // 根据状态添加不同的CSS类
                let nodeClass = 'timeline-node';
                if (step.status === '当前进行') {
                    nodeClass += ' current';
                } else if (step.status === '已完成') {
                    nodeClass += ' completed';
                }
                
                nodeElement.className = nodeClass;
                nodeElement.style.opacity = '0';
                nodeElement.style.transform = 'translateY(10px)';
                nodeElement.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                
                nodeElement.innerHTML = `
                    <div class="node-marker">${step.step}</div>
                    <div class="node-content">
                        <h4 class="node-title">${step.title}</h4>
                        <div class="node-status">${step.status}</div>
                    </div>
                `;
                
                updatedTimelineElement.appendChild(nodeElement);
                
                // 触发渲染并添加显示动画
                setTimeout(() => {
                    nodeElement.style.opacity = '1';
                    nodeElement.style.transform = 'translateY(0)';
                    
                    // 如果是第一个步骤并且是当前进行状态，立即更新任务区域
                    const stepNumber = parseInt(step.step);
                    if (stepNumber === 1 && step.status === '当前进行') {
                        console.log('第一个步骤已生成，立即更新任务区域');
                        updateCurrentTask(step);
                        showNotification('第一个学习步骤已就绪', 'info');
                    }
                }, 100);
                
                stepIndex++;
                
                // 如果还有下一步，等待动画完成后继续添加
                if (stepIndex < planData.plan.length) {
                    setTimeout(addNextStep, 400);
                } else {
                    // 所有步骤都已添加，触发事件
                    setTimeout(() => {
                        const event = new CustomEvent('learningPlanGenerated', {
                            detail: planData
                        });
                        window.dispatchEvent(event);
                    }, 500);
                }
            }
        }
        
        // 开始添加第一个步骤
        addNextStep();
    }
    
    /**
     * 显示通知消息
     * @param {string} message - 通知消息
     * @param {string} type - 通知类型 (success, error, info)
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

    async function generateTask(stepDescription, use_mock = false) {
        if (use_mock && currentPlanData && currentPlanData.plan) {
            const currentStep = currentPlanData.plan.find(step => step.status === '当前进行');
            if (currentStep) {
                const stepNumber = currentStep.step;
                
                if (stepNumber === 2) {
                    console.log('使用第二步模拟测验题数据');
                    return {
                        success: true,
                        task: {
                            type: 'quiz',
                            animation_type: '迷宫',
                            ppt_slide: {
                                title: 'Q-learning迷宫演示',
                                content: [
                                    '[ANIMATION:maze_demo]\ngrid_size：4x4\nstart_pos：(0,3)\ngoal_pos：(3,0)\nwalls：[(1,1),(2,2)]\ndemo_paths：最优路径[0,3→1,3→2,3→3,3→3,2→3,1→3,0] | 探索路径[0,3→0,2→0,1→1,1(撞墙)→0,1→0,0→1,0→2,0→3,0]\nrules：移动-1分，撞墙-10分，到达+100分\n[/ANIMATION]',
                                    '## Q-learning基础\n\n**强化学习算法**，通过试错学习\n\n- 智能体探索环境\n- 更新Q值表评估价值\n- 收敛到最优策略'
                                ]
                            },
                            questions: [
                                {
                                    question: 'Q-learning算法的核心思想是什么？',
                                    options: ['监督学习', '通过试错学习最优策略', '无监督聚类'],
                                    answer: '通过试错学习最优策略'
                                }
                            ]
                        }
                    };
                }
                else if (stepNumber === 3) {
                    console.log('使用第三步模拟编程题数据');
                    return {
                        success: true,
                        task: {
                            type: 'coding',
                            animation_type: '表格',
                            ppt_slide: {
                                title: '函数编程实践',
                                content: [
                                    '[ANIMATION:table_demo]\ntable_data：{"headers":["参数","类型","返回值"],"rows":[["a","int",""],["b","int",""],["result","","a + b"]]}\nanimation_steps：[{"type":"highlight_cell","row":0,"col":0,"message":"函数接受第一个参数a"},{"type":"highlight_cell","row":1,"col":0,"message":"函数接受第二个参数b"},{"type":"update_cell","row":2,"col":2,"value":"a + b","message":"返回两个参数的和"}]\n[/ANIMATION]',
                                    '## 函数编程\n\n**代码复用**的基本单元\n\n- 接受参数返回结果\n- 提高代码可读性'
                                ]
                            },
                            task: {
                                title: '编写一个简单的函数',
                                description: '请编写一个函数，接受两个参数并返回它们的和。',
                                starter_code: 'def add_numbers(a, b):\n    # 请在此处编写您的代码\n    pass\n\n# 测试您的代码\nresult = add_numbers(5, 3)\nprint(result)  # 应输出: 8'
                            }
                        }
                    };
                }
                else {
                    return {
                        success: true,
                        task: {
                            type: 'quiz',
                            animation_type: '无',
                            ppt_slide: {
                                title: '算法基础概念',
                                content: [
                                    '## 算法基础\n\n**问题解决**的步骤序列\n\n- 有明确输入和输出\n- 编程的核心思想'
                                ]
                            },
                            questions: [
                                {
                                    question: '什么是算法？',
                                    options: ['计算机硬件组件', '解决问题的步骤序列', '编程语言'],
                                    answer: '解决问题的步骤序列'
                                }
                            ]
                        }
                    };
                }
            }
        }
        
        const courseContent = window.selectedCourseContent || null;
        
        let currentStepContext = null;
        let animationType = null;
        if (currentPlanData && currentPlanData.plan) {
            const currentStep = currentPlanData.plan.find(step => step.status === '当前进行');
            if (currentStep) {
                currentStepContext = {
                    step_number: currentStep.step,
                    title: currentStep.title,
                    description: currentStep.description,
                    total_steps: currentPlanData.plan.length
                };
                
                // Extract animation_type from current step
                animationType = currentStep.animation_type;
                if (animationType) {
                    console.log('[任务生成] 从学习计划步骤中提取动画类型:', animationType);
                }
            }
        }
        
        const requestBody = {
            task_description: stepDescription,
            use_mock: use_mock
        };
        
        if (courseContent) {
            requestBody.course_content = courseContent;
            console.log('[任务生成] 包含课程内容参考');
        }
        
        if (currentStepContext) {
            requestBody.current_step_context = JSON.stringify(currentStepContext);
            console.log('[任务生成] 包含当前步骤上下文:', currentStepContext);
        }
        
        if (animationType) {
            requestBody.animation_type = animationType;
            console.log('[任务生成] 包含动画类型:', animationType);
        }
        
        const response = await fetch('/api/task/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error('生成任务失败');
        }
        return response.json();
    }

    function getQuizAnswers(numQuestions) {
        const answers = [];
        
        // 获取实际的问题数量
        const questionItems = document.querySelectorAll('.quiz-question-item');
        const actualNumQuestions = questionItems.length;
        
        console.log(`[获取答案] 检测到 ${actualNumQuestions} 道题目`);
        
        // 遍历所有问题获取答案
        for (let i = 0; i < actualNumQuestions; i++) {
            // 先尝试获取选择题答案
            const radioButtons = document.querySelectorAll(`input[name="question${i}"]:checked`);
            if (radioButtons.length > 0) {
                answers.push(radioButtons[0].value);
                console.log(`[获取答案] 题目 ${i + 1} 选择题答案: ${radioButtons[0].value}`);
            } else {
                // 如果没有选择题答案，尝试获取文本输入答案
                const inputField = document.getElementById(`question${i}-input`);
                if (inputField) {
                    const inputValue = inputField.value.trim();
                    answers.push(inputValue);
                    console.log(`[获取答案] 题目 ${i + 1} 文本输入答案: ${inputValue}`);
                } else {
                    // 如果都没有，添加null
                    answers.push(null);
                    console.log(`[获取答案] 题目 ${i + 1} 未找到答案，设为null`);
                }
            }
        }
        
        console.log(`[获取答案] 最终答案数组:`, answers);
        return answers;
    }

    function getCodeEditorContent() {
        if (window.codeEditor) {
            return window.codeEditor.getValue();
        } else {
            console.error("CodeMirror 编辑器实例未找到");
            return '';
        }
    }

    function clearErrorHighlights() {
        document.querySelectorAll('.quiz-option.error, .quiz-input-field.error')
            .forEach(el => el.classList.remove('error'));
    }

    function highlightIncorrectQuizItems(incorrectIndices) {
        console.log(`[错误高亮] 高亮错误的题目索引:`, incorrectIndices);
        
        incorrectIndices.forEach(index => {
            const questionItem = document.querySelectorAll('.quiz-question-item')[index];
            if (questionItem) {
                console.log(`[错误高亮] 高亮题目 ${index + 1}`);
                
                // 高亮选择题选项
                const options = questionItem.querySelectorAll('.quiz-option');
                if (options.length > 0) {
                    options.forEach(opt => opt.classList.add('error'));
                } else {
                    // 高亮文本输入框
                    const inputField = questionItem.querySelector('.quiz-input-field');
                    if (inputField) {
                        inputField.classList.add('error');
                    }
                }
                
                // 可选：为整个问题项添加错误样式
                questionItem.classList.add('question-error');
            } else {
                console.warn(`[错误高亮] 未找到索引为 ${index} 的题目`);
            }
        });
    }

    // --- New function to trigger ability assessment ---
    async function triggerAbilityAssessment(title, description, submission) {
        console.log("[能力评估] 触发对任务的评估:", title);
        try {
            const response = await fetch('/api/user/evaluate_ability', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    task_title: title, 
                    task_description: description,
                    user_submission: submission
                })
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({})); 
                console.error('能力评估 API 请求失败:', response.status, errorData.error || '未知错误');
                return; 
            }
            const data = await response.json();
            
            // 处理分数更新
            if (data.updates && Array.isArray(data.updates)) {
                console.log("[能力评估] 收到分数更新:", data.updates);
                let updated = false;
                data.updates.forEach(update => {
                    const dimension = update.dimension;
                    const increase = parseInt(update.increase);
                    if (dimension && currentAbilityScores.hasOwnProperty(dimension) && !isNaN(increase) && increase > 0) {
                        const oldScore = currentAbilityScores[dimension];
                        currentAbilityScores[dimension] = Math.min(100, Math.max(10, oldScore + increase)); // Cap 10-100
                        console.log(`[能力分数] ${dimension} 更新: ${oldScore} -> ${currentAbilityScores[dimension]} (+${increase})`);
                        updated = true;
                    } else {
                        console.warn("[能力评估] 收到无效的更新项:", update);
                    }
                });
                
                // 如果分数有更新，则刷新雷达图
                if (updated && window.updateRadarChart) {
                    console.log("[能力评估] 调用 updateRadarChart 更新图表");
                    window.updateRadarChart(); // 调用时不传参数，它会读取更新后的 currentAbilityScores
                } else if (!window.updateRadarChart) {
                     console.warn("window.updateRadarChart 函数未找到，无法更新雷达图。");
                }
            } else {
                console.warn("能力评估 API 未返回有效的 updates 列表。", data);
            }
        } catch (error) {
            console.error('触发能力评估时出错:', error);
        }
    }

    // --- 新增：获取当前学习计划步骤信息的辅助函数 ---
    function getCurrentLearningStep() {
        if (currentPlanData && currentPlanData.plan) {
             const currentStepIndex = currentPlanData.plan.findIndex(step => step.status === '当前进行');
             if (currentStepIndex !== -1) {
                 return currentPlanData.plan[currentStepIndex]; // 返回当前步骤对象
             }
         }
         console.error("无法获取当前学习计划步骤信息!");
         return null; 
    }

    // --- 新增：封装获取用户提交内容的逻辑 ---
    function getUserSubmission(taskType, currentActiveTask) {
         if (taskType === 'quiz') {
             return getQuizAnswers(currentActiveTask?.questions?.length || 0);
         } else if (taskType === 'coding') {
             return getCodeEditorContent();
         } else {
             console.error('未知的任务类型无法获取提交内容');
             return null;
         }
    }

    // --- 新增：暴露获取当前分数的函数给 main.js/radar-chart.js ---
    window.getCurrentAbilityScores = function() {
        return currentAbilityScores;
    }
    
    // --- 新增：重置能力分数的函数 ---
    function resetAbilityScores() {
        console.log("[能力分数] 重置为初始值");
        currentAbilityScores = {
            theoretical_knowledge: 10, 
            practical_ability: 10, 
            problem_solving: 10, 
            algorithm_optimization: 10, 
            programming_skills: 10
        };
        // 重置后立即更新雷达图
        if (window.updateRadarChart) {
            window.updateRadarChart(); // 调用时不传参数
        }
    }

    // --- Add Ctrl+L/Cmd+L listener for copying selected task text ---
    document.addEventListener('keydown', (event) => {
        // Check for Ctrl+L (Windows/Linux) or Cmd+L (Mac)
        if ((event.ctrlKey || event.metaKey) && event.key === 'l') {
            let selectedText = window.getSelection().toString().trim();
            const codeTabActive = document.getElementById('codeTab')?.classList.contains('active');

            // If standard selection is empty and code editor is active, try CodeMirror selection
            if (!selectedText && codeTabActive && window.codeEditor) {
                selectedText = window.codeEditor.getSelection().trim();
                console.log('Trying CodeMirror selection:', selectedText);
            }

            if (selectedText.length > 0) {
                // Check if the selection originates from an allowed area
                if (isSelectionInAllowedArea(window.getSelection(), codeTabActive)) {
                    console.log('Ctrl+L detected with selection in allowed area:', selectedText);
                    event.preventDefault(); // Prevent default browser action

                    const chatInput = document.getElementById('chatInput');
                    if (chatInput) {
                        chatInput.value = selectedText;
                        chatInput.focus(); 
                    }
                } else {
                    console.log('Ctrl+L detected, but selection is outside allowed area.');
                }
            } else {
                 console.log('Ctrl+L detected, but no text selected.');
            }
        }
    });

    // Helper function to check if selection originates from allowed areas
    function isSelectionInAllowedArea(selection, isCodeEditorActive) {
        const allowedContainers = [
            document.querySelector('.current-task-title'),
            document.querySelector('.current-task-desc'),
            document.getElementById('quizTab'),      // Quiz tab container
            document.getElementById('notesTab'),    // Notes tab container
            // Add CodeMirror container specifically if needed and available,
            // otherwise checking if the active tab is code might suffice
            // depending on where the selection registers.
            // Let's primarily rely on the active tab check for CodeMirror for now.
        ].filter(el => el != null); // Filter out nulls if elements don't exist

        // Special handling for CodeMirror: If it's active, allow selection
        // (assuming the text came from codeEditor.getSelection() if standard selection was empty)
        if (isCodeEditorActive && window.codeEditor?.getSelection().trim().length > 0) {
            console.log("Allowing selection because CodeMirror is active and has selection.")
            return true; 
        }
        
        // Standard check for other areas
        if (!selection.anchorNode || !selection.focusNode) {
            return false;
        }

        const startNode = selection.anchorNode;
        const endNode = selection.focusNode;

        // Function to check if a node is contained within any allowed container
        const isContained = (node) => {
            let currentNode = node;
            while (currentNode && currentNode !== document.body) {
                if (allowedContainers.some(container => container.contains(currentNode))) {
                    return true;
                }
                currentNode = currentNode.parentNode;
            }
            return false;
        };
        
        // Check if both start and end nodes are within *any* allowed area
        const startInArea = isContained(startNode);
        const endInArea = isContained(endNode);

        return startInArea && endInArea;
    }

    // 添加任务队列事件监听器
    function setupTaskQueueEventListeners() {
        if (!window.taskQueueManager) return;
        
        // 监听任务就绪事件
        window.addEventListener('taskReady', function(event) {
            const { step, taskData } = event.detail;
            console.log(`[事件监听] 步骤${step}任务就绪， 任务类型: ${taskData.type}，step: ${step}, currentDisplayStep: ${window.taskQueueManager.currentDisplayStep}`);
            
            // 如果是当前显示的步骤，立即更新显示
            if (step === window.taskQueueManager.currentDisplayStep) {
                console.log(`[事件监听] 刷新页面`);
                displayTaskContent(taskData);
            }
        });
        
        // 监听任务生成中事件
        window.addEventListener('taskGenerating', function(event) {
            const { step } = event.detail;
            console.log(`[事件监听] 步骤${step}任务生成中`);
            
            if (step === window.taskQueueManager.currentDisplayStep) {
                showTaskGeneratingStatus();
            }
        });
        
        // 监听任务等待事件
        window.addEventListener('taskPending', function(event) {
            const { step } = event.detail;
            console.log(`[事件监听] 步骤${step}任务等待中`);
            
            if (step === window.taskQueueManager.currentDisplayStep) {
                showTaskPendingStatus();
            }
        });
        
        // 监听任务失败事件
        window.addEventListener('taskFailed', function(event) {
            const { step, error } = event.detail;
            console.log(`[事件监听] 步骤${step}任务生成失败:`, error);
            
            if (step === window.taskQueueManager.currentDisplayStep) {
                showTaskFailedStatus();
            }
        });
        
        console.log('[任务队列] 事件监听器已设置');
    }
    
    // 初始化任务队列事件监听器
    setupTaskQueueEventListeners();

    /**
     * Reset submit button to enabled state
     */
    function resetSubmitButtonState() {
        const submitBtn = document.getElementById('submitTaskBtn');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '提交';
        }
    }
    
    /**
     * 刷新当前任务
     */
    async function refreshCurrentTask() {
        if (window.isRefreshingTask) {
            console.log('[刷新任务] 已在进行中，跳过重复调用');
            return;
        }
        
        window.isRefreshingTask = true;
        
        const refreshBtn = document.getElementById('refreshTaskBtn');
        if (!refreshBtn) {
            window.isRefreshingTask = false;
            return;
        }
        
        const currentStep = getCurrentLearningStep();
        if (!currentStep) {
            showNotification('无法找到当前学习步骤', 'error');
            window.isRefreshingTask = false;
            return;
        }
        
        refreshBtn.disabled = true;
        refreshBtn.classList.add('loading');
        
        try {
            console.log(`[刷新任务] 重新生成步骤: ${currentStep.title}`);
            
            showTaskGeneratingStatus();
            
            const taskDescription = `${currentStep.title}: ${currentStep.description}`;
            const courseContent = window.selectedCourseContent || null;
            const requestBody = {
                task_description: taskDescription,
                use_mock: false,
                force_regenerate: true
            };
            
            if (courseContent) {
                requestBody.course_content = courseContent;
                console.log(`[刷新任务] 使用课程内容参考`);
            }
            
            if (window.currentPlanData && window.currentPlanData.plan) {
                const stepInfo = window.currentPlanData.plan.find(s => s.step === currentStep.step);
                if (stepInfo) {
                    const currentStepContext = {
                        step_number: stepInfo.step,
                        title: stepInfo.title,
                        description: stepInfo.description,
                        total_steps: window.currentPlanData.plan.length
                    };
                    requestBody.current_step_context = JSON.stringify(currentStepContext);
                    
                    // Extract animation_type from step
                    if (stepInfo.animation_type) {
                        requestBody.animation_type = stepInfo.animation_type;
                        console.log(`[刷新任务] 动画类型: ${stepInfo.animation_type}`);
                    }
                }
            }
            
            const response = await fetch('/api/task/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success && result.task) {
                displayTaskContent(result.task);
                showNotification('任务已刷新', 'success');
                console.log(`[刷新任务] 成功重新生成任务`);
            } else {
                throw new Error(result.error || '任务刷新失败');
            }
            
        } catch (error) {
            console.error('[刷新任务] 失败:', error);
            showNotification(`刷新任务失败: ${error.message}`, 'error');
        } finally {
            refreshBtn.disabled = false;
            refreshBtn.classList.remove('loading');
            window.isRefreshingTask = false;
        }
    }
    
    /**
     * 缓存当前任务
     */
    async function cacheCurrentTask() {
        if (window.isCachingTask) {
            console.log('[缓存任务] 已在进行中，跳过重复调用');
            return;
        }
        
        window.isCachingTask = true;
        
        const cacheBtn = document.getElementById('cacheTaskBtn');
        if (!cacheBtn) {
            window.isCachingTask = false;
            return;
        }
        
        const currentStep = getCurrentLearningStep();
        const currentTaskData = getCurrentActiveTask();
        
        if (!currentStep) {
            showNotification('无法找到当前学习步骤', 'error');
            window.isCachingTask = false;
            return;
        }
        
        if (!currentTaskData) {
            showNotification('无当前任务数据可缓存', 'error');
            window.isCachingTask = false;
            return;
        }
        
        cacheBtn.disabled = true;
        const originalText = cacheBtn.innerHTML;
        cacheBtn.innerHTML = '<span class="material-icons-outlined btn-icon">hourglass_top</span>';
        
        try {
            const stepName = `步骤${currentStep.step}: ${currentStep.title}`;
            console.log(`[缓存任务] 保存步骤: ${stepName}`);
            
            const response = await fetch('/api/task/cache/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    step_name: stepName,
                    task_data: currentTaskData
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                showNotification('任务已保存到缓存', 'success');
                console.log(`[缓存任务] 保存成功: ${result.message}`);
            } else {
                throw new Error(result.error || '缓存保存失败');
            }
            
        } catch (error) {
            console.error('[缓存任务] 失败:', error);
            showNotification(`缓存任务失败: ${error.message}`, 'error');
        } finally {
            cacheBtn.disabled = false;
            cacheBtn.innerHTML = originalText;
            window.isCachingTask = false;
        }
    }

    // 设置事件监听器 - 确保在所有函数定义之后
    function setupEventListeners() {
        // 刷新任务按钮点击事件
        const refreshTaskBtn = document.getElementById('refreshTaskBtn');
        if (refreshTaskBtn) {
            refreshTaskBtn.addEventListener('click', function() {
                refreshCurrentTask();
            });
        }
        
        // 缓存任务按钮点击事件
        const cacheTaskBtn = document.getElementById('cacheTaskBtn');
        if (cacheTaskBtn) {
            cacheTaskBtn.addEventListener('click', function() {
                cacheCurrentTask();
            });
        }
    }
    
    // 调用设置函数
    setupEventListeners();

    /**
     * 检查是否从课程对话页面跳转而来
     */
    function checkForCourseTransfer() {
        const learningGoal = sessionStorage.getItem('learningGoal');
        const courseDetails = sessionStorage.getItem('courseDetails');
        
        if (learningGoal) {
            console.log('检测到从课程对话页面跳转，学习目标:', learningGoal);
            
            // 填充学习目标输入框
            const learningGoalInput = document.getElementById('learningGoal');
            if (learningGoalInput) {
                learningGoalInput.value = learningGoal;
            }
            
            // 显示课程传递提示
            showCourseTransferNotification(courseDetails);
            
            // 清除sessionStorage
            sessionStorage.removeItem('learningGoal');
            sessionStorage.removeItem('courseDetails');
        }
    }

    /**
     * 显示课程传递提示
     */
    function showCourseTransferNotification(courseDetailsStr) {
        let courseDetails = null;
        try {
            courseDetails = courseDetailsStr ? JSON.parse(courseDetailsStr) : null;
        } catch (e) {
            console.warn('解析课程详情失败:', e);
        }

        // 创建提示框
        const notification = document.createElement('div');
        notification.className = 'course-transfer-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-header">
                    <span class="material-icons-outlined">psychology</span>
                    <h4>欢迎回到学习平台！</h4>
                    <button class="notification-close" onclick="this.parentElement.parentElement.parentElement.remove()">
                        <span class="material-icons-outlined">close</span>
                    </button>
                </div>
                <div class="notification-body">
                    <p>我已经为您准备好了学习目标${courseDetails ? `：<strong>${courseDetails.title}</strong>` : ''}。</p>
                    <p>点击下方按钮开始生成您的个性化学习计划。</p>
                </div>
                <div class="notification-actions">
                    <button class="btn-secondary" onclick="this.parentElement.parentElement.parentElement.remove()">
                        我想修改目标
                    </button>
                    <button class="btn-primary" onclick="startLearningPlanGeneration(); this.parentElement.parentElement.parentElement.remove();">
                        开始生成计划
                    </button>
                </div>
            </div>
        `;

        // 添加样式
        const style = document.createElement('style');
        style.textContent = `
            .course-transfer-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
                z-index: 1000;
                max-width: 400px;
                animation: slideInRight 0.4s ease-out;
                border: 1px solid #e0e0e0;
            }

            .notification-content {
                padding: 20px;
            }

            .notification-header {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 16px;
                position: relative;
            }

            .notification-header .material-icons-outlined {
                color: #4285F4;
                font-size: 28px;
            }

            .notification-header h4 {
                margin: 0;
                color: #333;
                font-weight: 600;
                flex: 1;
            }

            .notification-close {
                position: absolute;
                right: 0;
                top: 0;
                background: none;
                border: none;
                cursor: pointer;
                padding: 4px;
                border-radius: 50%;
                color: #757575;
                transition: background-color 0.3s ease;
            }

            .notification-close:hover {
                background: #f5f5f5;
            }

            .notification-body {
                margin-bottom: 20px;
                line-height: 1.5;
            }

            .notification-body p {
                margin: 0 0 8px 0;
                color: #555;
            }

            .notification-actions {
                display: flex;
                gap: 12px;
                justify-content: flex-end;
            }

            .notification-actions button {
                padding: 8px 16px;
                border: none;
                border-radius: 6px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.3s ease;
            }

            .btn-secondary {
                background: #f8f9fa;
                color: #333;
                border: 1px solid #e0e0e0;
            }

            .btn-secondary:hover {
                background: #e9ecef;
            }

            .btn-primary {
                background: #4285F4;
                color: white;
            }

            .btn-primary:hover {
                background: #3367D6;
            }

            @keyframes slideInRight {
                from {
                    opacity: 0;
                    transform: translateX(100%);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }

            @media (max-width: 768px) {
                .course-transfer-notification {
                    position: fixed;
                    top: 20px;
                    left: 20px;
                    right: 20px;
                    max-width: none;
                }
            }
        `;
        document.head.appendChild(style);

        // 添加到页面
        document.body.appendChild(notification);

        // 5秒后自动淡出（如果用户没有操作）
        setTimeout(() => {
            if (notification.parentElement) {
                notification.style.animation = 'slideOutRight 0.4s ease-out forwards';
                setTimeout(() => {
                    if (notification.parentElement) {
                        notification.remove();
                    }
                }, 400);
            }
        }, 8000);
    }

    /**
     * 开始学习计划生成
     */
    function startLearningPlanGeneration() {
        const learningGoalInput = document.getElementById('learningGoal');
        const createPlanBtn = document.getElementById('createPlanBtn');
        
        if (learningGoalInput && learningGoalInput.value.trim() && createPlanBtn) {
            // 模拟点击生成计划按钮
            createPlanBtn.click();
        }
    }

    // 为样式添加slideOutRight动画
    const additionalStyle = document.createElement('style');
    additionalStyle.textContent = `
        @keyframes slideOutRight {
            from {
                opacity: 1;
                transform: translateX(0);
            }
            to {
                opacity: 0;
                transform: translateX(100%);
            }
        }
    `;
    document.head.appendChild(additionalStyle);
}); 