/**
 * 删除所有 LearnOrbit 的表
 * 谨慎使用！这会删除所有数据
 * 
 * 使用方法:
 * node scripts/drop-learnorbit-tables.js
 */

const mysql = require('mysql2/promise');
const readline = require('readline');

// 数据库配置
const dbConfig = {
  host: 'gaotu-polar-test03.rwlb.rds.aliyuncs.com',
  port: 3306,
  user: 'gt_ai_writing_rw',
  password: process.env.MYSQL_PASSWORD || '',
  database: 'gt_ai_writing',
  charset: 'utf8mb4'
};

// 创建 readline 接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function dropTables() {
  console.log('⚠️  警告：这将删除所有 learnorbit_ 开头的表和数据！\n');

  let connection;

  try {
    // 连接数据库
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');

    // 查询所有 learnorbit_ 开头的表
    const [tables] = await connection.query(
      "SHOW TABLES LIKE 'learnorbit_%'"
    );

    if (tables.length === 0) {
      console.log('ℹ️  没有找到任何 learnorbit_ 开头的表');
      return;
    }

    console.log(`找到 ${tables.length} 个表：\n`);
    tables.forEach((row, index) => {
      const tableName = Object.values(row)[0];
      console.log(`   ${index + 1}. ${tableName}`);
    });

    console.log('\n');

    // 二次确认
    const answer = await question('确认删除这些表吗？(输入 YES 确认): ');

    if (answer.trim().toUpperCase() !== 'YES') {
      console.log('\n❌ 操作已取消');
      return;
    }

    console.log('\n🗑️  开始删除表...\n');

    // 禁用外键检查
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    // 删除每个表
    for (const row of tables) {
      const tableName = Object.values(row)[0];
      try {
        await connection.query(`DROP TABLE IF EXISTS \`${tableName}\``);
        console.log(`   ✓ 已删除: ${tableName}`);
      } catch (error) {
        console.error(`   ✗ 删除失败: ${tableName} - ${error.message}`);
      }
    }

    // 恢复外键检查
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('\n✅ 所有表已删除');

  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
    rl.close();
  }
}

// 执行
dropTables().catch(error => {
  console.error('Fatal error:', error);
  rl.close();
  process.exit(1);
});

