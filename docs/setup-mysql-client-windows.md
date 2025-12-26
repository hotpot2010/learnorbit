# Windows 配置 MySQL 客户端指南

## 问题描述

在 PowerShell 中运行 `mysql` 命令时出现错误：
```
mysql : 无法将"mysql"项识别为 cmdlet、函数、脚本文件或可运行程序的名称
```

## 解决方案

---

## 方案 A：配置 MySQL 环境变量（如果已安装 MySQL）

### 1. 找到 MySQL 安装路径

常见的 MySQL 安装路径：
- `C:\Program Files\MySQL\MySQL Server 8.0\bin`
- `C:\Program Files\MySQL\MySQL Server 5.7\bin`
- `C:\MySQL\bin`

### 2. 配置环境变量

#### 图形界面方式（推荐）

1. **打开系统环境变量**
   - 按 `Win + X`，选择"系统"
   - 或者：右键"此电脑" → "属性" → "高级系统设置"

2. **编辑环境变量**
   - 点击"环境变量"按钮
   - 在"系统变量"区域找到 `Path`
   - 点击"编辑"

3. **添加 MySQL 路径**
   - 点击"新建"
   - 输入 MySQL 的 bin 目录路径，例如：
     ```
     C:\Program Files\MySQL\MySQL Server 8.0\bin
     ```
   - 点击"确定"保存

4. **验证配置**
   - **关闭并重新打开 PowerShell**（重要！）
   - 运行测试命令：
     ```powershell
     mysql --version
     ```
   - 应该显示 MySQL 版本信息

#### PowerShell 命令方式

```powershell
# 1. 以管理员身份运行 PowerShell

# 2. 添加 MySQL 到系统 Path（替换为你的实际路径）
$mysqlPath = "C:\Program Files\MySQL\MySQL Server 8.0\bin"
[Environment]::SetEnvironmentVariable(
    "Path",
    [Environment]::GetEnvironmentVariable("Path", "Machine") + ";$mysqlPath",
    "Machine"
)

# 3. 刷新当前会话的环境变量
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# 4. 验证
mysql --version
```

---

## 方案 B：安装 MySQL 客户端

如果你的电脑上没有安装 MySQL，可以只安装客户端工具。

### 选项 1：MySQL 官方安装包

1. **下载 MySQL Installer**
   - 访问：https://dev.mysql.com/downloads/installer/
   - 下载 `mysql-installer-web-community-8.x.x.msi`

2. **安装步骤**
   - 运行安装程序
   - 选择"Custom"安装类型
   - 只勾选：
     - ✅ MySQL Shell
     - ✅ MySQL Command Line Client
   - 完成安装

3. **添加到环境变量**（自动或手动，参考方案 A）

### 选项 2：使用 Chocolatey（推荐）

```powershell
# 1. 安装 Chocolatey（如果还没安装）
# 以管理员身份运行：
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# 2. 安装 MySQL 客户端
choco install mysql.utilities -y

# 3. 刷新环境变量
refreshenv

# 4. 验证
mysql --version
```

### 选项 3：使用 Scoop（轻量级）

```powershell
# 1. 安装 Scoop（如果还没安装）
irm get.scoop.sh | iex

# 2. 安装 MySQL 客户端
scoop install mysql

# 3. 验证
mysql --version
```

---

## 方案 C：使用 GUI 工具（最简单）

如果不想配置命令行，可以使用图形界面工具：

### 1. MySQL Workbench（免费，官方）

**下载**：https://dev.mysql.com/downloads/workbench/

**使用**：
1. 打开 MySQL Workbench
2. 创建新连接：
   - Host: `gaotu-polar-test03.rwlb.rds.aliyuncs.com`
   - Port: `3306`
   - Username: `gt_ai_writing_rw`
   - Password: `你的密码`
3. 点击"File" → "Open SQL Script"
4. 选择 `migrations/mysql/001_initial_schema.sql`
5. 点击"执行"按钮（闪电图标）

### 2. Navicat（付费，功能强大）

**下载**：https://www.navicat.com/

**使用**：
1. 创建 MySQL 连接
2. 打开 SQL 文件执行

### 3. DBeaver（免费，开源）

**下载**：https://dbeaver.io/

**使用**：
1. 创建 MySQL 连接
2. 打开 SQL 编辑器
3. 执行建表脚本

