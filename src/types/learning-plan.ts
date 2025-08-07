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
  search_keyword?: string; // 添加可选的搜索关键词
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
  search_keyword?: string; // 添加可选的搜索关键词
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

// Web搜索结果类型
export interface WebSearchResult {
  url: string;
  title: string;
  content: string;
  score: number;
  raw_content: string | null;
}

export interface WebSearchImage {
  url: string;
  description: string;
}

export interface WebSearchResponse {
  query: string;
  follow_up_questions: string[] | null;
  answer: string | null;
  images: WebSearchImage[];
  results: WebSearchResult[];
  response_time: number;
}

export interface TaskContent {
  type: 'quiz' | 'coding';
  difficulty: string;
  ppt_slide: string; // 改为string类型，支持markdown格式
  questions?: QuizQuestion[];
  task?: CodingTask;
  videos: Video[];
  web_res?: WebSearchResponse; // 新增：Web搜索结果
}

export interface TaskGenerateResponse {
  success: boolean;
  task: TaskContent;
}
