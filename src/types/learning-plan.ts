// 学习计划相关类型定义

export interface Video {
  title: string;
  url: string;
  cover: string;
  duration: string;
}

export interface LearningStep {
  step: number;
  title: string;
  description: string;
  animation_type: string;
  status: 'current' | 'completed' | 'pending' | '当前进行' | '待完成';
  type: 'quiz' | 'coding';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  videos: Video[];
}

export interface LearningPlan {
  plan: LearningStep[];
}

export interface PlanUpdateCallback {
  updatePlan: (plan: LearningPlan) => void;
}

// 任务生成相关类型定义 - 根据input_schema.md更新
export interface TaskGenerateRequest {
  step: number;
  title: string;
  description: string;
  animation_type: string;
  status: string;
  type: 'quiz' | 'coding';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  videos: Video[];
}

export interface PptSlide {
  title: string;
  content: string[];
}

export interface QuizQuestion {
  question: string;
  type: 'choice';
  options: string[];
  answer: string;
}

export interface CodingTask {
  title: string;
  description: string;
  starter_code: string;
  answer: string;
}

export interface TaskContent {
  type: 'quiz' | 'coding';
  difficulty: string;
  ppt_slide: PptSlide;
  questions?: QuizQuestion[];
  task?: CodingTask;
  videos: Video[];
}

export interface TaskGenerateResponse {
  success: boolean;
  task: TaskContent;
}
