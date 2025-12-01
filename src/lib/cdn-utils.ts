/**
 * CDN 工具函数：上传和下载 JSON 文件
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const UPLOAD_ENDPOINT = `${API_BASE_URL}/open-api/upload`;
const CDN_BASE_URL = 'http://file.gsxservice.com';

interface UploadResponse {
  total?: number;
  ok?: number;
  fail?: number;
  files?: Array<{
    key: string;
    url: string;
    [key: string]: any;
  }>;
  code?: number;
  data?: {
    url?: string;
    path?: string;
  };
  url?: string;
}

/**
 * 上传 JSON 内容到 CDN
 * @param jsonContent JSON 字符串内容
 * @param filename 文件名
 * @returns CDN URL
 */
export async function uploadJsonToCDN(jsonContent: string, filename: string): Promise<string> {
  try {
    // 创建 FormData（Node.js 环境）
    const FormData = (await import('form-data')).default;
    const formData = new FormData();
    
    // 创建 Buffer 对象
    const buffer = Buffer.from(jsonContent, 'utf-8');
    formData.append('file0', buffer, {
      filename: filename,
      contentType: 'application/json',
    });

    console.log(`📤 上传文件到 CDN: ${filename} (${buffer.length} bytes)`);

    // 获取 headers（包含 boundary）
    const headers = formData.getHeaders();
    
    // 使用 Node.js 的 http/https 模块发送请求（更好的 form-data 支持）
    const url = new URL(UPLOAD_ENDPOINT);
    const httpModule = url.protocol === 'https:' ? await import('https') : await import('http');
    
    return new Promise<string>((resolve, reject) => {
      const request = httpModule.request(
        {
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: url.pathname + url.search,
          method: 'POST',
          headers: headers,
        },
        (response) => {
          let responseData = '';
          
          response.on('data', (chunk) => {
            responseData += chunk.toString();
          });
          
          response.on('end', () => {
            if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
              try {
                const result: UploadResponse = JSON.parse(responseData);
                
                // 解析响应获取 URL
                let fileUrl: string | null = null;

                // 格式1: files 数组格式
                if (result.files && Array.isArray(result.files) && result.files.length > 0) {
                  const fileInfo = result.files[0];
                  fileUrl = fileInfo.url || fileInfo.path;
                }
                // 格式2: data 对象格式
                else if (result.code === 0 && result.data) {
                  fileUrl = result.data.url || result.data.path;
                }
                // 格式3: 直接返回 URL
                else if (result.url) {
                  fileUrl = result.url;
                }

                if (!fileUrl) {
                  reject(new Error(`无法从响应中提取URL: ${JSON.stringify(result)}`));
                  return;
                }

                // 处理相对路径
                if (!fileUrl.startsWith('http')) {
                  const normalizedPath = fileUrl.startsWith('/') ? fileUrl : `/${fileUrl}`;
                  fileUrl = `${CDN_BASE_URL}${normalizedPath}`;
                }

                console.log(`✅ 上传成功，CDN URL: ${fileUrl}`);
                resolve(fileUrl);
              } catch (parseError) {
                reject(new Error(`解析响应失败: ${parseError}\n响应内容: ${responseData}`));
              }
            } else {
              reject(new Error(`上传失败 (${response.statusCode}): ${responseData}`));
            }
          });
        }
      );
      
      request.on('error', (error) => {
        reject(new Error(`请求失败: ${error.message}`));
      });
      
      // 将 form-data stream 连接到 request
      formData.pipe(request);
    });

  } catch (error) {
    console.error(`❌ 上传失败:`, error);
    throw error;
  }
}

/**
 * 从 CDN URL 下载 JSON 内容
 * @param url CDN URL
 * @returns 解析后的 JSON 对象
 */
export async function downloadJsonFromCDN(url: string): Promise<any> {
  try {
    console.log(`📥 从 CDN 下载 JSON: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`下载失败 (${response.status}): ${response.statusText}`);
    }

    const jsonData = await response.json();
    console.log(`✅ 下载成功，数据大小: ${JSON.stringify(jsonData).length} 字符`);
    return jsonData;
  } catch (error) {
    console.error(`❌ 下载失败:`, error);
    throw error;
  }
}

