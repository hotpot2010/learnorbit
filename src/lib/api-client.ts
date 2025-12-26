/**
 * Backend API 客户端
 * 统一管理所有 Backend API 调用
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ==================== 类型定义 ====================

export interface User {
  id: string;
  name: string;
  email: string;
  email_verified: boolean;
  image?: string;
  role?: string;
  created_at: string;
}

export interface Course {
  id: string;
  user_id: string;
  course_plan: any;
  plan_url?: string;
  current_step: number;
  status: 'in-progress' | 'completed';
  tasks_generated: boolean;
  created_at: string;
  updated_at: string;
}

export interface Session {
  token: string;
  expires_at: string;
  user: User;
}

// ==================== 工具函数 ====================

/**
 * 处理 API 响应
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * 获取认证头
 */
function getAuthHeaders(token?: string): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else if (typeof window !== 'undefined') {
    // 从 localStorage 或 cookie 读取 token
    const savedToken = localStorage.getItem('auth_token');
    if (savedToken) {
      headers['Authorization'] = `Bearer ${savedToken}`;
    }
  }
  
  return headers;
}

// ==================== 认证 API ====================

export const authAPI = {
  /**
   * 用户注册
   */
  register: async (name: string, email: string, password: string): Promise<Session> => {
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    const session = await handleResponse<Session>(response);
    
    // 保存 token
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', session.token);
    }
    
    return session;
  },

  /**
   * 用户登录
   */
  login: async (email: string, password: string): Promise<Session> => {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const session = await handleResponse<Session>(response);
    
    // 保存 token
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', session.token);
    }
    
    return session;
  },

  /**
   * 获取当前会话
   */
  getSession: async (token?: string): Promise<User> => {
    const authToken = token || (typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null);
    
    if (!authToken) {
      throw new Error('No auth token found');
    }
    
    const response = await fetch(`${API_URL}/api/auth/session/${authToken}`, {
      headers: getAuthHeaders(authToken),
    });
    return handleResponse<User>(response);
  },

  /**
   * 用户登出
   */
  logout: async (token?: string): Promise<void> => {
    const authToken = token || (typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null);
    
    if (authToken) {
      await fetch(`${API_URL}/api/auth/logout?token=${authToken}`, {
        method: 'DELETE',
        headers: getAuthHeaders(authToken),
      });
    }
    
    // 清除本地 token
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
  },
};

// ==================== 课程 API ====================

export const coursesAPI = {
  /**
   * 创建新课程
   */
  create: async (userId: string, coursePlan: any, planUrl?: string): Promise<Course> => {
    const response = await fetch(`${API_URL}/api/courses/`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        user_id: userId,
        course_plan: coursePlan,
        plan_url: planUrl,
      }),
    });
    return handleResponse<Course>(response);
  },

  /**
   * 获取用户的所有课程
   */
  getUserCourses: async (userId: string): Promise<Course[]> => {
    const response = await fetch(`${API_URL}/api/courses/user/${userId}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<Course[]>(response);
  },

  /**
   * 获取单个课程详情
   */
  get: async (courseId: string): Promise<Course> => {
    const response = await fetch(`${API_URL}/api/courses/${courseId}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<Course>(response);
  },

  /**
   * 更新课程
   */
  update: async (
    courseId: string,
    updates: {
      current_step?: number;
      status?: 'in-progress' | 'completed';
      tasks_generated?: boolean;
      course_plan?: any;
    }
  ): Promise<Course> => {
    const response = await fetch(`${API_URL}/api/courses/${courseId}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    return handleResponse<Course>(response);
  },

  /**
   * 删除课程
   */
  delete: async (courseId: string): Promise<void> => {
    const response = await fetch(`${API_URL}/api/courses/${courseId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    await handleResponse(response);
  },

  /**
   * 获取公开课程（通过 slug）
   */
  getPublicCourse: async (slug: string) => {
    const response = await fetch(`${API_URL}/api/courses/public/${slug}`);
    return handleResponse(response);
  },
};

// ==================== 视频笔记 API ====================

export const videoNotesAPI = {
  /**
   * 创建视频笔记
   */
  create: async (data: {
    user_id: string;
    task_id: string;
    video_url: string;
    bv_id?: string;
    video_title?: string;
    user_notes_data: any;
  }) => {
    const response = await fetch(`${API_URL}/api/video-notes/`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  /**
   * 获取用户的视频笔记
   */
  getUserNotes: async (userId: string) => {
    const response = await fetch(`${API_URL}/api/video-notes/user/${userId}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  /**
   * 获取单个笔记
   */
  get: async (noteId: string) => {
    const response = await fetch(`${API_URL}/api/video-notes/${noteId}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  /**
   * 更新笔记
   */
  update: async (noteId: string, updates: any) => {
    const response = await fetch(`${API_URL}/api/video-notes/${noteId}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    return handleResponse(response);
  },

  /**
   * 删除笔记
   */
  delete: async (noteId: string) => {
    const response = await fetch(`${API_URL}/api/video-notes/${noteId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    await handleResponse(response);
  },
};

// ==================== 导出默认客户端 ====================

export default {
  auth: authAPI,
  courses: coursesAPI,
  videoNotes: videoNotesAPI,
};


