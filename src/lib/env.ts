/**
 * Environment variables utility
 * Ensures all required environment variables are loaded correctly
 */

export function getClientBaseUrl(): string {
  // 在客户端，使用 window.location 或环境变量
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.host}`;
  }
  
  // 在服务端，使用环境变量
  return process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
}

export function getServerBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
}

export function logEnvironmentInfo() {
  console.log('🔧 Environment Info:', {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    isClient: typeof window !== 'undefined',
    actualBaseUrl: typeof window !== 'undefined' 
      ? `${window.location.protocol}//${window.location.host}`
      : 'server-side'
  });
} 
 
 
 