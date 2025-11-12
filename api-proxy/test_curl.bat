@echo off
chcp 65001 >nul
echo ==========================================
echo API Proxy 快速测试
echo ==========================================

echo.
echo 【1/4】测试健康检查...
curl -s http://localhost:8001/open-api/health
echo.

echo.
echo 【2/4】测试 ASR 创建...
curl -s -X POST http://localhost:8001/open-api/asr/create -H "Content-Type: application/json" -d "{\"url\":\"https://example.com/test.mp3\",\"callbackUrl\":\"https://example.com/cb\"}"
echo.

echo.
echo 【3/4】测试 ASR 查询...
curl -s "http://localhost:8001/open-api/asr/get?id=test123"
echo.

echo.
echo 【4/4】测试 LLM 对话...
curl -s -X POST http://localhost:8001/open-api/llm/chat -H "Content-Type: application/json" -d "{\"model\":\"claude-4.5-sonnet\",\"messages\":[{\"role\":\"user\",\"content\":\"Hello\"}],\"max_tokens\":50}"
echo.

echo.
echo ==========================================
echo ✅ 测试完成！
echo ==========================================
pause

