import { LearningStep } from '@/types/learning-plan';
import { useEffect, useRef } from 'react';

interface FlowDiagramProps {
  steps: LearningStep[];
  newStepIndex?: number | null;
  updatedStepIndex?: number | null;
  updatingSteps: number[];
  stepTaskStatus: Record<string, 'pending' | 'generating' | 'completed' | 'failed'>;
  taskCache: Record<string, any>;
}

export function FlowDiagram({
  steps,
  newStepIndex,
  updatedStepIndex,
  updatingSteps,
  stepTaskStatus,
  taskCache
}: FlowDiagramProps) {
  const newStepRef = useRef<HTMLDivElement>(null);

  // 当有新步骤添加时，自动滚动到新步骤
  useEffect(() => {
    if (newStepIndex !== null && newStepIndex !== undefined && newStepRef.current) {
      // 使用 setTimeout 确保 DOM 已经更新
      setTimeout(() => {
        // 查找最近的滚动容器
        const scrollContainer = newStepRef.current?.closest('.overflow-y-auto');
        
        if (scrollContainer && newStepRef.current) {
          // 计算新步骤相对于滚动容器的位置
          const containerRect = scrollContainer.getBoundingClientRect();
          const elementRect = newStepRef.current.getBoundingClientRect();
          
          // 计算需要滚动的距离，使新步骤出现在容器中央
          const scrollTop = scrollContainer.scrollTop;
          const containerHeight = containerRect.height;
          const elementTop = elementRect.top - containerRect.top + scrollTop;
          const targetScrollTop = elementTop - containerHeight / 2 + elementRect.height / 2;
          
          // 平滑滚动到目标位置
          scrollContainer.scrollTo({
            top: Math.max(0, targetScrollTop),
            behavior: 'smooth'
          });
        } else {
          // 如果没有找到滚动容器，使用默认的 scrollIntoView
          newStepRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
          });
        }
      }, 300); // 增加延迟以确保动画效果完成
    }
  }, [newStepIndex]);
  // 根据step.stage对步骤进行分组
  const groupedSteps = steps.reduce((acc, step) => {
    const stage = step.stage || 'default';
    if (!acc[stage]) {
      acc[stage] = [];
    }
    acc[stage].push(step);
    return acc;
  }, {} as Record<string, LearningStep[]>);

  // 获取所有阶段
  const stages = Object.keys(groupedSteps);

  // 渲染stage连接线
  const renderStageConnection = () => (
    <div className="w-full h-0.5 bg-gray-300" />
  );

  const renderStepNode = (stepNumber: number, index: number) => {
    // 随机颜色配置 - 与原来保持一致
    const colors = [
      { bg: 'bg-blue-400', text: 'text-white', border: 'border-blue-400' },
      { bg: 'bg-green-400', text: 'text-white', border: 'border-green-400' },
      { bg: 'bg-yellow-400', text: 'text-white', border: 'border-yellow-400' }
    ];
    const colorScheme = colors[index % colors.length];

    return (
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transform ${
        colorScheme.bg
      } ${colorScheme.text} ${colorScheme.border} ${
        index % 3 === 0 ? 'rotate-12' : index % 3 === 1 ? '-rotate-12' : 'rotate-6'
      }`}>
        {stepNumber}
      </div>
    );
  };

  // 创建一个包含所有节点的扁平化数组
  const allNodes: Array<{type: 'stage' | 'step', data: any, stage?: string}> = [];
  
  stages.forEach((stage) => {
    const stepsInStage = groupedSteps[stage];
    
    // 如果不是default stage，先添加stage节点
    if (stage !== 'default') {
      allNodes.push({ type: 'stage', data: stage, stage });
    }
    
    // 添加该stage下的所有steps
    stepsInStage.forEach((step) => {
      allNodes.push({ type: 'step', data: step, stage });
    });
  });

  return (
    <div className="relative">
      {/* 垂直连接线 - 在instruction宽度的1/4处，从容器顶部开始 */}
      <div 
        className="absolute w-0.5 bg-gray-200 bottom-0"
        style={{ left: '25%', top: '0px' }}
      />

      {/* 统一的节点列表 - 所有节点都有相同间距，加大与instruction的距离 */}
      <div className="space-y-4 mt-12">
        {allNodes.map((node, index) => {
          if (node.type === 'stage') {
            return (
              <div key={`stage-${node.data}`} className="relative flex items-center">
                {/* Stage文案 - 向左移动，笔记化样式 */}
                <div 
                  className="absolute font-bold text-right transform -rotate-1"
                  style={{
                    right: '85%',
                    width: '15%',
                    fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
                    fontSize: '20px',
                    color: '#4a5568',
                    textShadow: '1px 1px 2px rgba(0,0,0,0.1)',
                  }}
                >
                  <span className="bg-yellow-100 px-2 py-1 rounded-md border border-yellow-200 shadow-sm">
                    {node.data}
                  </span>
                </div>
                {/* Stage连接线 - 从文案框右边缘连到垂直线 */}
                <div 
                  className="absolute flex items-center"
                  style={{ 
                    left: '15%', 
                    width: '10%',
                    height: '2px'
                  }}
                >
                  {renderStageConnection()}
                </div>
              </div>
            );
          } else {
            // Step节点
            const step = node.data;
            const isNewStep = newStepIndex === steps.indexOf(step);
            const isUpdatedStep = updatedStepIndex === steps.indexOf(step);
            const isUpdatingStep = updatingSteps.includes(step.step);
            const taskStatus = stepTaskStatus[step.step] || 'pending';
            const hasTaskCache = !!taskCache[step.step];

            return (
              <div 
                key={step.step} 
                className="relative flex items-center"
                ref={isNewStep ? newStepRef : null}
              >
                {/* Step节点 - 在垂直线上 */}
                <div 
                  className="absolute"
                  style={{ left: '25%', transform: 'translateX(-50%)' }}
                >
                  {renderStepNode(step.step, steps.indexOf(step))}
                </div>
                
                {/* Step内容 - 在节点右侧，保持原有样式 */}
                <div 
                  className={`py-3 pl-4 transform hover:scale-105 transition-all duration-300 ${
                    isNewStep ? 'animate-pulse scale-110 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border-2 border-blue-300' : ''
                  } ${
                    isUpdatedStep ? 'animate-pulse scale-105 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border-2 border-green-300' : ''
                  } ${
                    isUpdatingStep ? 'animate-pulse bg-gradient-to-r from-orange-50 to-red-50 rounded-lg border-2 border-orange-300' : ''
                  }`}
                  style={{
                    width: '70%',
                    marginLeft: '30%',
                    transform: steps.indexOf(step) % 2 === 0 ? 'rotate(0.2deg)' : 'rotate(-0.2deg)',
                    animation: isNewStep ? 'slideInFromRight 0.8s ease-out, pulse 1s ease-in-out' :
                              isUpdatedStep ? 'updateBounce 0.6s ease-out' :
                              isUpdatingStep ? 'blink 1s infinite' : undefined
                  }}
                >
                  <div className="flex items-center space-x-4">
                    {/* 标题 */}
                    <h3 className={`text-base font-bold ${
                      isNewStep ? 'animate-pulse text-blue-700' : ''
                    } ${
                      isUpdatedStep ? 'text-green-700 animate-pulse' : ''
                    } ${
                      isUpdatingStep ? 'text-orange-700 animate-pulse' : 'text-blue-700'
                    }`}
                        style={{
                          fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                        }}>
                      {step.title}
                      {isNewStep && <span className="ml-2 text-sm">✨ New!</span>}
                      {isUpdatedStep && <span className="ml-2 text-sm text-green-600">✅ Updated!</span>}
                      {isUpdatingStep && <span className="ml-2 text-sm text-orange-600">🔄 Updating...</span>}
                    </h3>

                    {/* 视频封面 - 只显示第一个视频的封面 */}
                    {step.videos && step.videos.length > 0 && step.videos[0].cover && (
                      <div className="w-32 h-20 bg-gray-200 rounded border transform -rotate-1 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        <img
                          src={(() => {
                            const originalUrl = step.videos[0].cover;
                            const finalUrl = originalUrl.startsWith('//') ? `https:${originalUrl}` : originalUrl;
                            // 使用图片代理解决防盗链问题
                            return `https://images.weserv.nl/?url=${encodeURIComponent(finalUrl.replace('https://', ''))}&w=128&h=80&fit=cover`;
                          })()}
                          alt={step.videos[0].title}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                          crossOrigin="anonymous"
                          onError={(e) => {
                            const target = e.currentTarget;
                            target.style.display = 'none';
                            const fallback = target.nextElementSibling as HTMLElement;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                        <span className="text-base hidden w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-100 text-blue-600 font-medium text-sm">
                          📹 Video
                        </span>
                      </div>
                    )}

                    {/* Task Type */}
                    <span className={`px-2 py-1 rounded text-xs transform rotate-1 ${
                      step.type === 'quiz' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                    }`} style={{
                      fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                    }}>
                      {step.type === 'quiz' ? '📝 Quiz' : '💻 Coding'}
                    </span>

                    {/* Difficulty Level */}
                    <span className={`px-2 py-1 rounded text-xs transform -rotate-2 ${
                      step.difficulty === 'beginner' ? 'bg-green-100 text-green-800' :
                      step.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`} style={{
                      fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                    }}>
                      {step.difficulty === 'beginner' ? '🌱 Beginner' :
                       step.difficulty === 'intermediate' ? '🌿 Intermediate' : '🌳 Advanced'}
                    </span>

                    {/* Duration Time */}
                    {step.videos && step.videos.length > 0 && step.videos[0].duration && (
                      <span className="px-2 py-1 rounded text-xs transform rotate-0.5 bg-gray-100 text-gray-700"
                            style={{
                              fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                            }}>
                        ⏱️ {step.videos[0].duration}
                      </span>
                    )}

                    {/* 任务生成状态指示器 - 移动到最右侧，只显示图标 */}
                    <div className="ml-auto flex-shrink-0">
                      {taskStatus === 'pending' && (
                        <span className="text-lg transform rotate-1" title="Task Pending">
                          ⏳
                        </span>
                      )}
                      {taskStatus === 'generating' && (
                        <span className="text-lg transform -rotate-1 animate-pulse" title="Generating Task...">
                          🔄
                        </span>
                      )}
                      {taskStatus === 'completed' && (
                        <span className="text-lg transform rotate-2" title="Task Ready">
                          ✅
                        </span>
                      )}
                      {taskStatus === 'failed' && (
                        <span className="text-lg transform -rotate-1 transition-transform hover:scale-110 cursor-pointer" title="Task Failed - Click to retry">
                          ❌
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 描述区域 - 全部显示 */}
                  {step.description && (
                    <div className="mt-3 ml-12 mr-4">
                      <div className="flex items-start space-x-2">
                        <span className="text-lg transform rotate-12 flex-shrink-0 mt-1">📝</span>
                        <div className="flex-1">
                          <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed"
                               style={{
                                 fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                               }}>
                            {step.description}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          }
        })}
      </div>
    </div>
  );
}



