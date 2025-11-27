class TaskQueueManager {
    constructor() {
        this.queue = [];
        this.maxConcurrent = 3;
        this.currentlyGenerating = new Set();
        this.completedTasks = new Map();
        this.currentDisplayStep = null;
        
        console.log('[任务队列] TaskQueueManager初始化完成');
    }

    /**
     * 打印队列状态
     */
    printQueueStatus(action = '') {
        const status = this.getQueueStatus();
        const queueDetails = this.queue.map(item => 
            `步骤${item.step}(${item.status})`
        ).join(', ');
        
        console.log(`[任务队列${action ? ' - ' + action : ''}] 当前状态: 总数${status.total}, 待处理${status.pending}, 生成中${status.generating}, 已完成${status.ready}, 失败${status.failed}`);
        if (queueDetails) {
            console.log(`[任务队列${action ? ' - ' + action : ''}] 队列详情: [${queueDetails}]`);
        }
    }

    /**
     * 添加步骤到队列
     */
    addStep(step) {
        const stepNumber = parseInt(step.step);
        
        if (this.queue.find(item => item.step === stepNumber)) {
            console.log(`[任务队列] 步骤${stepNumber}已存在，跳过添加`);
            return;
        }

        const queueItem = {
            step: stepNumber,
            title: step.title,
            description: step.description,
            animation_type: step.animation_type || '无',
            status: 'pending',
            taskData: null,
            addedAt: Date.now()
        };

        this.queue.push(queueItem);
        console.log(`[任务队列] 添加步骤${stepNumber}: ${step.title}, 动画类型: ${queueItem.animation_type}`);
        
        this.printQueueStatus('生产任务');
        
        this.processQueue();
    }

    /**
     * 处理队列
     */
    async processQueue() {
        const pendingItems = this.queue.filter(item => item.status === 'pending');
        const canGenerate = this.maxConcurrent - this.currentlyGenerating.size;
        
        console.log(`[任务队列 - 处理队列] 检查队列: 待处理${pendingItems.length}个, 可生成${canGenerate}个, 当前生成中${this.currentlyGenerating.size}个`);
        console.log(`[任务队列 - 处理队列] 生成中的步骤: [${Array.from(this.currentlyGenerating).join(', ')}]`);
        
        if (canGenerate <= 0) {
            console.log(`[任务队列 - 处理队列] 已达到最大并发限制(${this.maxConcurrent})，等待中`);
            return;
        }
        
        if (pendingItems.length === 0) {
            console.log(`[任务队列 - 处理队列] 没有待处理的任务`);
            return;
        }

        const itemsToGenerate = pendingItems.slice(0, canGenerate);
        console.log(`[任务队列 - 处理队列] 准备生成${itemsToGenerate.length}个任务: [${itemsToGenerate.map(item => `步骤${item.step}`).join(', ')}]`);
        
        for (const item of itemsToGenerate) {
            console.log(`[任务队列 - 处理队列] 启动生成任务: 步骤${item.step}`);
            this.generateTask(item);
        }
    }

    /**
     * 生成单个任务
     */
    async generateTask(queueItem) {
        const { step, title, description, animation_type } = queueItem;
        
        if (this.currentlyGenerating.has(step)) {
            console.log(`[任务队列] 步骤${step}已在生成中，跳过`);
            return;
        }

        this.currentlyGenerating.add(step);
        queueItem.status = 'generating';
        
        console.log(`[任务队列] 开始生成步骤${step}任务`);
        this.printQueueStatus('开始消费');
        
        this.dispatchEvent('taskGenerating', { step });

        try {
            console.log(`[--------------] 开始生成步骤${description}任务`);
            const taskDescription = `${title}: ${description}`;
          
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000);
            
            const courseContent = window.selectedCourseContent || null;
            const requestBody = {
                step_number: step,
                title: title,
                task_description: taskDescription,
                use_mock: false
            };
            
            if (courseContent) {
                requestBody.course_content = courseContent;
                console.log(`[任务队列] 步骤${step}使用课程内容参考`);
            }
            
            // 优先使用 queueItem 中的 animation_type
            if (animation_type) {
                requestBody.animation_type = animation_type;
                console.log(`[任务队列] 步骤${step}动画类型: ${animation_type}`);
            }
            
            if (window.currentPlanData && window.currentPlanData.plan) {
                const stepInfo = window.currentPlanData.plan.find(s => s.step === step);
                if (stepInfo) {
                    const currentStepContext = {
                        step_number: stepInfo.step,
                        title: stepInfo.title,
                        description: stepInfo.description,
                        total_steps: window.currentPlanData.plan.length
                    };
                    requestBody.current_step_context = JSON.stringify(currentStepContext);
                    console.log(`[任务队列] 步骤${step}包含步骤上下文:`, currentStepContext);
                    
                    // 如果 queueItem 中没有 animation_type，则从 stepInfo 中获取
                    if (!animation_type && stepInfo.animation_type) {
                        requestBody.animation_type = stepInfo.animation_type;
                        console.log(`[任务队列] 步骤${step}动画类型(从stepInfo): ${stepInfo.animation_type}`);
                    }
                }
            }
            
            const response = await fetch('/api/task/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            
            if (result.success && result.task) {
                queueItem.status = 'ready';
                queueItem.taskData = result.task;
                
                console.log(`[任务队列] 步骤${step}任务生成成功`);
                this.printQueueStatus('完成消费');
                
                this.dispatchEvent('taskReady', { 
                    step, 
                    taskData: result.task 
                });
            } else {
                throw new Error(result.error || '任务生成失败');
            }
        } catch (error) {
            console.error(`[任务队列] 步骤${step}任务生成失败:`, error);
            queueItem.status = 'failed';
            queueItem.error = error.message;
            
            this.printQueueStatus('消费失败');
            
            this.dispatchEvent('taskFailed', { 
                step, 
                error: error.message 
            });
        } finally {
            this.currentlyGenerating.delete(step);
            console.log(`[任务队列] 步骤${step}任务处理完成，从生成中移除`);
            this.processQueue();
        }
    }

    /**
     * 获取任务状态
     */
    getTaskStatus(step) {
        const queueItem = this.queue.find(item => item.step === parseInt(step));
        return queueItem ? queueItem.status : null;
    }

    /**
     * 获取指定步骤的任务数据
     */
    getTaskForStep(step) {
        const queueItem = this.queue.find(item => item.step === parseInt(step));
        return queueItem && queueItem.status === 'ready' ? queueItem.taskData : null;
    }

    /**
     * 设置当前显示步骤
     */
    setCurrentDisplayStep(step) {
        this.currentDisplayStep = parseInt(step);
        console.log(`[任务队列] 设置当前显示步骤: ${step}`);
    }

    /**
     * 清空队列
     */
    clearQueue() {
        this.queue = [];
        this.currentlyGenerating.clear();
        this.completedTasks.clear();
        this.currentDisplayStep = null;
        
        console.log('[任务队列] 队列已清空');
        this.printQueueStatus('清空队列');
    }

    /**
     * 分发事件
     */
    dispatchEvent(eventType, data) {
        const event = new CustomEvent(eventType, { detail: data });
        window.dispatchEvent(event);
    }

    /**
     * 获取队列状态
     */
    getQueueStatus() {
        return {
            total: this.queue.length,
            pending: this.queue.filter(item => item.status === 'pending').length,
            generating: this.queue.filter(item => item.status === 'generating').length,
            ready: this.queue.filter(item => item.status === 'ready').length,
            failed: this.queue.filter(item => item.status === 'failed').length
        };
    }
}

window.taskQueueManager = new TaskQueueManager(); 