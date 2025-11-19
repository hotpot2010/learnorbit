@echo off
chcp 65001 >nul
echo ==========================================
echo 🔄 环境配置切换工具
echo ==========================================
echo.
echo 请选择环境：
echo 1. 本地开发环境 (localhost:8001)
echo 2. 线上生产环境 (https://learnorbit.gaotu.cn)
echo 3. 查看当前配置
echo 0. 退出
echo.
set /p choice=请输入选项 (0-3): 

if "%choice%"=="1" goto local
if "%choice%"=="2" goto production
if "%choice%"=="3" goto show
if "%choice%"=="0" goto end
echo ❌ 无效选项
goto end

:local
echo.
echo 📝 切换到本地开发环境...
if exist "env.local.example" (
    copy /Y env.local.example .env >nul
    echo ✅ 已切换到本地开发环境
    echo 📍 API_PROXY_URL=http://localhost:8001
) else (
    echo ❌ 错误: env.local.example 文件不存在
)
goto end

:production
echo.
echo 📝 切换到线上生产环境...
if exist "env.production.example" (
    copy /Y env.production.example .env >nul
    echo ✅ 已切换到线上生产环境
    echo 📍 API_PROXY_URL=https://learnorbit.gaotu.cn
) else (
    echo ❌ 错误: env.production.example 文件不存在
)
goto end

:show
echo.
echo 📊 当前配置：
echo ==========================================
if exist ".env" (
    findstr /C:"API_PROXY_URL" .env
    findstr /C:"LLM_PROVIDER" .env
    findstr /C:"DEBUG" .env
) else (
    echo ⚠️  .env 文件不存在
)
echo ==========================================
goto end

:end
echo.
pause


