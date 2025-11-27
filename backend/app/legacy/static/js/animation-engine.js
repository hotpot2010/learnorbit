/**
 * 动画引擎 - 解析和渲染PPT中的动画内容
 */

class AnimationEngine {
    constructor() {
        this.animationTypes = {
            'maze_demo': MazeAnimator,
            'table_demo': TableAnimator,
            'sorting_demo': SortingAnimator,
            'tree_demo': TreeAnimator
        };
        
        // 添加动画样式
        this.injectAnimationStyles();
    }
    
    injectAnimationStyles() {
        // 检查是否已经添加过样式
        if (document.querySelector('#animation-engine-styles')) {
            return;
        }
        
        const style = document.createElement('style');
        style.id = 'animation-engine-styles';
        style.textContent = `
            @keyframes pulse {
                0% { transform: scale(1) translateY(0); }
                50% { transform: scale(1.05) translateY(-2px); }
                100% { transform: scale(1) translateY(0); }
            }
            
            @keyframes fadeInUp {
                0% { opacity: 0; transform: translateY(20px); }
                100% { opacity: 1; transform: translateY(0); }
            }
            
            .animation-description {
                animation: fadeInUp 0.5s ease-out;
            }
            
            .table-cell-highlight {
                transition: all 0.3s ease;
            }
            
            .table-row-highlight {
                transition: all 0.3s ease;
            }
        `;
        
        document.head.appendChild(style);
    }

    /**
     * 解析PPT内容中的动画指令
     * @param {Array} pptContent - PPT内容数组
     * @returns {Object} - 解析结果包含动画配置和普通文本
     */
    parseContent(pptContent) {
        const result = {
            animations: [],
            textContent: []
        };

        pptContent.forEach(item => {
            const animationMatch = this.parseAnimationBlock(item);
            if (animationMatch) {
                result.animations.push(animationMatch);
            } else {
                result.textContent.push(item);
            }
        });

        return result;
    }

    /**
     * 解析单个动画块
     * @param {string} content - 内容字符串
     * @returns {Object|null} - 动画配置对象或null
     */
    parseAnimationBlock(content) {
        const animationRegex = /\[ANIMATION:(\w+)\](.*?)\[\/ANIMATION\]/s;
        const match = content.match(animationRegex);
        
        console.log('[动画解析] 尝试解析内容:', content);
        
        if (!match) {
            console.log('[动画解析] 未匹配到动画块');
            return null;
        }

        const animationType = match[1];
        const configText = match[2];
        
        console.log('[动画解析] 动画类型:', animationType);
        console.log('[动画解析] 配置文本:', configText);
        
        const config = this.parseAnimationConfig(configText);
        console.log('[动画解析] 解析后的配置:', config);
        
        return {
            type: animationType,
            config: config
        };
    }

    /**
     * 解析动画配置参数
     * @param {string} configText - 配置文本
     * @returns {Object} - 配置对象
     */
    parseAnimationConfig(configText) {
        const config = {};
        
        console.log('[动画解析] 开始解析配置文本:', configText);
        
        // 支持多种分隔符：换行、分号、空格（连续参数）
        let lines;
        if (configText.includes('\n')) {
            lines = configText.split('\n').filter(line => line.trim());
        } else if (configText.includes(';')) {
            lines = configText.split(';').filter(line => line.trim());
        } else {
            // 处理空格分隔的情况，寻找参数模式
            lines = [];
            const paramPattern = /(\w+)：([^：]+?)(?=\s+\w+：|$)/g;
            let match;
            while ((match = paramPattern.exec(configText)) !== null) {
                lines.push(`${match[1]}：${match[2].trim()}`);
            }
        }
        
        console.log('[动画解析] 分割后的行数:', lines.length, lines);
        
        lines.forEach(line => {
            // 优先查找中文冒号，如果没有则查找英文冒号
            let colonIndex = line.indexOf('：');
            if (colonIndex === -1) {
                colonIndex = line.indexOf(':');
            }
            
            console.log('[动画解析] 处理行:', line, '冒号位置:', colonIndex);
            
            if (colonIndex > 0) {
                const key = line.substring(0, colonIndex).trim();
                const value = line.substring(colonIndex + 1).trim();
                console.log('[动画解析] 解析键值对:', key, '=', value);
                config[key] = this.parseValue(value);
            }
        });
        
        console.log('[动画解析] 最终配置:', config);
        return config;
    }

