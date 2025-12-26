/**
 * 创建 MySQL 数据库表
 * 使用 Node.js 执行 SQL 脚本，无需配置 MySQL 命令行工具
 * 
 * 使用方法:
 * node scripts/create-mysql-tables.js
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// 数据库配置
const dbConfig = {
  host: 'gaotu-polar-test03.rwlb.rds.aliyuncs.com',
  port: 3306,
  user: 'gt_ai_writing_rw',
  password: process.env.MYSQL_PASSWORD || 'RTHxZS4qFKIo1DVzp6APjMOJ', // 从环境变量读取密码，或者直接填写
  database: 'gt_ai_writing',
  multipleStatements: true, // 允许执行多条 SQL 语句
  charset: 'utf8mb4'
};

async function createTables() {
  console.log('🚀 开始创建 LearnOrbit 数据库表...\n');

  let connection;

  try {
    // 1. 测试连接
    console.log('🔗 正在连接数据库...');
    console.log(`   Host: ${dbConfig.host}`);
    console.log(`   Port: ${dbConfig.port}`);
    console.log(`   Database: ${dbConfig.database}`);
    console.log(`   User: ${dbConfig.user}\n`);

    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');

    // 2. 读取 SQL 文件
    const sqlFilePath = path.join(__dirname, '../migrations/mysql/001_initial_schema.sql');
    console.log('📝 读取 SQL 文件...');
    console.log(`   文件: ${sqlFilePath}\n`);

    if (!fs.existsSync(sqlFilePath)) {
      throw new Error(`SQL 文件不存在: ${sqlFilePath}`);
    }

    const sql = fs.readFileSync(sqlFilePath, 'utf8');

    // 3. 执行 SQL
    console.log('⚙️  开始执行 SQL 脚本...\n');
    
    await connection.query(sql);
    
    console.log('✅ SQL 脚本执行成功\n');

    // 4. 验证表创建
    console.log('🔍 验证表创建...\n');
    
    const [tables] = await connection.query("SHOW TABLES LIKE 'learnorbit_%'");
    
    if (tables.length === 0) {
      throw new Error('没有创建任何表，请检查 SQL 脚本');
    }

    console.log(`📊 成功创建 ${tables.length} 个表：\n`);
    tables.forEach((row, index) => {
      const tableName = Object.values(row)[0];
      console.log(`   ${index + 1}. ✓ ${tableName}`);
    });

    // 5. 显示表的详细信息
    console.log('\n📋 表详细信息：\n');
    
    const [tableStats] = await connection.query(`
      SELECT 
        TABLE_NAME,
        TABLE_ROWS,
        CREATE_TIME,
        TABLE_COMMENT
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME LIKE 'learnorbit_%'
      ORDER BY TABLE_NAME
    `, [dbConfig.database]);

    console.log('   表名                                  | 记录数 | 创建时间');
    console.log('   ' + '-'.repeat(80));
    tableStats.forEach(stat => {
      const name = stat.TABLE_NAME.padEnd(40);
      const rows = String(stat.TABLE_ROWS || 0).padStart(6);
      const time = stat.CREATE_TIME ? stat.CREATE_TIME.toLocaleString('zh-CN') : 'N/A';
      console.log(`   ${name} | ${rows} | ${time}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('🎉 所有表创建成功！');
    console.log('='.repeat(80));

    console.log('\n💡 下一步：');
    console.log('   1. 切换应用到 MySQL:');
    console.log('      ./scripts/switch-database.sh mysql');
    console.log('      或手动: npm run db:switch:mysql\n');
    console.log('   2. 更新 .env 文件中的 DATABASE_URL\n');
    console.log('   3. 启动应用: npm run dev\n');

  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 提示: 无法连接到数据库，请检查：');
      console.error('   1. 数据库地址和端口是否正确');
      console.error('   2. 网络连接是否正常');
      console.error('   3. 防火墙是否允许访问');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n💡 提示: 用户名或密码错误，请检查：');
      console.error('   1. 用户名是否正确');
      console.error('   2. 密码是否正确');
      console.error('   3. 可以通过环境变量设置密码: MYSQL_PASSWORD=your_password node scripts/create-mysql-tables.js');
    } else if (error.code === 'ER_DBACCESS_DENIED_ERROR') {
      console.error('\n💡 提示: 没有数据库访问权限，请检查：');
      console.error('   1. 用户是否有访问该数据库的权限');
      console.error('   2. 数据库名是否正确');
    } else if (error.code === 'ER_TABLE_EXISTS_ERROR') {
      console.error('\n💡 提示: 表已存在，如需重新创建，请先删除旧表：');
      console.error('   node scripts/drop-learnorbit-tables.js');
    }
    
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 数据库连接已关闭');
    }
  }
}

// 执行
createTables().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

