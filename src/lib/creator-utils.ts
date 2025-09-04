// 创作者邮箱列表
const CREATOR_EMAILS = [
  'zhouletao20@gmail.com',
  'ritafeng1234@gmail.com'
];

/**
 * 检查邮箱是否为创作者账号
 */
export function isCreatorEmail(email: string): boolean {
  return CREATOR_EMAILS.includes(email.toLowerCase());
}

/**
 * 生成slug - 创作者使用简洁URL，普通用户使用带用户ID的URL
 */
export function generateCourseSlug(title: string, ownerId: string, isCreator: boolean): string {
  const cleanTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff\s-]/g, '') // 保留中文、英文、数字、空格、连字符
    .replace(/\s+/g, '-') // 空格替换为连字符
    .replace(/-+/g, '-') // 多个连字符合并为一个
    .trim();

  // 创作者使用简洁URL，普通用户使用带用户ID的URL
  return isCreator ? cleanTitle : `${cleanTitle}-${ownerId}`;
}

/**
 * 从slug反向解析标题（用于创作者课程）
 */
export function extractTitleFromSlug(slug: string): string {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
