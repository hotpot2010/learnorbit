import { type NextRequest, NextResponse } from 'next/server';

// 使用后端API URL配置（来自 .env.local）
const BACKEND_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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
};

// 学科关键词列表（用于从自然语言中提取）
const SUBJECT_KEYWORDS = [
  // 数学类
  '数学', '线性代数', '线代', '高等数学', '高数', '微积分',
  '概率论', '概率', '统计', '离散数学', '离散', '数学分析', '数分',
  '复变函数', '复变', '实变函数', '实变', '泛函分析', '泛函',
  '拓扑学', '拓扑', '抽象代数', '代数', '几何', '解析几何',
  '微分方程', '微分', '偏微分方程', '偏微分', '常微分方程', '常微分',
  
  // 编程类
  '编程', 'python', 'java', 'javascript', 'js', 'c语言', 'c++',
  '算法', '数据结构', '前端', '后端', 'web', '网页',
  
  // 英语类
  '英语', '英文', '四级', '六级', '雅思', '托福', 'toefl', 'ielts',
  
  // 物理类
  '物理', '力学', '电磁学', '光学', '热学', '量子', '相对论',
  
  // 化学类
  '化学', '有机', '无机', '物化', '分析化学',
  
  // 其他学科
  '经济', '管理', '会计', '金融', '法律', '历史', '政治',
];

// 从自然语言中提取关键词
function extractKeywords(input: string): string[] {
  const lowerInput = input.toLowerCase().trim();
  const extractedKeywords: string[] = [];
  
  // 遍历所有学科关键词，查找匹配
  for (const keyword of SUBJECT_KEYWORDS) {
    if (lowerInput.includes(keyword.toLowerCase())) {
      extractedKeywords.push(keyword);
    }
  }
  
  // 如果没有提取到关键词，返回原始输入
  if (extractedKeywords.length === 0) {
    return [input];
  }
  
  return extractedKeywords;
}

// 扩展关键词（添加同义词）
function expandKeywords(keyword: string): string[] {
  const lowerKeyword = keyword.toLowerCase().trim();
  
  // 检查是否有匹配的同义词
  for (const [key, synonyms] of Object.entries(KEYWORD_SYNONYMS)) {
    if (lowerKeyword === key.toLowerCase()) {
      return synonyms;
    }
  }
  
  // 如果没有同义词，返回原始关键词
  return [keyword];
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const keyword = searchParams.get('keyword') || '';
    
    console.log('🔍 查询已处理视频:', { keyword, BACKEND_API_URL });

    // 调用后端API获取所有已处理的视频任务（增加limit以获取更多视频）
    const backendUrl = `${BACKEND_API_URL}/open-api/offline-video/tasks?limit=500&offset=0`;
    console.log('📡 请求URL:', backendUrl);
    
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('📥 后端响应状态:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ 后端API错误:', errorText);
      throw new Error(`Backend API returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log('📥 后端返回数据:', {
      success: data.success,
      total: data.total,
      tasksCount: data.tasks?.length || 0,
    });

    if (!data.success || !Array.isArray(data.tasks)) {
      return NextResponse.json({
        success: false,
        videos: [],
        message: '获取已处理视频失败',
      });
    }

    // 筛选已完成的任务（所有三个步骤都成功或部分成功）
    const completedTasks = data.tasks.filter((task: any) => {
      const downloadStatus = task.steps?.download?.status;
      const asrStatus = task.steps?.asr?.status;
      const kpStatus = task.steps?.knowledge_points?.status;
      
      return (
        (downloadStatus === 'success' || downloadStatus === 'partial_success') &&
        (asrStatus === 'success' || asrStatus === 'partial_success') &&
        (kpStatus === 'success' || kpStatus === 'partial_success')
      );
    });

    // 如果有关键词，进行多字段搜索（标题、描述、作者）
    let filteredTasks = completedTasks;
    if (keyword) {
      // 1. 从自然语言中提取关键词
      const extractedKeywords = extractKeywords(keyword);
      console.log('🔍 关键词提取:', { original: keyword, extracted: extractedKeywords });
      
      // 2. 对每个提取的关键词进行同义词扩展
      const allExpandedKeywords: string[] = [];
      for (const kw of extractedKeywords) {
        const expanded = expandKeywords(kw);
        allExpandedKeywords.push(...expanded);
      }
      
      // 去重
      const uniqueKeywords = Array.from(new Set(allExpandedKeywords));
      console.log('🔍 关键词扩展后:', { expanded: uniqueKeywords });
      
      filteredTasks = completedTasks.filter((task: any) => {
        const videoInfo = task.video_info || {};
        const title = (task.title || task.video_title || '').toLowerCase();
        const description = (task.description || videoInfo.description || '').toLowerCase();
        const author = (task.author || videoInfo.uploader || '').toLowerCase();
        const targetAudience = (task.target_audience || '').toLowerCase();
        
        // 使用所有扩展后的关键词进行搜索（只要匹配任何一个关键词即可）
        return uniqueKeywords.some(kw => {
          const lowerKw = kw.toLowerCase();
          return (
            title.includes(lowerKw) ||
            description.includes(lowerKw) ||
            author.includes(lowerKw) ||
            targetAudience.includes(lowerKw)
          );
        });
      });
    }

    // 转换为前端需要的格式
    const videos = filteredTasks.map((task: any) => {
      // 从 video_info 获取封面URL（优先使用CDN）
      const videoInfo = task.video_info || {};
      const thumbnailCdn = videoInfo.thumbnail_cdn || '';
      const thumbnail = videoInfo.thumbnail || '';
      const coverUrl = thumbnailCdn || thumbnail;

      // 获取播放数（系列视频优先从 video_info 获取）
      const isSeries = Array.isArray(task.series_parts) && task.series_parts.length > 1;
      let playCount = 0;
      
      if (isSeries) {
        // 系列视频：优先使用 video_info.view_count
        playCount = videoInfo.view_count || task.play_count || 0;
      } else {
        // 单视频：优先使用 task.play_count
        playCount = task.play_count || videoInfo.view_count || 0;
      }

      return {
        title: task.title || task.video_title || '未知标题',
        url: task.bilibili_url,
        cover: coverUrl, // 使用 video_info 中的封面
        thumbnail_cdn: thumbnailCdn, // 额外提供 CDN URL
        duration: task.duration || '00:00:00',
        author: task.author || videoInfo.uploader || '未知',
        play: playCount,
        video_amount: task.series_parts?.length || 1,
        is_series: isSeries,
        target_audience: task.target_audience || '全部',
        description: task.description || videoInfo.description || '',
        // 额外字段：已处理数据
        task_id: task.task_id,
        video_url: task.video_url,
        asr_result_url: task.asr_result_url,
        knowledge_points_result_url: task.knowledge_points_result_url,
        processed: true, // 标记为已处理
      };
    });

    console.log('✅ 返回已处理视频:', {
      totalCompleted: completedTasks.length,
      filteredCount: videos.length,
      keyword,
    });

    return NextResponse.json({
      success: true,
      videos,
      total: videos.length,
      source: 'database',
    });
  } catch (error: any) {
    console.error('❌ 查询已处理视频失败:', error);
    return NextResponse.json(
      {
        success: false,
        videos: [],
        message: error.message || '查询失败',
      },
      { status: 500 }
    );
  }
}

