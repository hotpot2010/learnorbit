// Skill Radar Chart Initialization
console.log('radar-chart.js 开始加载');

document.addEventListener('DOMContentLoaded', () => {
    console.log('RadarChart - DOM内容加载完成，准备初始化雷达图');
    
    // 获取雷达图容器
    const ctx = document.getElementById('skillRadarChart');
    
    if (ctx) {
        console.log('找到雷达图容器，开始初始化Chart.js');
        
        try {
            // 检查Chart.js是否加载
            if (typeof Chart === 'undefined') {
                console.error('Chart.js未加载，无法渲染雷达图');
                return;
            }
            
            // 技能数据
            const skillData = {
                labels: ['理论知识', '实践能力', '编程技巧', '算法优化', '问题解决'],
                datasets: [{
                    label: '能力水平',
                    data: [70, 60, 75, 65, 80],
                    backgroundColor: 'rgba(66, 133, 244, 0.2)',
                    borderColor: 'rgba(66, 133, 244, 1)',
                    pointBackgroundColor: 'rgba(66, 133, 244, 1)',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgba(66, 133, 244, 1)'
                }]
            };
            
            // 图表配置
            const config = {
                type: 'radar',
                data: skillData,
                options: {
                    elements: {
                        line: {
                            borderWidth: 2
                        }
                    },
                    scales: {
                        r: {
                            angleLines: {
                                display: true
                            },
                            suggestedMin: 0,
                            suggestedMax: 100,
                            ticks: {
                                stepSize: 20
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    responsive: true,
                    maintainAspectRatio: false
                }
            };
            
            // 创建雷达图
            console.log('创建Chart.js雷达图实例');
            new Chart(ctx, config);
            console.log('雷达图初始化成功');
        } catch (err) {
            console.error('初始化雷达图时出错:', err);
        }
    } else {
        console.error('未找到雷达图容器');
    }
    
    // 设置超时，确保Chart.js有足够时间处理渲染
    setTimeout(() => {
        if (ctx) {
            // 检查图表是否正确渲染
            if (ctx.chart) {
                console.log('图表已正确渲染');
            } else {
                console.warn('图表未能正确渲染，尝试重新创建');
                try {
                    // 重新创建雷达图
                    if (typeof Chart !== 'undefined') {
                        new Chart(ctx, {
                            type: 'radar',
                            data: {
                                labels: ['理论知识', '实践能力', '编程技巧', '算法优化', '问题解决'],
                                datasets: [{
                                    label: '能力水平',
                                    data: [70, 60, 75, 65, 80],
                                    backgroundColor: 'rgba(66, 133, 244, 0.2)',
                                    borderColor: 'rgba(66, 133, 244, 1)'
                                }]
                            }
                        });
                        console.log('雷达图重新创建成功');
                    }
                } catch (err) {
                    console.error('重新创建雷达图时出错:', err);
                }
            }
        }
    }, 1000);
}); 