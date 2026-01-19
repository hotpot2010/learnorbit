/**
 * Backend API 客户端
 * 用于前端 Next.js API Routes 调用 Backend API
 * Backend API 访问公司 MySQL 数据库（不支持外网直接访问）
 */

const BACKEND_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * 调用 Backend API
 */
async function callBackendAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${BACKEND_API_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * 课程数据类型（Backend API get 方法返回 snake_case）
 */
export interface CourseData {
  id: string;
  user_id: string;
  course_plan: any;
  plan_url: string | null;
  current_step: number;
  status: string;
  tasks_generated: boolean;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * 课程数据类型（Backend API getUserCourses 返回 camelCase）
 */
export interface CourseDataCamelCase {
  id: string;
  userId: string;
  coursePlan: any;
  planUrl: string | null;
  currentStep: number;
  status: string;
  tasksGenerated: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

/**
 * 课程 API
 */
export const coursesAPI = {
  /**
   * 创建课程
   */
  create: async (userId: string, coursePlan: any, planUrl?: string): Promise<CourseData> => {
    return callBackendAPI<CourseData>(`/open-api/user-courses/?user_id=${userId}`, {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        course_plan: coursePlan,
        plan_url: planUrl,
      }),
    });
  },

  /**
   * 获取用户的所有课程
   */
  getUserCourses: async (userId: string): Promise<CourseDataCamelCase[]> => {
    return callBackendAPI<CourseDataCamelCase[]>(`/open-api/user-courses/user/${userId}`);
  },

  /**
   * 获取单个课程
   */
  get: async (courseId: string, userId: string): Promise<CourseData> => {
    return callBackendAPI<CourseData>(`/open-api/user-courses/${courseId}?user_id=${userId}`);
  },

  /**
   * 更新课程（部分更新）
   */
  update: async (courseId: string, userId: string, updates: any): Promise<CourseData> => {
    return callBackendAPI<CourseData>(`/open-api/user-courses/${courseId}?user_id=${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  /**
   * 完整更新课程
   */
  updateFull: async (courseId: string, userId: string, coursePlan: any, planUrl?: string): Promise<CourseData> => {
    return callBackendAPI<CourseData>(`/open-api/user-courses/${courseId}?user_id=${userId}`, {
      method: 'PUT',
      body: JSON.stringify({
        user_id: userId,
        course_plan: coursePlan,
        plan_url: planUrl,
      }),
    });
  },

  /**
   * 更新课程进度
   */
  updateProgress: async (courseId: string, userId: string, currentStep: number, status: string): Promise<CourseData> => {
    return callBackendAPI<CourseData>(`/open-api/user-courses/${courseId}/progress?user_id=${userId}`, {
      method: 'PUT',
      body: JSON.stringify({
        current_step: currentStep,
        status: status,
      }),
    });
  },

  /**
   * 删除课程
   */
  delete: async (courseId: string, userId: string): Promise<void> => {
    return callBackendAPI<void>(`/open-api/user-courses/${courseId}?user_id=${userId}`, {
      method: 'DELETE',
    });
  },

  /**
   * 获取公开课程（通过 slug）
   */
  getPublicCourse: async (slug: string) => {
    // slug 应该已经是解码后的值
    // 使用 URL 对象来正确构建 URL，避免双重编码
    // FastAPI 会自动解码路径参数
    const url = new URL(`${BACKEND_API_URL}/open-api/public-courses/${encodeURIComponent(slug)}`);
    return callBackendAPI(url.pathname + url.search);
  },
};

/**
 * 视频笔记创建/更新响应类型
 */
export interface VideoNoteCreateOrUpdateResponse {
  success: boolean;
  noteId: string;
  message: string;
  isNew: boolean;
}

/**
 * 视频笔记数据（snake_case，Backend API 返回格式）
 */
export interface VideoNoteData {
  id: string;
  user_id: string;
  task_id: string;
  video_url: string;
  bv_id: string | null;
  video_title: string | null;
  video_platform: string;
  user_notes_data: any;
  title: string | null;
  description: string | null;
  is_favorite: boolean;
  total_knowledge_points: number;
  total_qas: number;
  total_exercises: number;
  created_at: string | null;
  updated_at: string | null;
  last_viewed_at: string | null;
}

/**
 * 视频笔记列表响应类型
 */
export interface VideoNotesListResponse {
  success: boolean;
  notes: VideoNoteData[];
  page: number;
  limit: number;
  total: number;
}

/**
 * 视频笔记 API
 */
export const videoNotesAPI = {
  /**
   * 创建或更新笔记
   */
  createOrUpdate: async (userId: string, noteData: any): Promise<VideoNoteCreateOrUpdateResponse> => {
    return callBackendAPI<VideoNoteCreateOrUpdateResponse>(`/open-api/video-notes/?user_id=${userId}`, {
      method: 'POST',
      body: JSON.stringify(noteData),
    });
  },

  /**
   * 获取用户的笔记
   */
  getUserNotes: async (userId: string, taskId?: string, page = 1, limit = 20): Promise<VideoNotesListResponse> => {
    const params = new URLSearchParams({
      user_id: userId,
      page: page.toString(),
      limit: limit.toString(),
    });
    if (taskId) {
      params.append('task_id', taskId);
    }
    return callBackendAPI<VideoNotesListResponse>(`/open-api/video-notes/?${params}`);
  },

  /**
   * 获取单个笔记
   */
  get: async (noteId: string, userId: string) => {
    return callBackendAPI(`/open-api/video-notes/${noteId}?user_id=${userId}`);
  },

  /**
   * 更新笔记
   */
  update: async (noteId: string, userId: string, updates: any) => {
    return callBackendAPI(`/open-api/video-notes/${noteId}?user_id=${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  /**
   * 删除笔记
   */
  delete: async (noteId: string, userId: string) => {
    return callBackendAPI(`/open-api/video-notes/${noteId}?user_id=${userId}`, {
      method: 'DELETE',
    });
  },
};

/**
 * 分析 API
 */
export const analyticsAPI = {
  /**
   * 记录关键行为
   */
  trackKeyAction: async (event: any) => {
    return callBackendAPI(`/open-api/analytics/key-actions`, {
      method: 'POST',
      body: JSON.stringify(event),
    });
  },

  /**
   * 获取统计数据
   */
  getStats: async (startDate?: string, endDate?: string, excludeUserIds?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (excludeUserIds) params.append('excludeUserIds', excludeUserIds);
    
    const queryString = params.toString();
    return callBackendAPI(`/open-api/analytics/stats${queryString ? '?' + queryString : ''}`);
  },
};

/**
 * 任务 API
 */
export const tasksAPI = {
  /**
   * 获取课程的所有任务
   */
  getCourseTasks: async (courseId: string, userId: string) => {
    return callBackendAPI(`/open-api/user-courses/${courseId}/tasks?user_id=${userId}`);
  },

  /**
   * 保存课程任务
   */
  saveTask: async (courseId: string, userId: string, stepNumber: number, taskContent: any) => {
    return callBackendAPI(`/open-api/user-courses/${courseId}/tasks?user_id=${userId}`, {
      method: 'POST',
      body: JSON.stringify({
        step_number: stepNumber,
        task_content: taskContent,
      }),
    });
  },

  /**
   * 批量生成课程的所有任务
   */
  generateTasks: async (courseId: string, userId: string) => {
    return callBackendAPI(`/open-api/user-courses/${courseId}/tasks/generate?user_id=${userId}`, {
      method: 'POST',
    });
  },
};

/**
 * 创作者课程数据类型
 */
export interface CreatorCourseData {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  isActive: boolean;
}

export interface CreatorData {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

export interface CreatorCourseListItem {
  id: string;
  slug: string;
  courseId: string;
  creatorId: string;
  title: string;
  description: string | null;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CreatorCoursesListResponse {
  success: boolean;
  courses: CreatorCourseListItem[];
}

export interface CreatorCourseResponse {
  success: boolean;
  course: {
    id: string;
    userId: string;
    coursePlan: any;
    currentStep: number;
    status: string;
    createdAt: string | null;
    updatedAt: string | null;
    creator: CreatorData;
    creatorCourse: CreatorCourseData;
  };
}

/**
 * 创作者课程 API
 */
export const creatorCoursesAPI = {
  /**
   * 创建创作者课程映射
   */
  create: async (courseId: string, title: string, description?: string): Promise<CreatorCourseResponse> => {
    return callBackendAPI<CreatorCourseResponse>(`/open-api/creator-courses/`, {
      method: 'POST',
      body: JSON.stringify({
        course_id: courseId,
        title,
        description,
      }),
    });
  },

  /**
   * 获取创作者的所有课程
   */
  getCreatorCourses: async (creatorId: string): Promise<CreatorCoursesListResponse> => {
    return callBackendAPI<CreatorCoursesListResponse>(`/open-api/creator-courses/?creator_id=${creatorId}`);
  },

  /**
   * 通过 slug 获取创作者课程
   */
  getBySlug: async (slug: string): Promise<CreatorCourseResponse> => {
    return callBackendAPI<CreatorCourseResponse>(`/open-api/creator-courses/${slug}`);
  },
};

/**
 * 公开课程 API
 */
export const publicCoursesAPI = {
  /**
   * 获取公开课程列表
   */
  getList: async (search?: string) => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    const queryString = params.toString();
    return callBackendAPI(`/open-api/public-courses${queryString ? '?' + queryString : ''}`);
  },

  /**
   * 通过 slug 获取公开课程
   */
  getBySlug: async (slug: string) => {
    return callBackendAPI(`/open-api/public-courses/${slug}`);
  },
};

/**
 * 支付数据类型
 */
export interface PaymentData {
  id: string;
  priceId: string;
  type: string;
  interval: string | null;
  userId: string;
  customerId: string;
  subscriptionId: string | null;
  status: string;
  periodStart: string | null;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialStart: string | null;
  trialEnd: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/**
 * 支付 API
 */
export const paymentAPI = {
  /**
   * 创建支付记录
   */
  create: async (paymentData: any): Promise<PaymentData> => {
    return callBackendAPI<PaymentData>('/open-api/payment', {
      method: 'POST',
      body: JSON.stringify(paymentData),
    });
  },

  /**
   * 获取支付记录
   */
  get: async (paymentId: string): Promise<PaymentData> => {
    return callBackendAPI<PaymentData>(`/open-api/payment/${paymentId}`);
  },

  /**
   * 获取用户的支付记录
   */
  getByUserId: async (userId: string, type?: string, status?: string): Promise<PaymentData[]> => {
    const params = new URLSearchParams({ user_id: userId });
    if (type) params.append('type', type);
    if (status) params.append('status', status);
    return callBackendAPI<PaymentData[]>(`/open-api/payment?${params.toString()}`);
  },

  /**
   * 更新支付记录
   */
  update: async (paymentId: string, updates: any): Promise<PaymentData> => {
    return callBackendAPI<PaymentData>(`/open-api/payment/${paymentId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  /**
   * 获取用户的 lifetime membership 状态
   */
  getLifetimeStatus: async (userId: string, lifetimePlanIds: string[]): Promise<{ is_lifetime_member: boolean }> => {
    const params = new URLSearchParams({
      lifetime_plan_ids: lifetimePlanIds.join(','),
    });
    return callBackendAPI<{ is_lifetime_member: boolean }>(`/open-api/payment/user/${userId}/lifetime-status?${params.toString()}`);
  },
};

/**
 * 用户数据类型
 */
export interface UserData {
  id: string;
  name: string;
  email: string;
  email_verified: boolean;
  image: string | null;
  created_at: string | null;
  updated_at: string | null;
  role: string | null;
  customer_id: string | null;
}

/**
 * 用户列表响应类型
 */
export interface UsersListResponse {
  success: boolean;
  data: {
    items: UserData[];
    total: number;
  };
}

/**
 * 用户 API
 */
export const usersAPI = {
  /**
   * 获取用户列表（支持搜索、分页、排序）
   */
  getUsers: async (params: {
    pageIndex?: number;
    pageSize?: number;
    search?: string;
    sortField?: string;
    sortDesc?: boolean;
  }): Promise<UsersListResponse> => {
    const queryParams = new URLSearchParams();
    if (params.pageIndex !== undefined) queryParams.append('page_index', params.pageIndex.toString());
    if (params.pageSize !== undefined) queryParams.append('page_size', params.pageSize.toString());
    if (params.search) queryParams.append('search', params.search);
    if (params.sortField) queryParams.append('sort_field', params.sortField);
    if (params.sortDesc !== undefined) queryParams.append('sort_desc', params.sortDesc.toString());
    return callBackendAPI<UsersListResponse>(`/open-api/auth-db/users?${queryParams.toString()}`);
  },

  /**
   * 根据 ID 获取用户
   */
  getById: async (userId: string): Promise<UserData> => {
    return callBackendAPI<UserData>(`/open-api/auth-db/user/${userId}`);
  },

  /**
   * 根据邮箱获取用户
   */
  getByEmail: async (email: string): Promise<UserData | null> => {
    return callBackendAPI<UserData | null>(`/open-api/auth-db/user?email=${encodeURIComponent(email)}`);
  },
};

/**
 * VOD 播放签名响应类型
 */
export interface VodPsignResponse {
  success: boolean;
  psign: string;
  app_id: number;
  file_id: string;
}

/**
 * VOD API
 */
export const vodAPI = {
  /**
   * 获取 VOD 播放签名（psign）
   */
  getPsign: async (fileId: string, appId?: number, expireTime?: number): Promise<VodPsignResponse> => {
    return callBackendAPI<VodPsignResponse>('/open-api/offline-video/vod/psign', {
      method: 'POST',
      body: JSON.stringify({
        file_id: fileId,
        app_id: appId,
        expire_time: expireTime,
      }),
    });
  },
};

export default {
  courses: coursesAPI,
  videoNotes: videoNotesAPI,
  analytics: analyticsAPI,
  tasks: tasksAPI,
  creatorCourses: creatorCoursesAPI,
  publicCourses: publicCoursesAPI,
  payment: paymentAPI,
  users: usersAPI,
  vod: vodAPI,
};

