// 用户课程状态
export type CourseStatus = 'learning' | 'published' | 'completed';

// 步骤状态
export type StepStatus = 'pending' | 'current' | 'completed';

// 步骤类型
export type StepType = 'theory' | 'practice';

// 内容类型
export type ContentType = 'ppt' | 'video' | 'quiz' | 'coding';

// 难度级别
export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';

// 学习活动类型
export type ActivityType = 'course_started' | 'step_completed' | 'quiz_attempted' | 'course_completed';

// 用户课程接口
export interface UserCourse {
  id: string;
  userId: string;
  courseId: string;
  title: string;
  description?: string;
  difficulty: DifficultyLevel;
  estimatedTime?: string;
  status: CourseStatus;
  overallProgress: number;
  createdAt: Date;
  updatedAt: Date;
  steps?: CourseStep[];
}

// 课程步骤接口
export interface CourseStep {
  id: string;
  userCourseId: string;
  stepIndex: number;
  stepId: string;
  title: string;
  description?: string;
  type: StepType;
  estimatedTime?: string;
  status: StepStatus;
  progress: number;
  createdAt: Date;
  updatedAt: Date;
  content?: StepContent[];
}

// 步骤内容接口
export interface StepContent {
  id: string;
  courseStepId: string;
  contentType: ContentType;
  contentData: any; // JSONB数据
  createdAt: Date;
  updatedAt: Date;
}

// PPT内容数据结构
export interface PPTContentData {
  title: string;
  content: string[];
  video?: string;
}

// 测验内容数据结构
export interface QuizContentData {
  questions: QuizQuestion[];
}

export interface QuizQuestion {
  question: string;
  type: 'choice' | 'multiple_choice' | 'text';
  options?: string[];
  answer: string | string[];
  explanation?: string;
}

// 编程练习内容数据结构
export interface CodingContentData {
  title: string;
  description: string;
  template: string;
  testCases: TestCase[];
  hints?: string[];
}

export interface TestCase {
  input: string;
  expectedOutput: string;
  description?: string;
}

// 用户答题记录接口
export interface UserQuizAttempt {
  id: string;
  userId: string;
  courseStepId: string;
  quizData: QuizContentData;
  userAnswers: Record<number, any>;
  score: number;
  isPassed: boolean;
  attemptedAt: Date;
}

// 用户学习活动接口
export interface UserLearningActivity {
  id: string;
  userId: string;
  courseId: string;
  stepId?: string;
  activityType: ActivityType;
  activityData?: any;
  createdAt: Date;
}

// 创建课程请求接口
export interface CreateCourseRequest {
  title: string;
  description?: string;
  difficulty: DifficultyLevel;
  estimatedTime?: string;
  steps: CreateStepRequest[];
}

export interface CreateStepRequest {
  title: string;
  description?: string;
  type: StepType;
  estimatedTime?: string;
  content: CreateContentRequest[];
}

export interface CreateContentRequest {
  contentType: ContentType;
  contentData: any;
}

// 更新进度请求接口
export interface UpdateProgressRequest {
  stepId: string;
  progress: number;
  status?: StepStatus;
}

// 提交答案请求接口
export interface SubmitAnswersRequest {
  stepId: string;
  answers: Record<number, any>;
} 