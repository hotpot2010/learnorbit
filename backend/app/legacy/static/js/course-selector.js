/**
 * 课程选择器模块
 */
document.addEventListener('DOMContentLoaded', function() {
    // DOM元素
    const courseSettingsBtn = document.getElementById('courseSettingsBtn');
    const courseModalOverlay = document.getElementById('courseModalOverlay');
    const courseModalClose = document.getElementById('courseModalClose');
    const courseModalCancel = document.getElementById('courseModalCancel');
    const courseModalConfirm = document.getElementById('courseModalConfirm');
    const courseList = document.getElementById('courseList');
    
    // 当前选中的课程
    let selectedCourse = null;
    
    // 课程数据（从后端获取）
    let coursesData = [];
    
    // 全局变量：保存选中课程的内容文本
    window.selectedCourseContent = null;
    
    // 打开课程选择模态框
    if (courseSettingsBtn) {
        courseSettingsBtn.addEventListener('click', async function() {
            await loadCourses();
            showCourseModal();
        });
    }
    
    // 关闭模态框事件
    if (courseModalClose) {
        courseModalClose.addEventListener('click', hideCourseModal);
    }
    
    if (courseModalCancel) {
        courseModalCancel.addEventListener('click', hideCourseModal);
    }
    
    // 点击遮罩层关闭
    if (courseModalOverlay) {
        courseModalOverlay.addEventListener('click', function(e) {
            if (e.target === courseModalOverlay) {
                hideCourseModal();
            }
        });
    }
    
    // 确认选择课程
    if (courseModalConfirm) {
        courseModalConfirm.addEventListener('click', function() {
            if (selectedCourse) {
                selectCourse(selectedCourse);
                hideCourseModal();
            }
        });
    }
    
    /**
     * 加载课程列表
     */
    async function loadCourses() {
        try {
            const response = await fetch('/api/courses/list');
            if (!response.ok) {
                throw new Error('获取课程列表失败');
            }
            
            const data = await response.json();
            coursesData = data.courses || [];
            renderCourseList();
        } catch (error) {
            console.error('加载课程失败:', error);
            showNotification('加载课程列表失败', 'error');
        }
    }
    
    /**
     * 渲染课程列表
     */
    function renderCourseList() {
        if (!courseList) return;
        
        courseList.innerHTML = '';
        
        coursesData.forEach(course => {
            const courseItem = document.createElement('div');
            courseItem.className = 'course-item';
            courseItem.dataset.courseId = course.id;
            
            courseItem.innerHTML = `
                <div class="course-item-header">
                    <div class="course-icon">
                        ${getCourseIcon(course.type)}
                    </div>
                    <div class="course-info">
                        <h4 class="course-title">${course.title}</h4>
                        <p class="course-subtitle">${course.subtitle}</p>
                    </div>
                </div>
                <div class="course-description">${course.description}</div>
                <div class="course-stats">
                    <div class="course-stat">
                        <span class="material-icons-outlined">schedule</span>
                        <span>${course.duration}</span>
                    </div>
                    <div class="course-stat">
                        <span class="material-icons-outlined">assignment</span>
                        <span>${course.steps}个步骤</span>
                    </div>
                    <div class="course-stat">
                        <span class="material-icons-outlined">trending_up</span>
                        <span>${course.difficulty}</span>
                    </div>
                </div>
            `;
            
            // 添加点击事件
            courseItem.addEventListener('click', function() {
                selectCourseItem(courseItem, course);
            });
            
            courseList.appendChild(courseItem);
        });
    }
    
    /**
     * 选择课程项
     */
    function selectCourseItem(courseItem, course) {
        // 清除之前的选中状态
        document.querySelectorAll('.course-item.selected').forEach(item => {
            item.classList.remove('selected');
        });
        
        // 设置当前选中
        courseItem.classList.add('selected');
        selectedCourse = course;
        
        // 启用确认按钮
        if (courseModalConfirm) {
            courseModalConfirm.disabled = false;
        }
    }
    
    /**
     * 获取课程图标
     */
    function getCourseIcon(type) {
        const icons = {
            'ai': '🤖',
            'programming': '💻',
            'algorithm': '🧮',
            'ml': '🔬',
            'default': '📚'
        };
        return icons[type] || icons.default;
    }
    
    /**
     * 显示课程选择模态框
     */
    function showCourseModal() {
        if (courseModalOverlay) {
            courseModalOverlay.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
    }
    
    /**
     * 隐藏课程选择模态框
     */
    function hideCourseModal() {
        if (courseModalOverlay) {
            courseModalOverlay.classList.remove('show');
            document.body.style.overflow = '';
        }
        
        // 重置选择状态
        selectedCourse = null;
        document.querySelectorAll('.course-item.selected').forEach(item => {
            item.classList.remove('selected');
        });
        
        if (courseModalConfirm) {
            courseModalConfirm.disabled = true;
        }
    }
    
    /**
     * 选择课程并应用
     */
    function selectCourse(course) {
        console.log('选择课程:', course);
        
        // 保存课程内容到全局变量
        window.selectedCourseContent = course.content || null;
        console.log('已保存课程内容到全局变量:', window.selectedCourseContent);
        
        // 显示选择通知
        showNotification(`已选择课程: ${course.title}`, 'success');
        
        // 更新学习目标输入框
        const learningGoalInput = document.getElementById('learningGoal');
        if (learningGoalInput && course.learning_goal) {
            learningGoalInput.value = course.learning_goal;
        }
        
        // 触发课程选择事件，其他模块可以监听
        const courseSelectedEvent = new CustomEvent('courseSelected', {
            detail: course
        });
        window.dispatchEvent(courseSelectedEvent);
        
        // 可以在这里自动触发生成学习计划
        // const createPlanBtn = document.getElementById('createPlanBtn');
        // if (createPlanBtn) {
        //     createPlanBtn.click();
        // }
    }
    
    /**
     * 显示通知消息
     */
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 500);
        }, 3000);
    }
    
    // 暴露给全局的方法
    window.courseSelector = {
        showModal: showCourseModal,
        hideModal: hideCourseModal,
        getSelectedCourse: () => selectedCourse
    };
}); 