### 4. HeidiSQL（免费，轻量）

**下载**：https://www.heidisql.com/

**使用**：
1. 创建 MySQL 连接
2. 打开 SQL 文件执行

---

## 方案 D：使用在线 MySQL 客户端

### 使用 Node.js 脚本执行 SQL

创建一个临时脚本来执行 SQL：

```javascript
// create-tables.js
const mysql = require('mysql2/promise');
const fs = require('fs');

async function createTables() {
  const connection = await mysql.createConnection({
    host: 'gaotu-polar-test03.rwlb.rds.aliyuncs.com',
    port: 3306,
    user: 'gt_ai_writing_rw',
    password: '你的密码',
    database: 'gt_ai_writing',
    multipleStatements: true
  });

  const sql = fs.readFileSync('migrations/mysql/001_initial_schema.sql', 'utf8');
  
  try {
    await connection.query(sql);
    console.log('✅ 表创建成功！');
  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    await connection.end();
  }
}

createTables();
```

执行：
```powershell
node create-tables.js
```

---

## 推荐方案对比

| 方案 | 优点 | 缺点 | 推荐度 |
|------|------|------|--------|
| **配置环境变量** | 命令行方便，脚本友好 | 需要找到安装路径 | ⭐⭐⭐⭐ |
| **MySQL Workbench** | 官方工具，功能完整 | 需要下载安装 | ⭐⭐⭐⭐⭐ |
| **Node.js 脚本** | 项目已有依赖，无需额外安装 | 需要写脚本 | ⭐⭐⭐⭐⭐ |
| **Chocolatey/Scoop** | 自动配置环境变量 | 需要包管理器 | ⭐⭐⭐ |
| **Navicat** | 界面友好，功能强大 | 付费软件 | ⭐⭐⭐ |

---

## 快速验证是否配置成功

```powershell
# 测试 MySQL 命令是否可用
mysql --version

# 测试连接（输入密码后）
mysql -h gaotu-polar-test03.rwlb.rds.aliyuncs.com -u gt_ai_writing_rw -p gt_ai_writing

# 连接成功后会看到：
# mysql>
```

---

## 我的推荐

对于你的情况，我推荐以下两种方案：

### 🥇 推荐方案 1：使用 Node.js 脚本（最快）

因为项目已经安装了 `mysql2` 依赖，这是最快的方法：

```javascript
// scripts/create-mysql-tables.js
const mysql = require('mysql2/promise');
const fs = require('fs');

async function createTables() {
  const connection = await mysql.createConnection({
    host: 'gaotu-polar-test03.rwlb.rds.aliyuncs.com',
    port: 3306,
    user: 'gt_ai_writing_rw',
    password: process.env.MYSQL_PASSWORD || '你的密码',
    database: 'gt_ai_writing',
    multipleStatements: true
  });

  console.log('✅ 连接成功');
  
  const sql = fs.readFileSync('migrations/mysql/001_initial_schema.sql', 'utf8');
  
  try {
    console.log('📝 开始创建表...');
    await connection.query(sql);
    console.log('✅ 所有表创建成功！');
    
    // 验证表创建
    const [tables] = await connection.query("SHOW TABLES LIKE 'learnorbit_%'");
    console.log(`\n📊 已创建 ${tables.length} 个表：`);
    tables.forEach(row => {
      console.log(`  ✓ ${Object.values(row)[0]}`);
    });
  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    await connection.end();
  }
}

createTables();
```

运行：
```powershell
node scripts/create-mysql-tables.js
```

### 🥈 推荐方案 2：MySQL Workbench（图形界面）

如果你喜欢图形界面：

1. 下载安装 MySQL Workbench
2. 创建连接
3. 打开 SQL 文件
4. 点击执行

---

## 故障排除

### 问题 1：找不到 MySQL 安装路径

```powershell
# 搜索 MySQL 安装位置
Get-ChildItem -Path "C:\Program Files" -Filter "mysql.exe" -Recurse -ErrorAction SilentlyContinue

# 或者
Get-ChildItem -Path "C:\" -Filter "mysql.exe" -Recurse -ErrorAction SilentlyContinue
```

### 问题 2：环境变量不生效

- 必须**关闭并重新打开 PowerShell**
- 或者重启电脑

### 问题 3：权限不足

- 右键 PowerShell → "以管理员身份运行"

---

*最后更新：2024-12-25*


