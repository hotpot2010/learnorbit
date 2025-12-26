# PowerShell 数据库切换脚本
# 用法: .\scripts\switch-database.ps1 mysql
#      .\scripts\switch-database.ps1 postgres

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('mysql', 'postgres')]
    [string]$DbType
)

$ErrorActionPreference = "Stop"

Write-Host "=============================================" -ForegroundColor Green
Write-Host "LearnOrbit 数据库切换工具 (Windows)" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""

if ($DbType -eq "mysql") {
    Write-Host "🔄 切换到 MySQL..." -ForegroundColor Yellow
    Write-Host ""
    
    # 1. 检查文件是否存在
    if (-not (Test-Path "src/db/index.mysql.ts")) {
        Write-Host "❌ 找不到 src/db/index.mysql.ts" -ForegroundColor Red
        exit 1
    }
    
    if (-not (Test-Path "src/db/schema.mysql.ts")) {
        Write-Host "❌ 找不到 src/db/schema.mysql.ts" -ForegroundColor Red
        exit 1
    }
    
    # 2. 备份当前配置
    $backupDir = "backups/db-config-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
    
    Write-Host "💾 备份当前配置到: $backupDir" -ForegroundColor Yellow
    if (Test-Path "src/db/index.ts") {
        Copy-Item "src/db/index.ts" "$backupDir/index.ts"
    }
    if (Test-Path "src/db/schema.ts") {
        Copy-Item "src/db/schema.ts" "$backupDir/schema.ts"
    }
    if (Test-Path "src/lib/auth.ts") {
        Copy-Item "src/lib/auth.ts" "$backupDir/auth.ts"
    }
    
    # 3. 复制 MySQL 配置
    Copy-Item "src/db/index.mysql.ts" "src/db/index.ts" -Force
    Write-Host "   ✅ 已更新 src/db/index.ts" -ForegroundColor Green
    
    Copy-Item "src/db/schema.mysql.ts" "src/db/schema.ts" -Force
    Write-Host "   ✅ 已更新 src/db/schema.ts" -ForegroundColor Green
    
    # 4. 更新 auth.ts 中的 provider
    if (Test-Path "src/lib/auth.ts") {
        $authContent = Get-Content "src/lib/auth.ts" -Raw
        $authContent = $authContent -replace "provider: 'pg'", "provider: 'mysql'"
        Set-Content "src/lib/auth.ts" $authContent -NoNewline
        Write-Host "   ✅ 已更新 src/lib/auth.ts (provider: mysql)" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "✅ 已切换到 MySQL" -ForegroundColor Green
    Write-Host ""
    Write-Host "📌 下一步：" -ForegroundColor Yellow
    Write-Host "   1. 确保 .env 中的 DATABASE_URL 指向 MySQL" -ForegroundColor White
    Write-Host "      格式: mysql://user:password@host:port/database" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   2. 启动应用: npm run dev" -ForegroundColor White
    Write-Host ""
    
} elseif ($DbType -eq "postgres") {
    Write-Host "🔄 切换回 PostgreSQL (Supabase)..." -ForegroundColor Yellow
    Write-Host ""
    
    # 检查是否有 PostgreSQL 配置文件
    $hasPostgresConfig = $false
    
    if (Test-Path "src/db/index.postgres.ts") {
        Copy-Item "src/db/index.postgres.ts" "src/db/index.ts" -Force
        Write-Host "   ✅ 已恢复 src/db/index.ts" -ForegroundColor Green
        $hasPostgresConfig = $true
    }
    
    if (Test-Path "src/db/schema.postgres.ts") {
        Copy-Item "src/db/schema.postgres.ts" "src/db/schema.ts" -Force
        Write-Host "   ✅ 已恢复 src/db/schema.ts" -ForegroundColor Green
        $hasPostgresConfig = $true
    }
    
    if (-not $hasPostgresConfig) {
        # 尝试从最近的备份恢复
        $latestBackup = Get-ChildItem "backups" -Directory | Sort-Object Name -Descending | Select-Object -First 1
        if ($latestBackup) {
            Write-Host "   📂 从备份恢复: $($latestBackup.Name)" -ForegroundColor Yellow
            if (Test-Path "$($latestBackup.FullName)/index.ts") {
                Copy-Item "$($latestBackup.FullName)/index.ts" "src/db/index.ts" -Force
                Write-Host "   ✅ 已恢复 src/db/index.ts" -ForegroundColor Green
            }
            if (Test-Path "$($latestBackup.FullName)/schema.ts") {
                Copy-Item "$($latestBackup.FullName)/schema.ts" "src/db/schema.ts" -Force
                Write-Host "   ✅ 已恢复 src/db/schema.ts" -ForegroundColor Green
            }
            if (Test-Path "$($latestBackup.FullName)/auth.ts") {
                Copy-Item "$($latestBackup.FullName)/auth.ts" "src/lib/auth.ts" -Force
                Write-Host "   ✅ 已恢复 src/lib/auth.ts" -ForegroundColor Green
            }
        } else {
            Write-Host "   ❌ 找不到 PostgreSQL 配置文件或备份" -ForegroundColor Red
            exit 1
        }
    }
    
    # 更新 auth.ts
    if (Test-Path "src/lib/auth.ts") {
        $authContent = Get-Content "src/lib/auth.ts" -Raw
        $authContent = $authContent -replace "provider: 'mysql'", "provider: 'pg'"
        Set-Content "src/lib/auth.ts" $authContent -NoNewline
        Write-Host "   ✅ 已恢复 src/lib/auth.ts (provider: pg)" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "✅ 已切换回 PostgreSQL" -ForegroundColor Green
    Write-Host ""
    Write-Host "📌 确保 .env 中的 DATABASE_URL 指向 Supabase：" -ForegroundColor Yellow
    Write-Host "   格式: postgresql://user:password@db.xxx.supabase.co:5432/postgres" -ForegroundColor Gray
    Write-Host ""
}

Write-Host "=============================================" -ForegroundColor Green
Write-Host "完成！" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green


