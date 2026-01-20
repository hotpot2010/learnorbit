/**
 * Better Auth 自定义数据库适配器
 * 通过 Backend API 访问数据库，而不是直接访问数据库
 */
import type { Adapter, BetterAuthOptions } from 'better-auth';
import { generateId } from 'better-auth';
import authAdapterAPI from './auth-adapter-api';

/**
 * 创建 Backend API 适配器
 * 返回一个函数，该函数接收 BetterAuthOptions 并返回 Adapter
 */
export function createBackendAPIAdapter() {
  return (options: BetterAuthOptions): Adapter => {
    // 简单的 debugLog 函数
    const debugLog = (...args: any[]) => {
      if (options.logger?.level === 'debug') {
        console.log('[Backend API Adapter]', ...args);
      }
    };

    // 模型名映射（Better Auth 模型名 -> Backend API 表名）
    const modelNameMap: Record<string, string> = {
      'user': 'learnorbit_user',
      'session': 'learnorbit_session',
      'account': 'learnorbit_account',
      'verification': 'learnorbit_verification',
    };

    // 字段名映射（camelCase -> snake_case）
    const fieldNameMap: Record<string, Record<string, string>> = {
      'user': {
        'emailVerified': 'email_verified',
        'customerId': 'customer_id',
        'createdAt': 'created_at',
        'updatedAt': 'updated_at',
      },
      'session': {
        'userId': 'user_id',
        'expiresAt': 'expires_at',
        'ipAddress': 'ip_address',
        'userAgent': 'user_agent',
        'createdAt': 'created_at',
        'updatedAt': 'updated_at',
      },
      'account': {
        'accountId': 'account_id',
        'providerId': 'provider_id',
        'userId': 'user_id',
        'accessToken': 'access_token',
        'refreshToken': 'refresh_token',
        'idToken': 'id_token',
        'accessTokenExpiresAt': 'access_token_expires_at',
        'refreshTokenExpiresAt': 'refresh_token_expires_at',
        'createdAt': 'created_at',
        'updatedAt': 'updated_at',
      },
      'verification': {
        'expiresAt': 'expires_at',
        'createdAt': 'created_at',
        'updatedAt': 'updated_at',
      },
    };

    // 转换字段名（camelCase -> snake_case）
    function transformFieldName(model: string, field: string): string {
      return fieldNameMap[model]?.[field] || field;
    }

    // 转换数据（输入：camelCase -> snake_case）
    function transformInputData(model: string, data: any): any {
      const transformed: any = {};
      for (const [key, value] of Object.entries(data)) {
        const dbFieldName = transformFieldName(model, key);
        transformed[dbFieldName] = value;
      }
      return transformed;
    }

    // 转换数据（输出：snake_case -> camelCase）
    function transformOutputData(model: string, data: any): any {
      if (!data) return data;
      
      const transformed: any = {};
      const reverseMap: Record<string, string> = {};
      
      // 创建反向映射
      if (fieldNameMap[model]) {
        for (const [camel, snake] of Object.entries(fieldNameMap[model])) {
          reverseMap[snake] = camel;
        }
      }
      
      for (const [key, value] of Object.entries(data)) {
        const camelKey = reverseMap[key] || key;
        transformed[camelKey] = value;
      }
      
      // 处理日期字段
      if (transformed.created_at) transformed.createdAt = new Date(transformed.created_at);
      if (transformed.updated_at) transformed.updatedAt = new Date(transformed.updated_at);
      if (transformed.expires_at) transformed.expiresAt = new Date(transformed.expires_at);
      
      return transformed;
    }

    return {
      id: 'backend-api-adapter',
      async count({ model, where }: { model: string; where?: any[] }): Promise<number> {
        debugLog(`[Backend API] count ${model}`, where);
        try {
          // 根据不同的模型和查询条件返回计数
          if (!where || where.length === 0) return 0;
          
          if (model === 'session' && where[0].field === 'userId') {
            const userId = where[0].value;
            const results = await authAdapterAPI.session.findByUserId(userId);
            return results.length;
          } else if (model === 'account' && where[0].field === 'userId') {
            const userId = where[0].value;
            const results = await authAdapterAPI.account.findByUserId(userId);
            return results.length;
          }
          
          // 对于其他情况，尝试 findOne 查询，如果找到则返回 1
          const firstCondition = where[0];
          const field = transformFieldName(model, firstCondition.field);
          
          if (model === 'user') {
            if (field === 'id') {
              const result = await authAdapterAPI.user.findById(firstCondition.value);
              return result ? 1 : 0;
            } else if (field === 'email') {
              const result = await authAdapterAPI.user.findByEmail(firstCondition.value);
              return result ? 1 : 0;
            }
          }
          
          return 0;
        } catch (error) {
          console.error(`[Backend API] count ${model} error:`, error);
          return 0;
        }
      },
      async create<T extends Record<string, any>, R = T>({ data, model, select }: { model: string; data: T; select?: string[] }): Promise<R> {
        debugLog(`[Backend API] create ${model}`, data);
        
        try {
          // 确保数据中有 id 字段（如果缺失则生成）
          const dataWithId: any = { ...data };
          if (!dataWithId.id) {
            dataWithId.id = generateId();
            debugLog(`[Backend API] Generated ID for ${model}:`, dataWithId.id);
          }
          
          const transformedData = transformInputData(model, dataWithId);
          
          // 根据模型调用不同的 API
          if (model === 'user') {
            const result = await authAdapterAPI.user.create(transformedData);
            return transformOutputData(model, result) as R;
          } else if (model === 'session') {
            const result = await authAdapterAPI.session.create(transformedData);
            return transformOutputData(model, result) as R;
          } else if (model === 'account') {
            const result = await authAdapterAPI.account.create(transformedData);
            return transformOutputData(model, result) as R;
          } else if (model === 'verification') {
            const result = await authAdapterAPI.verification.create(transformedData);
            return transformOutputData(model, result) as R;
          }
          
          throw new Error(`Unsupported model: ${model}`);
        } catch (error: any) {
          console.error(`❌ [Backend API Adapter] Failed to create ${model}:`, {
            model,
            data,
            error: error.message || error,
            status: error.status,
            endpoint: error.endpoint,
          });
          throw error;
        }
      },

      async findOne<T>({ model, where, select }: { model: string; where: any[]; select?: string[] }): Promise<T | null> {
        debugLog(`[Backend API] findOne ${model}`, where);
        
        // 处理 where 条件
        if (where.length === 0) return null;
        
        const firstCondition = where[0];
        const field = transformFieldName(model, firstCondition.field);
        
        if (model === 'user') {
          if (field === 'id') {
            const result = await authAdapterAPI.user.findById(firstCondition.value);
            return transformOutputData(model, result) as T | null;
          } else if (field === 'email') {
            const result = await authAdapterAPI.user.findByEmail(firstCondition.value);
            return transformOutputData(model, result) as T | null;
          }
        } else if (model === 'session') {
          if (field === 'id') {
            const result = await authAdapterAPI.session.findById(firstCondition.value);
            return transformOutputData(model, result) as T | null;
          } else if (field === 'token') {
            const result = await authAdapterAPI.session.findByToken(firstCondition.value);
            return transformOutputData(model, result) as T | null;
          }
        } else if (model === 'account') {
          if (field === 'id') {
            const result = await authAdapterAPI.account.findById(firstCondition.value);
            return transformOutputData(model, result) as T | null;
          } else if (where.length >= 2) {
            // 处理通过 provider_id 和 account_id 查询的情况
            // Better Auth 可能以不同顺序传递条件，需要查找这两个字段
            let providerId: string | undefined;
            let accountId: string | undefined;
            
            for (const condition of where) {
              const conditionField = transformFieldName(model, condition.field);
              if (conditionField === 'provider_id') {
                providerId = condition.value;
              } else if (conditionField === 'account_id') {
                accountId = condition.value;
              }
            }
            
            if (providerId && accountId) {
              const result = await authAdapterAPI.account.findByProvider(providerId, accountId);
              return transformOutputData(model, result) as T | null;
            }
          }
        } else if (model === 'verification') {
          if (field === 'id') {
            const result = await authAdapterAPI.verification.findById(firstCondition.value);
            return transformOutputData(model, result) as T | null;
          } else if (field === 'identifier') {
            const result = await authAdapterAPI.verification.findByIdentifier(firstCondition.value);
            return transformOutputData(model, result) as T | null;
          } else if (field === 'value') {
            // Better Auth 在 OAuth 回调时通过 value 字段查询 state
            const result = await authAdapterAPI.verification.findByValue(firstCondition.value);
            return transformOutputData(model, result) as T | null;
          }
        }
        
        return null;
      },

      async findMany<T>({ model, where, limit, sortBy, offset }: { model: string; where?: any[]; limit?: number; sortBy?: { field: string; direction: 'asc' | 'desc' }; offset?: number }): Promise<T[]> {
        debugLog(`[Backend API] findMany ${model}`, { where, limit, offset });
        
        if (model === 'session' && where && where.length > 0 && where[0].field === 'userId') {
          const userId = where[0].value;
          const results = await authAdapterAPI.session.findByUserId(userId);
          return results.map(r => transformOutputData(model, r)) as T[];
        } else if (model === 'account' && where && where.length > 0 && where[0].field === 'userId') {
          const userId = where[0].value;
          const results = await authAdapterAPI.account.findByUserId(userId);
          return results.map(r => transformOutputData(model, r)) as T[];
        }
        
        return [];
      },

      async update<T>({ model, where, update }: { model: string; where: any[]; update: Record<string, any> }): Promise<T | null> {
        debugLog(`[Backend API] update ${model}`, { where, update });
        
        if (where.length === 0) return null;
        
        const firstCondition = where[0];
        const id = firstCondition.value;
        const transformedUpdate = transformInputData(model, update);
        
        if (model === 'user') {
          const result = await authAdapterAPI.user.update(id, transformedUpdate);
          return transformOutputData(model, result) as T | null;
        } else if (model === 'session') {
          const result = await authAdapterAPI.session.update(id, transformedUpdate);
          return transformOutputData(model, result) as T | null;
        } else if (model === 'account') {
          const result = await authAdapterAPI.account.update(id, transformedUpdate);
          return transformOutputData(model, result) as T | null;
        }
        
        return null;
      },

      async updateMany({ model, where, update }: { model: string; where: any[]; update: Record<string, any> }): Promise<any> {
        debugLog(`[Backend API] updateMany ${model}`, { where, update });
        // Backend API 不支持批量更新，返回 0
        return 0;
      },

      async delete({ model, where }: { model: string; where: any[] }): Promise<void> {
        debugLog(`[Backend API] delete ${model}`, where);
        
        if (where.length === 0) return;
        
        const firstCondition = where[0];
        const id = firstCondition.value;
        
        if (!id || typeof id !== 'string') {
          return;
        }
        
        if (model === 'user') {
          await authAdapterAPI.user.delete(id);
        } else if (model === 'session') {
          await authAdapterAPI.session.delete(id);
        } else if (model === 'account') {
          await authAdapterAPI.account.delete(id);
        } else if (model === 'verification') {
          await authAdapterAPI.verification.delete(id);
        }
      },

      async deleteMany({ model, where }: { model: string; where: any[] }): Promise<any> {
        debugLog(`[Backend API] deleteMany ${model}`, where);
        
        if (where.length === 0) return 0;
        
        const firstCondition = where[0];
        const userId = firstCondition.value;
        
        if (!userId || typeof userId !== 'string') {
          return 0;
        }
        
        if (model === 'session' && firstCondition.field === 'userId') {
          await authAdapterAPI.session.deleteByUserId(userId);
          return 1; // 返回删除的数量（实际数量未知）
        } else if (model === 'account' && firstCondition.field === 'userId') {
          await authAdapterAPI.account.deleteByUserId(userId);
          return 1; // 返回删除的数量（实际数量未知）
        }
        
        return 0;
      },
    };
  };
}