    /**
     * 解析参数值
     * @param {string} value - 原始值字符串
     * @returns {any} - 解析后的值
     */
    parseValue(value) {
        // 解析JSON数组 - 处理表格数据和动画步骤
        if (value.startsWith('[') && value.endsWith(']')) {
            try {
                // 尝试直接解析JSON
                return JSON.parse(value);
            } catch (e) {
                // 如果直接解析失败，尝试处理特殊格式
                console.warn('[动画解析] JSON解析失败，尝试特殊处理:', value);
                
                // 处理表格数据格式：[["row1col1", "row1col2"], ["row2col1", "row2col2"]]
                if (value.includes('["') || value.includes("['")) {
                    try {
                        // 替换单引号为双引号
                        const normalizedValue = value.replace(/'/g, '"');
                        return JSON.parse(normalizedValue);
                    } catch (e2) {
                        console.warn('[动画解析] 标准化JSON解析也失败:', e2);
                    }
                }
                
                // 处理动画步骤格式
                if (value.includes('"type"') || value.includes("'type'")) {
                    try {
                        // 替换单引号为双引号
                        const normalizedValue = value.replace(/'/g, '"');
                        return JSON.parse(normalizedValue);
                    } catch (e2) {
                        console.warn('[动画解析] 动画步骤解析失败:', e2);
                    }
                }
            }
        }
        
        // 解析坐标 (x,y)
        if (value.match(/^\(\d+,\d+\)$/)) {
            const coords = value.slice(1, -1).split(',');
            return { x: parseInt(coords[0]), y: parseInt(coords[1]) };
        }
        
        // 解析坐标数组 [(x1,y1),(x2,y2)]
        if (value.startsWith('[') && value.endsWith(']') && value.includes('(')) {
            const coordMatches = value.match(/\(\d+,\d+\)/g);
            if (coordMatches) {
                return coordMatches.map(coord => {
                    const [x, y] = coord.slice(1, -1).split(',');
                    return { x: parseInt(x), y: parseInt(y) };
                });
            }
        }
        
        // 解析路径 [x,y→x,y→x,y]
        if (value.includes('→')) {
            return value.split('|').map(pathStr => {
                const pathMatch = pathStr.match(/\[(.*?)\]/);
                if (pathMatch) {
                    const label = pathStr.replace(/\[.*?\]/, '').trim();
                    const coords = pathMatch[1].split('→').map(coord => {
                        const [x, y] = coord.split(',');
                        return { x: parseInt(x), y: parseInt(y) };
                    });
                    return { label, path: coords };
                }
                return null;
            }).filter(Boolean);
        }
        
        // 解析网格尺寸 5x5
        if (value.match(/^\d+x\d+$/)) {
            const [width, height] = value.split('x');
            return { width: parseInt(width), height: parseInt(height) };
        }
        
        // 解析数字
        if (/^\d+$/.test(value)) {
            return parseInt(value);
        }
        
        // 处理特殊值
        if (value === '随机分布' || value === 'random' || value.includes('随机')) {
            return 'random';
        }
        
        // 如果是简单的描述性文本，尝试生成默认路径
        if (value.includes('路径') && !value.includes('→')) {
            return 'generate_demo_path';
        }
        
        return value;
    }

    /**
     * 渲染动画到指定容器
     * @param {Array} animations - 动画配置数组
     * @param {HTMLElement} container - 目标容器
     */
    renderAnimations(animations, container) {
        console.log('[动画渲染] 开始渲染动画，共', animations.length, '个动画');
        animations.forEach(animation => {
            const AnimatorClass = this.animationTypes[animation.type];
            if (AnimatorClass) {
                console.log('[动画渲染] 渲染动画类型:', animation.type);
                const animator = new AnimatorClass(animation.config);
                animator.render(container);
            } else {
                console.warn(`不支持的动画类型: ${animation.type}`);
                // 对于不支持的动画类型，显示一个提示信息而不是报错
                this.renderUnsupportedAnimation(animation, container);
            }
        });
    }

    /**
     * 渲染不支持的动画类型的占位符
     * @param {Object} animation - 动画配置
     * @param {HTMLElement} container - 目标容器
     */
    renderUnsupportedAnimation(animation, container) {
        const placeholder = document.createElement('div');
        placeholder.style.cssText = `
            padding: 15px;
            background: #f8f9fa;
            border: 1px dashed #dee2e6;
            border-radius: 4px;
            text-align: center;
            color: #6c757d;
            font-size: 14px;
            margin: 10px 0;
        `;
        placeholder.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 5px;">动画演示</div>
            <small>类型: ${animation.type} (暂不支持)</small>
        `;
        container.appendChild(placeholder);
    }
}

/**
 * 迷宫动画器
 */
class MazeAnimator {
    constructor(config) {
        this.config = config;
        this.canvas = null;
        this.ctx = null;
        this.cellSize = 40;
        this.currentAnimation = null;
        
        // 处理特殊配置
        this.processConfig();
    }
    
    processConfig() {
        // 处理随机墙壁
        if (this.config.walls === 'random') {
            this.config.walls = this.generateRandomWalls();
        }
        
        // 处理自动路径生成
        if (this.config.demo_paths === 'generate_demo_path') {
            this.config.demo_paths = this.generateDemoPaths();
        }
    }
    
    generateRandomWalls() {
        const gridSize = this.config.grid_size || { width: 5, height: 5 };
        const walls = [];
        const wallCount = Math.floor((gridSize.width * gridSize.height) * 0.2); // 20%的格子是墙
        
        for (let i = 0; i < wallCount; i++) {
            let wall;
            do {
                wall = {
                    x: Math.floor(Math.random() * gridSize.width),
                    y: Math.floor(Math.random() * gridSize.height)
                };
            } while (
                this.isPositionOccupied(wall, walls) || 
                this.isStartOrGoal(wall)
            );
            walls.push(wall);
        }
        
        return walls;
    }
    
    generateDemoPaths() {
        const start = this.config.start_pos || { x: 0, y: 0 };
        const goal = this.config.goal_pos || { x: 4, y: 4 };
        
        // 生成一条简单的最短路径（右下移动）
        const optimalPath = [];
        let current = { x: start.x, y: start.y };
        optimalPath.push({ ...current });
        
        // 先向右移动到目标x坐标
        while (current.x < goal.x) {
            current.x++;
            optimalPath.push({ ...current });
        }
        
        // 再向下移动到目标y坐标
        while (current.y < goal.y) {
            current.y++;
            optimalPath.push({ ...current });
        }
        
        return [
            {
                label: '最短路径',
                path: optimalPath
            }
        ];
    }
    
    isPositionOccupied(pos, walls) {
        return walls.some(wall => wall.x === pos.x && wall.y === pos.y);
    }
    
    isStartOrGoal(pos) {
        const start = this.config.start_pos || { x: 0, y: 0 };
        const goal = this.config.goal_pos || { x: 4, y: 4 };
        return (pos.x === start.x && pos.y === start.y) || 
               (pos.x === goal.x && pos.y === goal.y);
    }

    render(container) {
        console.log('[迷宫动画] 开始渲染，配置:', this.config);
        
        // 验证必要的配置
        if (!this.validateConfig()) {
            this.renderErrorMessage(container);
            return;
        }
        
        try {
            this.createCanvas(container);
            this.drawGrid();
            this.autoPlayDemo();
        } catch (error) {
            console.error('[迷宫动画] 渲染失败:', error);
            this.renderErrorMessage(container, error.message);
        }
    }
    
    validateConfig() {
        const { grid_size, start_pos, goal_pos } = this.config;
        
        // 检查网格尺寸
        if (!grid_size || !grid_size.width || !grid_size.height) {
            console.warn('[迷宫动画] 缺少有效的网格尺寸');
            return false;
        }
        
        // 检查起点终点
        if (!start_pos || start_pos.x === undefined || start_pos.y === undefined) {
            console.warn('[迷宫动画] 缺少有效的起点坐标');
            return false;
        }
        
        if (!goal_pos || goal_pos.x === undefined || goal_pos.y === undefined) {
            console.warn('[迷宫动画] 缺少有效的终点坐标');
            return false;
        }
        
        return true;
    }
    
    renderErrorMessage(container, errorMsg = '动画配置无效') {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            padding: 20px;
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 4px;
            color: #856404;
            text-align: center;
            font-size: 14px;
        `;
        errorDiv.innerHTML = `
            <strong>⚠️ 动画演示不可用</strong><br>
            <small>${errorMsg}</small>
        `;
        container.appendChild(errorDiv);
    }

    createCanvas(container) {
        const gridSize = this.config.grid_size || { width: 5, height: 5 };
        const canvasWidth = gridSize.width * this.cellSize;
        const canvasHeight = gridSize.height * this.cellSize;

        this.canvas = document.createElement('canvas');
        this.canvas.width = canvasWidth;
        this.canvas.height = canvasHeight;
        this.canvas.style.border = '2px solid #4285F4';
        this.canvas.style.marginBottom = '10px';
        
        this.ctx = this.canvas.getContext('2d');
        container.appendChild(this.canvas);
    }

    drawGrid() {
        const gridSize = this.config.grid_size || { width: 5, height: 5 };
        
        // 清空画布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 绘制网格
        this.ctx.strokeStyle = '#ddd';
        this.ctx.lineWidth = 1;
        
        for (let x = 0; x <= gridSize.width; x++) {
            this.ctx.beginPath();
            this.ctx.moveTo(x * this.cellSize, 0);
            this.ctx.lineTo(x * this.cellSize, this.canvas.height);
            this.ctx.stroke();
        }
        
        for (let y = 0; y <= gridSize.height; y++) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y * this.cellSize);
            this.ctx.lineTo(this.canvas.width, y * this.cellSize);
            this.ctx.stroke();
        }
        
        // 绘制起点和终点
        this.drawCell(this.config.start_pos, '#4CAF50', 'S');
        this.drawCell(this.config.goal_pos, '#FF5722', 'G');
        
        // 绘制墙壁
        if (this.config.walls) {
            this.config.walls.forEach(wall => {
                this.drawCell(wall, '#616161', '█');
            });
        }
    }

