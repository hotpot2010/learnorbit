const fs = require('fs');
const path = require('path');

// 读取示例计划数据
const planPath = path.join(__dirname, 'src/lib/api/plan.json');
const planData = JSON.parse(fs.readFileSync(planPath, 'utf8'));

// 测试回调函数
async function testCallback() {
  const sessionId = 'session-test-' + Date.now();
  const callbackUrl = 'http://172.30.125.100:3000/api/plan/update';
  
  console.log('🧪 开始测试回调功能');
  console.log('SessionId:', sessionId);
  console.log('回调URL:', callbackUrl);
  console.log('计划数据步骤数:', planData.plan.length);
  
  const requestData = {
    sessionId: sessionId,
    plan: planData
  };
  
  try {
    console.log('\n📤 发送回调请求...');
    const response = await fetch(callbackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData)
    });
    
    console.log('📨 响应状态:', response.status);
    const result = await response.json();
    console.log('📋 响应内容:', result);
    
    if (response.ok) {
      console.log('✅ 回调测试成功！');
    } else {
      console.log('❌ 回调测试失败');
    }
    
  } catch (error) {
    console.error('❌ 请求失败:', error.message);
    console.log('\n💡 请确保:');
    console.log('1. Next.js 开发服务器正在运行 (npm run dev)');
    console.log('2. IP地址配置正确 (.env.local 文件)');
    console.log('3. 防火墙允许访问端口 3000');
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  testCallback();
}

module.exports = { testCallback }; 