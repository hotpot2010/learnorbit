# 火山引擎 LLM 集成

## 📋 概述

本次更新将所有 LLM 调用从百家 API 切换为火山引擎（Volcano Engine）API，使用 `volcengine-python-sdk[ark]` SDK。

## 🔄 主要变更

### 1. 新增服务

**文件**: `backend/app/services/volcano_service.py`

- **类**: `VolcanoService`
- **功能**:
  - 使用 `volcenginesdkarkruntime.AsyncArk` 客户端
  - 从环境变量读取配置（`VOLC_ACCESS_KEY`, `VOLC_SECRET_KEY`, `VOLC_CHAT_MODEL`）
  - 实现 `generate_outline()` 方法（与 `DoubaoService` 接口兼容）
  - 实现 `chat_completion()` 通用方法
  - 并发连接控制（Semaphore(2)）
  - 自动重试机制（最多3次，指数退避）
  - 安全打印功能（处理 Windows 控制台编码）

### 2. 更新的服务

#### `video_analysis_service.py`
- ✅ 导入 `VolcanoService`
- ✅ 初始化 `self.volcano_service`
- ✅ 保留 `self.doubao_service` 但不使用
- ✅ 更新注释：`ASR + 火山引擎`

#### `knowledge_point_extractor.py`
- ✅ 导入 `VolcanoService`
- ✅ 替换 `self.doubao_service` 为 `self.volcano_service`
- ✅ 更新方法调用：`volcano_service.generate_outline(transcript, custom_prompt)`

#### `notes.py` (API 路由)
- ✅ 导入 `VolcanoService`
- ✅ 初始化 `volcano_service` 实例
- ✅ 替换所有 4 处 `doubao_service.generate_outline()` 调用：
  1. 笔记生成
  2. 提问回答
  3. 练习生成
  4. 答案验证

#### `video_analyzer_service.py`
- ✅ 导入 `volcano_service`
- ✅ 替换 `self.doubao` 为 `self.volcano`
- ✅ 更新初始化日志：显示 "Volcano Engine"
- ✅ 更新方法调用

### 3. 依赖更新

**文件**: `backend/requirements.txt`

```txt
# Volcano Engine SDK for ARK (LLM)
volcengine-python-sdk[ark]==1.0.119
```

## 🔧 环境变量配置

需要在 `.env` 文件中配置以下环境变量：

```env
# 火山引擎配置
VOLC_ACCESS_KEY=your_access_key_here
VOLC_SECRET_KEY=your_secret_key_here
VOLC_CHAT_MODEL=your_model_endpoint_here
```

## 📊 API 调用对比

### 百家 LLM (旧)
```python
from app.services.doubao_service import DoubaoService

doubao_service = DoubaoService()
result = await doubao_service.generate_outline(
    transcript="...",
    prompt="..."
)
```

### 火山引擎 (新)
```python
from app.services.volcano_service import VolcanoService

volcano_service = VolcanoService()
result = await volcano_service.generate_outline(
    transcript="...",
    custom_prompt="..."
)
```

**参数变更**:
- `prompt` → `custom_prompt`（更明确的命名）

## ✅ 迁移完成清单

- [x] 创建 `volcano_service.py`
- [x] 更新 `video_analysis_service.py`
- [x] 更新 `knowledge_point_extractor.py`
- [x] 更新 `notes.py` (4 处调用)
- [x] 更新 `video_analyzer_service.py`
- [x] 更新 `requirements.txt`
- [x] 保留 `doubao_service.py` (向后兼容)
- [x] 通过 Linter 检查

## 🎯 受影响的功能

以下功能现在全部使用火山引擎 LLM：

1. **视频知识点提取** - ASR + 火山引擎分析
2. **笔记生成** - 基于知识点和逐字稿
3. **提问回答** - 用户提问的智能回答
4. **练习生成** - 编程练习题生成
5. **答案验证** - 用户代码评分和反馈
6. **视频信息分析** - Bilibili 搜索结果分析

## 🚀 部署步骤

1. **安装依赖**:
   ```bash
   cd backend
   pip install volcengine-python-sdk[ark]==1.0.119
   ```

2. **配置环境变量**:
   - 确保 `.env` 文件包含 `VOLC_ACCESS_KEY`, `VOLC_SECRET_KEY`, `VOLC_CHAT_MODEL`

3. **重启服务器**:
   ```bash
   uvicorn main:app --reload
   ```

4. **验证启动日志**:
   ```
   ✅ 火山引擎 AsyncArk 客户端初始化成功，模型: [your_model]
   🎬 VideoAnalysisService initialized (default: asr_doubao with Volcano Engine, cache: ✅)
   🤖 VideoAnalyzerService initialized (Volcano Engine)
   ```

## 📝 注意事项

1. **保留百家服务** - `doubao_service.py` 被保留但不再使用，便于未来可能的回滚或A/B测试
2. **无降级策略** - 根据需求，不实现降级到百家 API 的逻辑
3. **并发控制** - 火山引擎服务使用 `Semaphore(2)` 限制并发连接数为 2
4. **错误处理** - 实现了 3 次重试机制，每次重试间隔指数增长
5. **兼容性** - 接口设计与 `DoubaoService` 保持兼容，便于切换

## 🐛 故障排查

### 问题 1: 初始化失败
```
❌ Missing Volcano Engine API credentials
```
**解决**: 检查 `.env` 文件是否包含正确的 `VOLC_ACCESS_KEY` 和 `VOLC_SECRET_KEY`

### 问题 2: 模型未找到
```
❌ Missing Volcano Engine model info
```
**解决**: 确保 `.env` 文件包含 `VOLC_CHAT_MODEL`

### 问题 3: API 调用超时
```
⚠️ [火山引擎] 请求超时
```
**解决**: 
- 检查网络连接
- 增加 `timeout` 参数（默认 120 秒）
- 查看火山引擎服务状态

## 📚 参考文档

- [火山引擎 ARK SDK 文档](https://www.volcengine.com/docs/82379/1099475)
- [参考实现](c:\Users\wangz\Downloads\src_llm_call_llm.py)

---

**更新时间**: 2025-01-07  
**版本**: v1.0  
**状态**: ✅ 生产就绪