    drawCell(pos, color, text) {
        if (!pos) return;
        
        const x = pos.x * this.cellSize;
        const y = pos.y * this.cellSize;
        
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x + 2, y + 2, this.cellSize - 4, this.cellSize - 4);
        
        if (text) {
            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 16px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(text, x + this.cellSize/2, y + this.cellSize/2);
        }
    }

    async autoPlayDemo() {
        if (!this.config.demo_paths) return;
        
        // 延迟1秒后开始播放
        await this.delay(1000);
        
        for (const pathData of this.config.demo_paths) {
            await this.animatePath(pathData);
            await this.delay(1500); // 路径间停顿
        }
        
        // 播放完成后重新开始（循环播放）
        setTimeout(() => this.autoPlayDemo(), 3000);
    }

    async animatePath(pathData) {
        this.drawGrid(); // 重置网格
        
        // 显示路径标签
        const label = document.createElement('div');
        label.textContent = pathData.label;
        label.style.position = 'absolute';
        label.style.fontSize = '14px';
        label.style.fontWeight = 'bold';
        label.style.color = '#4285F4';
        label.style.zIndex = '10';
        this.canvas.parentElement.style.position = 'relative';
        this.canvas.parentElement.appendChild(label);
        
        // 动画路径
        for (let i = 0; i < pathData.path.length; i++) {
            const pos = pathData.path[i];
            
            // 检查是否撞墙
            if (this.isWall(pos)) {
                this.drawCell(pos, '#F44336', '✗');
                this.showReward(pos, '-10', '#F44336');
                break;
            }
            
            // 绘制当前位置
            this.drawCell(pos, '#2196F3', '●');
            
            // 显示奖励
            if (i > 0) { // 不是起点
                if (this.isGoal(pos)) {
                    this.showReward(pos, '+100', '#4CAF50');
                } else {
                    this.showReward(pos, '-1', '#FF9800');
                }
            }
            
            await this.delay(600);
        }
        
        // 清理标签
        setTimeout(() => {
            if (label.parentElement) {
                label.parentElement.removeChild(label);
            }
        }, 500);
    }

    showReward(pos, text, color) {
        const x = pos.x * this.cellSize + this.cellSize/2;
        const y = pos.y * this.cellSize - 10;
        
        this.ctx.fillStyle = color;
        this.ctx.font = 'bold 12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(text, x, y);
    }

    isWall(pos) {
        return this.config.walls && this.config.walls.some(wall => 
            wall.x === pos.x && wall.y === pos.y
        );
    }

    isGoal(pos) {
        const goal = this.config.goal_pos;
        return goal && goal.x === pos.x && goal.y === pos.y;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * 排序动画器（占位符）
 */
class SortingAnimator {
    constructor(config) {
        this.config = config;
    }

    render(container) {
        const placeholder = document.createElement('div');
        placeholder.textContent = '排序动画演示 (待实现)';
        placeholder.style.padding = '20px';
        placeholder.style.textAlign = 'center';
        placeholder.style.border = '1px dashed #ccc';
        container.appendChild(placeholder);
    }
}

/**
 * 树形结构动画器（占位符）
 */
class TreeAnimator {
    constructor(config) {
        this.config = config;
    }

    render(container) {
        const placeholder = document.createElement('div');
        placeholder.textContent = '树结构动画演示 (待实现)';
        placeholder.style.padding = '20px';
        placeholder.style.textAlign = 'center';
        placeholder.style.border = '1px dashed #ccc';
        container.appendChild(placeholder);
    }
}

/**
 * 表格动画器
 */
class TableAnimator {
    constructor(config) {
        this.config = config;
        this.table = null;
        this.currentAnimation = null;
        
        // 处理特殊配置
        this.processConfig();
    }
    
    processConfig() {
        // 处理表头数据
        if (this.config.headers && typeof this.config.headers === 'string') {
            try {
                // 如果是字符串格式的数组，尝试解析
                if (this.config.headers.startsWith('[')) {
                    this.config.headers = JSON.parse(this.config.headers);
                } else {
                    // 处理逗号分隔的字符串
                    this.config.headers = this.config.headers.split(',').map(h => h.trim().replace(/['"]/g, ''));
                }
            } catch (e) {
                console.warn('[表格动画] 解析表头失败:', e);
                this.config.headers = [];
            }
        }
        
        // 处理表格数据
        if (this.config.table_data && typeof this.config.table_data === 'string') {
            try {
                // 如果是字符串格式的数组，尝试解析
                if (this.config.table_data.startsWith('[')) {
                    this.config.table_data = JSON.parse(this.config.table_data);
                }
            } catch (e) {
                console.warn('[表格动画] 解析表格数据失败:', e);
                this.config.table_data = [];
            }
        }
        
        // 处理动画步骤
        if (this.config.animation_steps && typeof this.config.animation_steps === 'string') {
            try {
                this.config.animation_steps = JSON.parse(this.config.animation_steps);
            } catch (e) {
                console.warn('[表格动画] 解析动画步骤失败:', e);
                this.config.animation_steps = [];
            }
        }
        
        // 处理动画延迟
        if (this.config.animation_delay && typeof this.config.animation_delay === 'string') {
            this.config.animation_delay = parseInt(this.config.animation_delay) || 800;
        }
        
        // 设置默认值
        this.config.table_data = this.config.table_data || [];
        this.config.animation_steps = this.config.animation_steps || [];
        this.config.headers = this.config.headers || [];
        this.config.title = this.config.title || '数据表格';
        this.config.animation_delay = this.config.animation_delay || 800;
        
        // 验证和修复数据
        this.validateAndFixData();
        
        console.log('[表格动画] 配置处理完成:', this.config);
    }
    
    validateAndFixData() {
        // 确保表格数据是二维数组
        if (!Array.isArray(this.config.table_data)) {
            this.config.table_data = [];
        }
        
        // 确保每行数据都是数组
        this.config.table_data = this.config.table_data.map(row => {
            if (!Array.isArray(row)) {
                return [row];
            }
            return row;
        });
        
        // 确保表头数量与列数匹配
        if (this.config.table_data.length > 0) {
            const maxCols = Math.max(...this.config.table_data.map(row => row.length));
            if (this.config.headers.length < maxCols) {
                // 补充缺失的表头
                for (let i = this.config.headers.length; i < maxCols; i++) {
                    this.config.headers.push(`列${i + 1}`);
                }
            }
        }
        
        // 确保动画步骤格式正确
        if (Array.isArray(this.config.animation_steps)) {
            this.config.animation_steps = this.config.animation_steps.filter(step => {
                return step && typeof step === 'object' && step.type;
            });
        }
    }

    render(container) {
        console.log('[表格动画] 开始渲染，配置:', this.config);
        
        // 验证必要的配置
        if (!this.validateConfig()) {
            this.renderErrorMessage(container);
            return;
        }
        
        try {
            this.createTable(container);
            this.displayInitialData();
            this.autoPlayAnimations();
        } catch (error) {
            console.error('[表格动画] 渲染失败:', error);
            this.renderErrorMessage(container, error.message);
        }
    }
    
    validateConfig() {
        const { table_data, headers } = this.config;
        
        // 检查表格数据
        if (!table_data || !Array.isArray(table_data)) {
            console.warn('[表格动画] 缺少有效的表格数据');
            return false;
        }
        
        // 检查表头
        if (!headers || !Array.isArray(headers) || headers.length === 0) {
            console.warn('[表格动画] 缺少有效的表头');
            return false;
        }
        
        return true;
    }
    
    renderErrorMessage(container, errorMsg = '表格动画配置无效') {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            padding: 20px;
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 4px;
            color: #856404;
            text-align: center;
            font-size: 14px;
        `;
        errorDiv.innerHTML = `
            <strong>⚠️ 表格动画演示不可用</strong><br>
            <small>${errorMsg}</small>
        `;
        container.appendChild(errorDiv);
    }

    createTable(container) {
        // 创建表格标题
        const titleElement = document.createElement('h4');
        titleElement.textContent = this.config.title;
        titleElement.style.cssText = `
            margin: 0 0 15px 0;
            text-align: center;
            color: #4285F4;
            font-size: 16px;
        `;
        container.appendChild(titleElement);
        
        // 创建表格容器
        const tableContainer = document.createElement('div');
        tableContainer.style.cssText = `
            overflow-x: auto;
            border: 1px solid #ddd;
            border-radius: 4px;
            margin-bottom: 15px;
        `;
        
        // 创建表格
        this.table = document.createElement('table');
        this.table.style.cssText = `
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
            background: white;
        `;
        
        // 创建表头
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        headerRow.style.background = '#f8f9fa';
        
        this.config.headers.forEach(header => {
            const th = document.createElement('th');
            th.textContent = header;
            th.style.cssText = `
                padding: 12px 8px;
                border: 1px solid #ddd;
                text-align: center;
                font-weight: bold;
                color: #333;
            `;
            headerRow.appendChild(th);
        });
        
        thead.appendChild(headerRow);
        this.table.appendChild(thead);
        
        // 创建表体
        const tbody = document.createElement('tbody');
        this.table.appendChild(tbody);
        
        tableContainer.appendChild(this.table);
        container.appendChild(tableContainer);
    }
    
    displayInitialData() {
        const tbody = this.table.querySelector('tbody');
        tbody.innerHTML = '';
        
        // 显示初始数据
        this.config.table_data.forEach((rowData, index) => {
            const row = this.createRow(rowData, index);
            tbody.appendChild(row);
        });
    }
    
    createRow(rowData, rowIndex) {
        const row = document.createElement('tr');
        row.style.cssText = `
            transition: all 0.3s ease;
        `;
        row.setAttribute('data-row-index', rowIndex);
        
        this.config.headers.forEach((header, colIndex) => {
            const td = document.createElement('td');
            td.textContent = rowData[colIndex] || '';
            td.style.cssText = `
                padding: 10px 8px;
                border: 1px solid #ddd;
                text-align: center;
                transition: all 0.3s ease;
            `;
            td.setAttribute('data-col-index', colIndex);
            row.appendChild(td);
        });
        
        return row;
    }
    
    async autoPlayAnimations() {
        if (!this.config.animation_steps || this.config.animation_steps.length === 0) {
            return;
        }
        
        // 延迟1秒后开始播放
        await this.delay(1000);
        
        await this.playAnimationSequence();
        
        // 播放完成后重新开始（循环播放）
        setTimeout(() => this.autoPlayAnimations(), 3000);
    }
    
    async playAnimationSequence() {
        for (const step of this.config.animation_steps) {
            await this.executeAnimationStep(step);
            await this.delay(this.config.animation_delay);
        }
    }
    
    async executeAnimationStep(step) {
        const { type, description } = step;
        
        // 显示动画描述
        this.showStepDescription(description);
        
        try {
            switch (type) {
                case 'highlight_cell':
                    if (this.isValidCell(step.row, step.col)) {
                        this.highlightCell(step.row, step.col, step.color || '#FFE082');
                    } else {
                        console.warn(`[表格动画] 无效的单元格位置: 行${step.row}, 列${step.col}`);
                    }
                    break;
                case 'highlight_row':
                    if (this.isValidRow(step.row)) {
                        this.highlightRow(step.row, step.color || '#E3F2FD');
                    } else {
                        console.warn(`[表格动画] 无效的行位置: ${step.row}`);
                    }
                    break;
                case 'highlight_column':
                    if (this.isValidColumn(step.col)) {
                        this.highlightColumn(step.col, step.color || '#F3E5F5');
                    } else {
                        console.warn(`[表格动画] 无效的列位置: ${step.col}`);
                    }
                    break;
                case 'update_cell':
                    if (this.isValidCell(step.row, step.col)) {
                        this.updateCell(step.row, step.col, step.value, step.highlight_color);
                    } else {
                        console.warn(`[表格动画] 无效的单元格位置: 行${step.row}, 列${step.col}`);
                    }
                    break;
                case 'add_row':
                    if (step.data && Array.isArray(step.data)) {
                        this.addRow(step.data, step.highlight_color);
                    } else {
                        console.warn(`[表格动画] 添加行需要有效的数据数组`);
                    }
                    break;
                case 'remove_row':
                    if (this.isValidRow(step.row)) {
                        this.removeRow(step.row);
                    } else {
                        console.warn(`[表格动画] 无效的行位置: ${step.row}`);
                    }
                    break;
                case 'clear_highlights':
                    this.clearAllHighlights();
                    break;
                case 'reset_table':
                    this.resetTable();
                    break;
                default:
                    console.warn(`[表格动画] 未知的动画步骤类型: ${type}`);
            }
        } catch (error) {
            console.error(`[表格动画] 执行动画步骤失败:`, error);
        }
    }
    
    showStepDescription(description) {
        if (!description) return;
        
        // 查找或创建描述元素
        let descElement = this.table.parentElement.parentElement.querySelector('.animation-description');
        if (!descElement) {
            descElement = document.createElement('div');
            descElement.className = 'animation-description';
            descElement.style.cssText = `
                position: relative;
                margin-bottom: 10px;
                text-align: center;
                background: linear-gradient(135deg, #4285F4, #34A853);
                color: white;
                padding: 8px 15px;
                border-radius: 20px;
                font-size: 13px;
                font-weight: 500;
                box-shadow: 0 2px 8px rgba(66, 133, 244, 0.3);
                transform: translateY(-5px);
                transition: all 0.3s ease;
                z-index: 10;
            `;
            
            // 插入到表格前面
            this.table.parentElement.parentElement.insertBefore(descElement, this.table.parentElement);
        }
        
        descElement.textContent = description;
        descElement.style.opacity = '1';
        descElement.style.transform = 'translateY(0)';
        
        // 添加闪烁效果
        descElement.style.animation = 'pulse 0.5s ease-in-out';
        
        // 3秒后淡出
        setTimeout(() => {
            if (descElement.parentElement) {
                descElement.style.opacity = '0.6';
                descElement.style.transform = 'translateY(-3px)';
            }
        }, 2500);
    }
    
    highlightCell(row, col, color) {
        const cell = this.table.querySelector(`tr[data-row-index="${row}"] td[data-col-index="${col}"]`);
        if (cell) {
            cell.style.backgroundColor = color;
            cell.style.fontWeight = 'bold';
        }
    }
    
    highlightRow(row, color) {
        const rowElement = this.table.querySelector(`tr[data-row-index="${row}"]`);
        if (rowElement) {
            const cells = rowElement.querySelectorAll('td');
            cells.forEach(cell => {
                cell.style.backgroundColor = color;
            });
        }
    }
    
    highlightColumn(col, color) {
        const cells = this.table.querySelectorAll(`td[data-col-index="${col}"]`);
        cells.forEach(cell => {
            cell.style.backgroundColor = color;
        });
    }
    
    updateCell(row, col, value, highlightColor) {
        const cell = this.table.querySelector(`tr[data-row-index="${row}"] td[data-col-index="${col}"]`);
        if (cell) {
            // 先高亮显示变化
            if (highlightColor) {
                cell.style.backgroundColor = highlightColor;
                cell.style.transform = 'scale(1.1)';
            }
            
            // 更新值
            setTimeout(() => {
                cell.textContent = value;
                if (highlightColor) {
                    setTimeout(() => {
                        cell.style.transform = 'scale(1)';
                    }, 300);
                }
            }, 150);
        }
    }
    
    addRow(data, highlightColor) {
        const tbody = this.table.querySelector('tbody');
        const newRowIndex = tbody.children.length;
        const row = this.createRow(data, newRowIndex);
        
        if (highlightColor) {
            const cells = row.querySelectorAll('td');
            cells.forEach(cell => {
                cell.style.backgroundColor = highlightColor;
            });
        }
        
        // 添加动画效果
        row.style.opacity = '0';
        row.style.transform = 'translateY(-20px)';
        
        tbody.appendChild(row);
        
        // 触发动画
        setTimeout(() => {
            row.style.opacity = '1';
            row.style.transform = 'translateY(0)';
        }, 50);
    }
    
    removeRow(row) {
        const rowElement = this.table.querySelector(`tr[data-row-index="${row}"]`);
        if (rowElement) {
            rowElement.style.opacity = '0';
            rowElement.style.transform = 'translateX(-100%)';
            
            setTimeout(() => {
                if (rowElement.parentElement) {
                    rowElement.parentElement.removeChild(rowElement);
                }
            }, 300);
        }
    }
    
    clearAllHighlights() {
        const allCells = this.table.querySelectorAll('td');
        allCells.forEach(cell => {
            cell.style.backgroundColor = '';
            cell.style.fontWeight = '';
            cell.style.transform = '';
        });
    }
    
    resetTable() {
        this.clearAllHighlights();
        this.displayInitialData();
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    isValidCell(row, col) {
        return row >= 0 && row < this.config.table_data.length && 
               col >= 0 && col < this.config.headers.length;
    }
    
    isValidRow(row) {
        return row >= 0 && row < this.config.table_data.length;
    }
    
    isValidColumn(col) {
        return col >= 0 && col < this.config.headers.length;
    }
}

// 全局实例
window.animationEngine = new AnimationEngine(); 