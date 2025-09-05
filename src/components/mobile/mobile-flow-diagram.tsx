import { LearningStep } from '@/types/learning-plan';
import { useEffect, useRef } from 'react';

interface MobileFlowDiagramProps {
  steps: LearningStep[];
  newStepIndex?: number | null;
  updatedStepIndex?: number | null;
  updatingSteps: number[];
  stepTaskStatus: Record<number, 'pending' | 'generating' | 'completed' | 'failed'>;
  taskCache: Record<string, any>;
}

export function MobileFlowDiagram({
  steps,
  newStepIndex,
  updatedStepIndex,
  updatingSteps,
  stepTaskStatus,
  taskCache
}: MobileFlowDiagramProps) {
  const newStepRef = useRef<HTMLDivElement>(null);

  // 当有新步骤添加时，自动滚动到新步骤
  useEffect(() => {
    if (newStepIndex !== null && newStepIndex !== undefined && newStepRef.current) {
      setTimeout(() => {
        newStepRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
      }, 300);
    }
  }, [newStepIndex]);

  // 渲染步骤节点
  const renderStepNode = (stepNumber: number, index: number) => {
    const isNewStep = newStepIndex === index;
    const isUpdatedStep = updatedStepIndex === index;
    const isUpdatingStep = updatingSteps.includes(stepNumber);
    
    return (
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold transform shadow-md ${
        isNewStep ? 'bg-blue-600 animate-pulse scale-110' :
        isUpdatedStep ? 'bg-green-600 animate-pulse' :
        isUpdatingStep ? 'bg-orange-600 animate-pulse' :
        'bg-blue-500'
      }`}
           style={{
             transform: index % 2 === 0 ? 'rotate(5deg)' : 'rotate(-5deg)',
             fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
           }}>
        {stepNumber}
      </div>
    );
  };

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

  // 计算第一个stage的高度，用于确定竖线起始位置
  const firstStageHeight = 44; // py-2 + span height

  return (
    <div className="relative space-y-4 mt-12">
      {/* 主要的垂直连接线 - 穿过序号中心，从第一个stage下方开始 */}
      <div 
        className="absolute w-0.5 bg-gray-300"
        style={{
          left: '2rem', // 序号中心位置 (32px/2 = 16px, 加上容器的16px = 32px = 2rem)
          top: `${firstStageHeight}px`,
          height: `calc(100% - ${firstStageHeight}px)`,
          zIndex: 0
        }}
      />
      
      {allNodes.map((node, index) => {
        if (node.type === 'stage') {
          return (
            <div key={`stage-${node.data}`} className="relative z-10">
              {/* Stage标题 - 无连接线 */}
              <div className="py-2">
                <span 
                  className="bg-yellow-100 px-3 py-1 rounded-md border border-yellow-200 shadow-sm font-bold text-gray-700 transform -rotate-1"
                  style={{
                    fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive',
                    fontSize: '16px',
                    textShadow: '1px 1px 2px rgba(0,0,0,0.1)',
                  }}
                >
                  {node.data}
                </span>
              </div>
            </div>
          );
        }

        // Step节点
        const step = node.data;
        const stepIndex = steps.indexOf(step);
        const isNewStep = newStepIndex === stepIndex;
        const isUpdatedStep = updatedStepIndex === stepIndex;
        const isUpdatingStep = updatingSteps.includes(step.step);
        const taskStatus = stepTaskStatus[step.step] || 'pending';

        return (
          <div 
            key={step.step} 
            className="relative flex items-start z-10"
            ref={isNewStep ? newStepRef : null}
          >
            {/* Step节点 - 在垂直线上，居中对齐 */}
            <div className="absolute top-2" style={{ left: '1rem' }}>
              {renderStepNode(step.step, stepIndex)}
            </div>
            
            {/* Step内容 - 在节点右侧，标题允许换行 */}
            <div 
              className={`py-3 pl-4 transform hover:scale-105 transition-all duration-300 ${
                isNewStep ? 'animate-pulse scale-110 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border-2 border-blue-300' : ''
              } ${
                isUpdatedStep ? 'animate-pulse scale-105 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border-2 border-green-300' : ''
              } ${
                isUpdatingStep ? 'animate-pulse bg-gradient-to-r from-orange-50 to-red-50 rounded-lg border-2 border-orange-300' : ''
              }`}
              style={{
                marginLeft: '3rem',
                transform: stepIndex % 2 === 0 ? 'rotate(0.2deg)' : 'rotate(-0.2deg)',
                animation: isNewStep ? 'slideInFromRight 0.8s ease-out, pulse 1s ease-in-out' :
                          isUpdatedStep ? 'updateBounce 0.6s ease-out' :
                          isUpdatingStep ? 'blink 1s infinite' : undefined
              }}
            >
              <div className="flex flex-col space-y-3">
                {/* 标题行 - 允许换行 */}
                <div className="flex items-start justify-between">
                  <h3 className={`text-base font-bold leading-tight break-words pr-2 ${
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

                  {/* 任务生成状态指示器 */}
                  <div className="flex-shrink-0">
                    {taskStatus === 'pending' && (
                      <span className="text-lg transform rotate-1" title="Task Pending">⏳</span>
                    )}
                    {taskStatus === 'generating' && (
                      <span className="text-lg transform -rotate-1 animate-pulse" title="Generating Task...">🔄</span>
                    )}
                    {taskStatus === 'completed' && (
                      <span className="text-lg transform rotate-2" title="Task Ready">✅</span>
                    )}
                    {taskStatus === 'failed' && (
                      <span className="text-lg transform -rotate-1" title="Task Failed">❌</span>
                    )}
                  </div>
                </div>

                {/* 内容行 - 视频封面和标签 */}
                <div className="flex items-center space-x-4">
                  {/* 视频封面 */}
                  {step.videos && step.videos.length > 0 && step.videos[0].cover && (
                    <div className="w-24 h-16 bg-gray-200 rounded border transform -rotate-1 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      <img
                        src={(() => {
                          const originalUrl = step.videos[0].cover;
                          const finalUrl = originalUrl.startsWith('//') ? `https:${originalUrl}` : originalUrl;
                          return `https://images.weserv.nl/?url=${encodeURIComponent(finalUrl.replace('https://', ''))}&w=96&h=64&fit=cover`;
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
                      <span className="text-sm hidden w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-100 text-blue-600 font-medium">
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
                </div>
              </div>

              {/* 描述区域 */}
              {step.description && (
                <div className="mt-3 text-sm text-gray-700 leading-relaxed transform rotate-0.5"
                     style={{
                       fontFamily: '"Comic Sans MS", "Marker Felt", "Kalam", cursive'
                     }}>
                  {step.description}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* 动画样式定义 */}
      <style jsx>{`
        @keyframes slideInFromRight {
          0% {
            transform: translateX(100%) rotate(5deg);
            opacity: 0;
          }
          50% {
            transform: translateX(-10px) rotate(-2deg);
            opacity: 0.8;
          }
          100% {
            transform: translateX(0) rotate(0deg);
            opacity: 1;
          }
        }
        @keyframes updateBounce {
          0% { transform: scale(1); }
          30% { transform: scale(1.05); }
          60% { transform: scale(0.98); }
          100% { transform: scale(1); }
        }
        @keyframes blink {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
