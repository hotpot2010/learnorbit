const os = require('os');

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    
    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i];
      
      if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
        return alias.address;
      }
    }
  }
  
  return '127.0.0.1';
}

const localIP = getLocalIP();
console.log('\n=================================');
console.log('🌐 检测到的本机IP地址:', localIP);
console.log('=================================');
console.log('请在 .env.local 文件中设置:');
console.log(`NEXT_PUBLIC_LOCAL_IP=${localIP}`);
console.log('=================================\n');

module.exports = { getLocalIP }; 