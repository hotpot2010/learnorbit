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
  stage?: string; // 新增：步骤所属的阶段
}

export interface LearningPlan {
  plan: LearningStep[];
  title?: string; // 课程标题，来自 introduction.title
  description?: string; // 课程描述，来自 introduction.course_info
  introduction?: any; // 完整的课程介绍信息
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
  id?: string | null; // 用户ID
  lang?: string; // 语言设置: en/zh
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

// 任务评估请求接口
export interface TaskEvaluateRequest {
  task_type: 'quiz' | 'coding';
  submission: any;
  task_data: any;
  id?: string | null; // 用户ID
  lang?: string; // 语言设置: en/zh
}

// 聊天请求接口
export interface ChatStreamRequest {
  message?: string;
  messages?: any[];
  [key: string]: any; // 允许其他字段
  id?: string | null; // 用户ID
  lang?: string; // 语言设置: en/zh
}

// 课程定制请求接口
export interface Chat1StreamRequest {
  id: string;
  messages: any[];
  userId?: string | null; // 用户ID
  lang?: string; // 语言设置: en/zh
}

// 学习计划生成请求接口
export interface LearningPlanGenerateRequest {
  id: string;
  messages: any[];
  advise?: any;
  userId?: string | null; // 用户ID
  lang?: string; // 语言设置: en/zh
}

// AI问题建议请求接口
export interface SuggestQuestionsRequest {
  task_title: string;
  task_description?: string;
  user_submission?: any;
  error_reason?: string;
  [key: string]: any; // 允许其他字段
  id?: string | null; // 用户ID
  lang?: string; // 语言设置: en/zh
}

export interface TaskGenerateResponse {
  success: boolean;
  task: TaskContent;
}
