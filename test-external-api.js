// 测试外部API连通性
const EXTERNAL_API_URL = 'http://172.30.106.167:5000';

async function testExternalAPI() {
  console.log('🧪 测试外部API连通性...');
  console.log('目标URL:', `${EXTERNAL_API_URL}/api/task/generate`);
  
  const testData = {
    step: 1,
    title: "测试任务",
    description: "这是一个测试任务",
    animation_type: "无",
    status: "待完成",
    type: "quiz",
    difficulty: "beginner",
    videos: [
      {
        title: "测试视频",
        url: "http://www.bilibili.com/video/av80179024",
        cover: "//i1.hdslb.com/bfs/archive/test.jpg",
        duration: "10:00"
      }
    ]
  };

  try {
    console.log('📤 发送测试请求...');
    console.log('请求数据:', testData);
    
    const response = await fetch(`${EXTERNAL_API_URL}/api/task/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(testData)
    });

    console.log('📥 响应状态:', response.status, response.statusText);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('✅ API响应成功:');
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('❌ API测试失败:', error.message);
    console.error('详细错误:', error);
  }
}

// 运行测试
testExternalAPI(); 