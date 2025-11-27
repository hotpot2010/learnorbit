import sys
import os
from loguru import logger

# Remove default handlers
logger.remove()

# 保留原有的日志配置
ORIGINAL_LOG_FOLDER = "logs"
ORIGINAL_LOG_FILE = os.path.join(ORIGINAL_LOG_FOLDER, "output.log") 
if not os.path.exists(ORIGINAL_LOG_FOLDER):
    os.makedirs(ORIGINAL_LOG_FOLDER)

# 添加新的日志配置
NEW_LOG_FOLDER = "app/log"
APP_LOG_FILE = os.path.join(NEW_LOG_FOLDER, "app.log")
ERROR_LOG_FILE = os.path.join(NEW_LOG_FOLDER, "error.log")
if not os.path.exists(NEW_LOG_FOLDER):
    os.makedirs(NEW_LOG_FOLDER)

# 保留原有的日志配置
logger.add(
    ORIGINAL_LOG_FILE,
    level="INFO",
    rotation="1 day",
    retention="7 days",
    compression="zip",
    enqueue=True  # 异步写入的关键，避免阻塞
)

# 添加新的标准日志配置
logger.add(
    APP_LOG_FILE,
    level="INFO",
    rotation="1 day",
    retention="7 days",
    format="{time:YYYY-MM-DD HH:mm:ss.SSS} {level} [{name}:{line}][{thread.name}] - [TID: study-platform.{thread.id}.{time:X}] [{function}] {message}",
    enqueue=True
)

# 添加新的错误日志配置
logger.add(
    ERROR_LOG_FILE,
    level="ERROR",
    rotation="1 day",
    retention="30 days",
    format="{time:YYYY-MM-DD HH:mm:ss.SSS} {level} [{name}:{line}][{thread.name}] - [TID: study-platform.{thread.id}.{time:X}] [{function}] {message}",
    enqueue=True
)

# 控制台输出
logger.add(
    sys.stderr, 
    level="INFO"
)