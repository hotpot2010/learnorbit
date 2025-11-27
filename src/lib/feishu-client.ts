/**
 * 飞书多维表格 API 客户端
 * 文档: https://open.feishu.cn/document/server-docs/docs/bitable-v1/overview
 */

interface FeishuConfig {
  appId: string;
  appSecret: string;
  baseToken: string;
}

interface FeishuRecord {
  fields: Record<string, any>;
}

interface FeishuResponse<T> {
  code: number;
  msg: string;
  data: T;
}

class FeishuClient {
  private appId: string;
  private appSecret: string;
  private baseToken: string;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(config: FeishuConfig) {
    this.appId = config.appId;
    this.appSecret = config.appSecret;
    this.baseToken = config.baseToken;
  }

  /**
   * 获取访问令牌
   */
  private async getAccessToken(): Promise<string> {
    // 如果 token 未过期，直接返回
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_id: this.appId,
        app_secret: this.appSecret,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
    }

    // 飞书 tenant_access_token API 的响应格式是直接在顶层返回，不是嵌套在 data 中
    const data: {
      code: number;
      msg: string;
      tenant_access_token?: string;
      expire?: number;
    } = await response.json();

    // 打印调试信息（仅在开发环境）
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 飞书 API 响应:', JSON.stringify(data, null, 2));
    }

    if (data.code !== 0) {
      throw new Error(`Failed to get access token: ${data.msg} (code: ${data.code})`);
    }

    if (!data.tenant_access_token) {
      throw new Error(`Invalid API response: missing tenant_access_token. Response: ${JSON.stringify(data)}`);
    }

    this.accessToken = data.tenant_access_token;
    // 提前5分钟刷新 token
    const expire = data.expire || 7200; // 默认2小时
    this.tokenExpiresAt = Date.now() + (expire - 300) * 1000;

    return this.accessToken;
  }

  /**
   * 发送 API 请求
   */
  private async request<T>(
    method: string,
    endpoint: string,
    body?: any
  ): Promise<FeishuResponse<T>> {
    const token = await this.getAccessToken();
    const url = `https://open.feishu.cn/open-apis${endpoint}`;

    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
    }

    const data = await response.json();

    // 打印调试信息（如果 API 返回错误）
    if (data.code !== 0) {
      console.error(`\n❌ 飞书 API 错误详情:`);
      console.error(`   方法: ${method}`);
      console.error(`   端点: ${endpoint}`);
      console.error(`   错误码: ${data.code}`);
      console.error(`   错误消息: ${data.msg}`);
      if (data.error) {
        console.error(`   错误详情:`, JSON.stringify(data.error, null, 2));
      }
      // 如果是创建记录的错误，打印请求体的一部分
      if (method === 'POST' && endpoint.includes('/records/batch_create') && body) {
        try {
          const requestBody = typeof body === 'string' ? JSON.parse(body) : body;
          if (requestBody.records && requestBody.records.length > 0) {
            console.error(`   第一条记录示例:`, JSON.stringify(requestBody.records[0], null, 2));
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    }

    if (data.code !== 0) {
      throw new Error(`Feishu API error: ${data.msg} (code: ${data.code})`);
    }

    return data;
  }

  /**
   * 列出所有表
   */
  async listTables(): Promise<Array<{ table_id: string; name: string }>> {
    const response = await this.request<{ items: Array<{ table_id: string; name: string }> }>(
      'GET',
      `/bitable/v1/apps/${this.baseToken}/tables`
    );

    return response.data.items || [];
  }

  /**
   * 获取表 ID（通过表名）
   */
  async getTableId(tableName: string): Promise<string> {
    const tables = await this.listTables();

    const table = tables.find((item) => item.name === tableName);
    if (!table) {
      const availableTables = tables.map((t) => t.name).join(', ');
      throw new Error(
        `Table "${tableName}" not found in Feishu Base.\n` +
        `Available tables: ${availableTables || '(none)'}\n` +
        `Please create the table "${tableName}" in your Feishu Base first.`
      );
    }

    return table.table_id;
  }

  /**
   * 批量创建记录
   */
  async createRecords(
    tableName: string,
    records: FeishuRecord[]
  ): Promise<{ record_ids: string[] }> {
    const tableId = await this.getTableId(tableName);

    // 飞书 API 限制每次最多 500 条记录
    const batchSize = 500;
    const allRecordIds: string[] = [];

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);

      try {
        const response = await this.request<{ records: Array<{ record_id: string }> }>(
          'POST',
          `/bitable/v1/apps/${this.baseToken}/tables/${tableId}/records/batch_create`,
          {
            records: batch,
          }
        );

        const recordIds = response.data.records.map((r) => r.record_id);
        allRecordIds.push(...recordIds);

        // 避免 API 限流，添加延迟
        if (i + batchSize < records.length) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      } catch (error: any) {
        // 打印详细的错误信息和第一条记录的内容用于调试
        console.error(`\n❌ 批量创建记录失败 (批次 ${Math.floor(i / batchSize) + 1}):`);
        console.error(`   表: ${tableName}`);
        console.error(`   记录范围: ${i + 1}-${Math.min(i + batchSize, records.length)}/${records.length}`);
        if (batch.length > 0) {
          console.error(`   第一条记录示例:`, JSON.stringify(batch[0], null, 2));
        }
        console.error(`   错误详情:`, error.message);
        throw error;
      }
    }

    return { record_ids: allRecordIds };
  }

  /**
   * 批量更新记录
   */
  async updateRecords(
    tableName: string,
    records: Array<{ record_id: string; fields: Record<string, any> }>
  ): Promise<void> {
    const tableId = await this.getTableId(tableName);

    const batchSize = 500;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);

      await this.request(
        'POST',
        `/bitable/v1/apps/${this.baseToken}/tables/${tableId}/records/batch_update`,
        {
          records: batch,
        }
      );

      if (i + batchSize < records.length) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
  }

  /**
   * 上传文本内容作为文件到飞书云空间
   * @param content 文本内容
   * @param fileName 文件名
   * @param tableName 表名（用于调试，实际不需要）
   * @returns file_token
   * 
   * 参考文档: https://open.feishu.cn/document/server-docs/docs/drive-v1/media/upload_all
   */
  async uploadTextAsFile(content: string, fileName: string, tableName?: string): Promise<string> {
    const token = await this.getAccessToken();
    
    // 根据飞书 API 文档，parent_node 应该是多维表格的 baseToken，而不是 table_id
    // extra 中的 drive_route_token 也应该是 baseToken
    
    // 使用临时文件方式上传（更可靠）
    const fs = await import('fs/promises');
    const path = await import('path');
    const os = await import('os');
    
    // 创建临时文件
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `feishu_upload_${Date.now()}_${fileName}`);
    
    try {
      // 写入临时文件
      await fs.writeFile(tempFilePath, content, 'utf-8');
      
      // 读取文件内容并获取文件大小
      const fileStats = await fs.stat(tempFilePath);
      const fileContent = await fs.readFile(tempFilePath);
      
      // 创建 FormData
      const FormData = (await import('form-data')).default;
      const formData = new FormData();
      
      // 关键：根据飞书 API 文档，字段顺序可能很重要
      // 先添加文本字段，最后添加文件字段
      
      // 添加其他必需字段（根据飞书 API 文档）
      // 注意：字段顺序可能很重要，按照文档顺序添加
      // 关键：添加 extra 参数，包含 drive_route_token（多维表格的 baseToken）
      // extra 必须是 JSON 字符串格式，应该在其他字段之前
      const extra = JSON.stringify({
        drive_route_token: this.baseToken,
      });
      formData.append('extra', extra);
      
      formData.append('file_name', fileName);
      formData.append('parent_type', 'bitable_file');
      formData.append('parent_node', this.baseToken); // 使用 baseToken（多维表格的应用 token），而不是 table_id
      formData.append('size', fileStats.size.toString()); // 文件大小（字节）- 必需参数
      
      // 注意：checksum 参数根据错误信息格式不正确，暂时不添加
      // 如果 API 需要校验，可能会自动计算
      
      // 最后添加文件（使用文件流，更可靠）
      const fsSync = await import('fs');
      const fileStream = fsSync.createReadStream(tempFilePath);
      formData.append('file', fileStream, {
        filename: fileName,
        contentType: 'application/json',
        knownLength: fileStats.size,
      });

      // 获取 FormData 的 headers
      const headers = formData.getHeaders();
      
      // 打印调试信息
      console.log(`    🔍 上传参数:`, {
        file_name: fileName,
        parent_type: 'bitable_file',
        parent_node: this.baseToken,
        extra: extra,
        file_size: fileStats.size,
        content_type: headers['content-type'],
      });
      
      // 使用 node-fetch 或 https 模块上传文件（fetch API 可能不完全支持 form-data 流）
      // 尝试使用 https 模块直接发送请求
      const https = await import('https');
      const url = await import('url');
      
      return new Promise<string>((resolve, reject) => {
        const parsedUrl = url.parse('https://open.feishu.cn/open-apis/drive/v1/medias/upload_all');
        
        const options = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || 443,
          path: parsedUrl.path,
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            ...headers,
          },
        };

        const req = https.request(options, (res) => {
          let responseData = '';
          
          res.on('data', (chunk) => {
            responseData += chunk;
          });
          
          res.on('end', () => {
            // 关闭文件流
            fileStream.close();
            
            if (res.statusCode !== 200) {
              console.error(`❌ 上传文件失败详情:`, {
                status: res.statusCode,
                statusText: res.statusMessage,
                body: responseData,
              });
              reject(new Error(`HTTP error! status: ${res.statusCode}, body: ${responseData}`));
              return;
            }

            try {
              const data = JSON.parse(responseData);
              
              if (data.code !== 0) {
                console.error(`❌ 飞书 API 错误:`, {
                  code: data.code,
                  msg: data.msg,
                  data: data.data,
                });
                reject(new Error(`Feishu API error: ${data.msg} (code: ${data.code})`));
                return;
              }

              resolve(data.data.file_token);
            } catch (e) {
              reject(new Error(`Failed to parse response: ${responseData}`));
            }
          });
        });

        req.on('error', (error) => {
          fileStream.close();
          reject(error);
        });

        // 将 FormData 流式传输到请求
        formData.pipe(req);
      });
    } finally {
      // 清理临时文件
      try {
        await fs.unlink(tempFilePath);
      } catch (e) {
        // 忽略删除失败的错误
      }
    }
  }

  /**
   * 查询记录
   */
  async queryRecords(
    tableName: string,
    filter?: any,
    pageSize: number = 100
  ): Promise<{ records: FeishuRecord[]; has_more: boolean; page_token?: string }> {
    const tableId = await this.getTableId(tableName);

    const response = await this.request<{
      items: FeishuRecord[];
      has_more: boolean;
      page_token?: string;
    }>(
      'POST',
      `/bitable/v1/apps/${this.baseToken}/tables/${tableId}/records/search`,
      {
        filter,
        page_size: pageSize,
      }
    );

    return {
      records: response.data.items,
      has_more: response.data.has_more,
      page_token: response.data.page_token,
    };
  }

  /**
   * 创建表
   */
  async createTable(tableName: string): Promise<string> {
    const response = await this.request<{ table: { table_id: string } }>(
      'POST',
      `/bitable/v1/apps/${this.baseToken}/tables`,
      {
        table: {
          name: tableName,
        },
      }
    );

    // 打印调试信息
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 创建表 API 响应:', JSON.stringify(response, null, 2));
    }

    // 检查响应格式
    if (!response.data) {
      throw new Error(`Invalid API response: missing data. Response: ${JSON.stringify(response)}`);
    }

    // 飞书 API 可能直接返回 table 对象，也可能嵌套在 data 中
    const table = (response.data as any).table || response.data;
    if (!table || !table.table_id) {
      throw new Error(`Invalid API response: missing table_id. Response: ${JSON.stringify(response)}`);
    }

    return table.table_id;
  }

  /**
   * 创建字段
   */
  async createField(
    tableId: string,
    fieldName: string,
    fieldType: number,
    property?: any
  ): Promise<string> {
    const requestBody: any = {
      field_name: fieldName,
      type: fieldType,
    };

    if (property) {
      requestBody.property = property;
    }

    const response = await this.request<{ field: { field_id: string } }>(
      'POST',
      `/bitable/v1/apps/${this.baseToken}/tables/${tableId}/fields`,
      requestBody
    );

    return response.data.field.field_id;
  }

  /**
   * 获取表的字段列表
   */
  async getFields(tableId: string): Promise<Array<{ field_id: string; field_name: string; type: number }>> {
    const response = await this.request<{ items: Array<{ field_id: string; field_name: string; type: number }> }>(
      'GET',
      `/bitable/v1/apps/${this.baseToken}/tables/${tableId}/fields`
    );

    return response.data.items || [];
  }
}

