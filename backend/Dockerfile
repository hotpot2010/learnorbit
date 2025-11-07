# ============================================
# 阶段1: 构建器 (Builder Stage)
# 这个阶段用于编译和安装所有依赖
# ============================================
FROM python:3.10-slim AS builder

# 设置工作目录
WORKDIR /app

# 1. 安装系统依赖
# 包括构建工具和 FFmpeg（用于视频处理）
RUN apt-get update && apt-get install -y \
    build-essential \
    gcc \
    g++ \
    python3-dev \
    ffmpeg \
    wget \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# 2. 创建虚拟环境
# 保持依赖隔离，方便复制到最终镜像
RUN python -m venv /opt/venv

# 确保使用虚拟环境的 pip
ENV PATH="/opt/venv/bin:$PATH"

# 3. 升级 pip 和安装基础工具
RUN pip install --no-cache-dir --upgrade pip setuptools wheel

# 4. 复制并安装 Python 依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ============================================
# 阶段2: 最终镜像 (Final Stage)
# 构建轻量级的运行时镜像
# ============================================
FROM python:3.10-slim

# 设置工作目录
WORKDIR /app

# 1. 安装运行时必需的系统依赖
# 只安装运行时需要的包，不包括构建工具
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 2. 从构建器阶段复制虚拟环境
COPY --from=builder /opt/venv /opt/venv

# 3. 复制应用程序代码
# .dockerignore 会排除不必要的文件
COPY . .

# 4. 创建必要的目录
RUN mkdir -p \
    /app/uploads/public \
    /app/cache \
    /app/cache/notes \
    /app/cache/exercises \
    /app/cache/series \
    /app/batch_results \
    /app/logs

# 5. 创建非 root 用户运行应用（安全最佳实践）
RUN useradd --create-home --shell /bin/bash appuser && \
    chown -R appuser:appuser /app

# 切换到非 root 用户
USER appuser

# 6. 设置环境变量
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    APP_PORT=8000 \
    HOST=0.0.0.0

# 7. 暴露端口
EXPOSE ${APP_PORT}

# 8. 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${APP_PORT}/health || exit 1

# 9. 启动命令
# 使用 uvicorn 启动 FastAPI 应用
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]

