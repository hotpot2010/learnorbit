/**
 * Better Auth 自定义适配器 - Backend API 客户端
 * 通过 Backend API 访问数据库，而不是直接访问数据库
 */

// 获取 Backend API URL（支持服务器端和客户端）
function getBackendAPIUrl(): string {
  // 服务器端优先使用环境变量，如果没有则使用默认值
  if (typeof window === 'undefined') {
    // 服务器端
    return process.env.NEXT_PUBLIC_API_URL || process.env.EXTERNAL_API_URL || 'http://localhost:8000';
  }
  // 客户端
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
}

const BACKEND_API_URL = getBackendAPIUrl();

/**
 * 调用 Backend API
 */
async function callBackendAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${BACKEND_API_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null as T;
      }
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data as T;
  } catch (error) {
    console.error(`❌ Backend API 调用失败 [${endpoint}]:`, error);
    throw error;
  }
}

/**
 * User 操作
 */
export const userAPI = {
  create: async (data: any) => {
    return callBackendAPI(`/open-api/auth-db/user`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  findById: async (id: string) => {
    return callBackendAPI(`/open-api/auth-db/user/${id}`);
  },

  findByEmail: async (email: string) => {
    return callBackendAPI(`/open-api/auth-db/user?email=${encodeURIComponent(email)}`);
  },

  update: async (id: string, data: any) => {
    return callBackendAPI(`/open-api/auth-db/user/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: string) => {
    return callBackendAPI(`/open-api/auth-db/user/${id}`, {
      method: 'DELETE',
    });
  },
};

/**
 * Session 数据类型
 */
export interface SessionData {
  id: string;
  token: string;
  user_id: string;
  expires_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  ip_address: string | null;
  user_agent: string | null;
}

/**
 * Session 操作
 */
export const sessionAPI = {
  create: async (data: any): Promise<SessionData> => {
    return callBackendAPI<SessionData>(`/open-api/auth-db/session`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  findById: async (id: string): Promise<SessionData | null> => {
    return callBackendAPI<SessionData | null>(`/open-api/auth-db/session/${id}`);
  },

  findByToken: async (token: string): Promise<SessionData | null> => {
    return callBackendAPI<SessionData | null>(`/open-api/auth-db/session?token=${encodeURIComponent(token)}`);
  },

  findByUserId: async (userId: string): Promise<SessionData[]> => {
    return callBackendAPI<SessionData[]>(`/open-api/auth-db/sessions?user_id=${encodeURIComponent(userId)}`);
  },

  update: async (id: string, data: any) => {
    return callBackendAPI(`/open-api/auth-db/session/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: string) => {
    return callBackendAPI(`/open-api/auth-db/session/${id}`, {
      method: 'DELETE',
    });
  },

  deleteByUserId: async (userId: string) => {
    return callBackendAPI(`/open-api/auth-db/sessions?user_id=${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    });
  },
};

/**
 * Account 数据类型
 */
export interface AccountData {
  id: string;
  account_id: string;
  provider_id: string;
  user_id: string;
  access_token: string | null;
  refresh_token: string | null;
  id_token: string | null;
  access_token_expires_at: string | null;
  refresh_token_expires_at: string | null;
  scope: string | null;
  password: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Account 操作
 */
export const accountAPI = {
  create: async (data: any): Promise<AccountData> => {
    return callBackendAPI<AccountData>(`/open-api/auth-db/account`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  findById: async (id: string): Promise<AccountData | null> => {
    return callBackendAPI<AccountData | null>(`/open-api/auth-db/account/${id}`);
  },

  findByProvider: async (providerId: string, accountId: string): Promise<AccountData | null> => {
    return callBackendAPI<AccountData | null>(`/open-api/auth-db/account?provider_id=${encodeURIComponent(providerId)}&account_id=${encodeURIComponent(accountId)}`);
  },

  findByUserId: async (userId: string): Promise<AccountData[]> => {
    return callBackendAPI<AccountData[]>(`/open-api/auth-db/accounts?user_id=${encodeURIComponent(userId)}`);
  },

  update: async (id: string, data: any) => {
    return callBackendAPI(`/open-api/auth-db/account/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: string) => {
    return callBackendAPI(`/open-api/auth-db/account/${id}`, {
      method: 'DELETE',
    });
  },

  deleteByUserId: async (userId: string) => {
    return callBackendAPI(`/open-api/auth-db/accounts?user_id=${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    });
  },
};

/**
 * Verification 操作
 */
export const verificationAPI = {
  create: async (data: any) => {
    return callBackendAPI(`/open-api/auth-db/verification`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  findById: async (id: string) => {
    return callBackendAPI(`/open-api/auth-db/verification/${id}`);
  },

  findByIdentifier: async (identifier: string) => {
    return callBackendAPI(`/open-api/auth-db/verification?identifier=${encodeURIComponent(identifier)}`);
  },

  findByValue: async (value: string) => {
    return callBackendAPI(`/open-api/auth-db/verification?value=${encodeURIComponent(value)}`);
  },

  delete: async (id: string) => {
    return callBackendAPI(`/open-api/auth-db/verification/${id}`, {
      method: 'DELETE',
    });
  },
};

export default {
  user: userAPI,
  session: sessionAPI,
  account: accountAPI,
  verification: verificationAPI,
};

