// 关键词同义词映射表（缩写 -> 完整名称）
const KEYWORD_SYNONYMS: Record<string, string[]> = {
  '线代': ['线代', '线性代数'],
  '高数': ['高数', '高等数学'],
  '概率论': ['概率论', '概率论与数理统计'],
  '离散': ['离散', '离散数学'],
  '数分': ['数分', '数学分析'],
  '复变': ['复变', '复变函数'],
  '实变': ['实变', '实变函数'],
  '泛函': ['泛函', '泛函分析'],
  '拓扑': ['拓扑', '拓扑学'],
  '代数': ['代数', '抽象代数'],
  '微分': ['微分', '微分方程'],
  '偏微分': ['偏微分', '偏微分方程'],
  '常微分': ['常微分', '常微分方程'],
  '初会': ['初会', '初级会计', '初级会计实务', '会计初级'],
  '中会': ['中会', '中级会计', '中级会计实务', '会计中级'],
  '高会': ['高会', '高级会计', '高级会计实务', '会计高级'],
};

/**
 * 扩展搜索关键词（添加同义词）
 * @param keyword 原始关键词
 * @returns 扩展后的关键词数组
 */
export function expandSearchKeywords(keyword: string): string[] {
  const lowerKeyword = keyword.toLowerCase().trim();
  const expanded: string[] = [keyword]; // 包含原始关键词
  
  // 检查是否有匹配的同义词（正向：缩写 -> 完整名称）
  for (const [key, synonyms] of Object.entries(KEYWORD_SYNONYMS)) {
    if (lowerKeyword === key.toLowerCase()) {
      // 添加所有同义词
      expanded.push(...synonyms);
      return expanded;
    }
  }
  
  // 反向检查：如果输入是完整名称，也返回对应的缩写和同义词
  for (const [key, synonyms] of Object.entries(KEYWORD_SYNONYMS)) {
    if (synonyms.some(syn => syn.toLowerCase() === lowerKeyword)) {
      // 找到匹配的同义词，返回键（缩写）和所有同义词
      expanded.push(key);
      expanded.push(...synonyms);
      return Array.from(new Set(expanded)); // 去重
    }
  }
  
  // 如果没有同义词，返回原始关键词
  return [keyword];
}

/**
 * 检查文本是否匹配搜索关键词（支持同义词扩展）
 * @param text 要搜索的文本
 * @param keyword 搜索关键词
 * @returns 是否匹配
 */
export function matchesSearchKeyword(text: string, keyword: string): boolean {
  const lowerText = text.toLowerCase();
  const expandedKeywords = expandSearchKeywords(keyword);
  
  // 检查是否匹配任何一个扩展后的关键词
  return expandedKeywords.some(kw => lowerText.includes(kw.toLowerCase()));
}