// 创建单例
let feishuClient: FeishuClient | null = null;

export function getFeishuClient(): FeishuClient {
  if (!feishuClient) {
    const appId = process.env.FEISHU_APP_ID;
    const appSecret = process.env.FEISHU_APP_SECRET;
    const baseToken = process.env.FEISHU_BASE_TOKEN;

    if (!appId || !appSecret || !baseToken) {
      throw new Error(
        'Feishu configuration missing. Please set FEISHU_APP_ID, FEISHU_APP_SECRET, and FEISHU_BASE_TOKEN'
      );
    }

    feishuClient = new FeishuClient({
      appId,
      appSecret,
      baseToken,
    });
  }

  return feishuClient;
}

export { FeishuClient };
export type { FeishuRecord, FeishuConfig };

// 导出字段类型常量（供建表脚本使用）
export const FEISHU_FIELD_TYPES = {
  TEXT: 1,           // 多行文本
  NUMBER: 2,         // 数字
  SINGLE_SELECT: 3,  // 单选
  MULTI_SELECT: 4,   // 多选
  DATE: 5,           // 日期
  CHECKBOX: 7,       // 复选框
  PERSON: 11,        // 人员
  PHONE: 13,         // 电话号码
  URL: 15,           // 超链接
  ATTACHMENT: 17,    // 附件
  LINK: 18,          // 关联
  FORMULA: 19,       // 公式
  CREATED_TIME: 1001, // 创建时间
  MODIFIED_TIME: 1002, // 最后更新时间
  CREATOR: 1003,     // 创建人
  MODIFIER: 1004,    // 修改人
  AUTO_NUMBER: 1005, // 自动编号
};

