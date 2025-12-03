"""
数据库查看器API路由
用于查看数据库表和任务数据
"""
from fastapi import APIRouter, HTTPException
from sqlalchemy import inspect, text
from typing import List, Dict, Any, Optional
from datetime import datetime

from ...database import get_db_session, engine
from ...models.offline_video import OfflineVideoTask

router = APIRouter(prefix="/db-viewer", tags=["db-viewer"])


@router.get("/tables")
async def list_tables():
    """
    列出所有数据库表
    """
    try:
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        return {
            "success": True,
            "tables": tables
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tables/{table_name}/structure")
async def get_table_structure(table_name: str):
    """
    获取表结构信息
    """
    try:
        inspector = inspect(engine)
        
        if table_name not in inspector.get_table_names():
            raise HTTPException(status_code=404, detail=f"表 {table_name} 不存在")
        
        columns = inspector.get_columns(table_name)
        primary_keys = inspector.get_primary_keys(table_name)
        indexes = inspector.get_indexes(table_name)
        
        return {
            "success": True,
            "table_name": table_name,
            "columns": [
                {
                    "name": col["name"],
                    "type": str(col["type"]),
                    "nullable": col["nullable"],
                    "default": str(col.get("default", "")),
                    "comment": col.get("comment", "")
                }
                for col in columns
            ],
            "primary_keys": primary_keys,
            "indexes": indexes
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tables/{table_name}/data")
async def get_table_data(
    table_name: str,
    limit: int = 100,
    offset: int = 0,
    order_by: Optional[str] = None
):
    """
    获取表数据（分页）
    支持查看所有表，但offline_video_tasks表有特殊处理
    
    Args:
        table_name: 表名
        limit: 每页记录数
        offset: 偏移量
        order_by: 排序字段（可选，格式：字段名 或 字段名:desc）
    """
    try:
        inspector = inspect(engine)
        
        if table_name not in inspector.get_table_names():
            raise HTTPException(status_code=404, detail=f"表 {table_name} 不存在")
        
        # 如果是offline_video_tasks表，使用ORM查询
        if table_name == "offline_video_tasks":
            with get_db_session() as db:
                query = db.query(OfflineVideoTask)
                
                # 处理排序
                if order_by:
                    order_field = order_by.split(':')[0]
                    order_desc = ':desc' in order_by.lower()
                    if hasattr(OfflineVideoTask, order_field):
                        order_attr = getattr(OfflineVideoTask, order_field)
                        query = query.order_by(order_attr.desc() if order_desc else order_attr)
                else:
                    query = query.order_by(OfflineVideoTask.created_at.desc())
                
                tasks = query.limit(limit).offset(offset).all()
                total = db.query(OfflineVideoTask).count()
                
                return {
                    "success": True,
                    "table_name": table_name,
                    "total": total,
                    "limit": limit,
                    "offset": offset,
                    "order_by": order_by,
                    "data": [task.to_dict() for task in tasks]
                }
        else:
            # 其他表使用原始SQL查询
            with get_db_session() as db:
                try:
                    # 获取总记录数
                    count_result = db.execute(text(f"SELECT COUNT(*) as count FROM `{table_name}`"))
                    total = count_result.scalar()
                except Exception as e:
                    print(f"❌ 获取表 {table_name} 记录数失败: {e}")
                    import traceback
                    traceback.print_exc()
                    raise HTTPException(status_code=500, detail=f"获取表记录数失败: {str(e)}")
                
                # 构建查询SQL
                sql = f"SELECT * FROM `{table_name}`"
                order_clause = ""
                
                # 处理排序
                try:
                    if order_by:
                        order_field = order_by.split(':')[0]
                        order_desc = ':desc' in order_by.lower()
                        order_clause = f" ORDER BY `{order_field}` {'DESC' if order_desc else 'ASC'}"
                    else:
                        # 默认按主键或第一个字段排序
                        primary_keys = inspector.get_primary_keys(table_name)
                        if primary_keys:
                            order_clause = f" ORDER BY `{primary_keys[0]}` DESC"
                        else:
                            columns = inspector.get_columns(table_name)
                            if columns:
                                # 尝试找到一个可以排序的字段（排除 BLOB、TEXT、JSON 等）
                                sortable_types = ['INT', 'BIGINT', 'VARCHAR', 'CHAR', 'DATETIME', 'TIMESTAMP', 'DATE', 'TIME', 'DECIMAL', 'FLOAT', 'DOUBLE']
                                for col in columns:
                                    col_type = str(col['type']).upper()
                                    if any(st in col_type for st in sortable_types):
                                        order_clause = f" ORDER BY `{col['name']}` DESC"
                                        break
                except Exception as e:
                    print(f"⚠️ 构建排序子句失败: {e}，将不排序")
                    order_clause = ""
                
                sql += order_clause
                sql += f" LIMIT {limit} OFFSET {offset}"
                
                print(f"📊 执行SQL: {sql}")
                
                try:
                    # 获取分页数据
                    result = db.execute(text(sql))
                    columns = result.keys()
                    rows = result.fetchall()
                except Exception as e:
                    print(f"❌ 执行SQL失败: {e}")
                    import traceback
                    traceback.print_exc()
                    # 如果排序失败，尝试不排序
                    if order_clause:
                        print(f"🔄 尝试不排序重新查询...")
                        try:
                            sql_no_order = f"SELECT * FROM `{table_name}` LIMIT {limit} OFFSET {offset}"
                            result = db.execute(text(sql_no_order))
                            columns = result.keys()
                            rows = result.fetchall()
                        except Exception as e2:
                            print(f"❌ 不排序查询也失败: {e2}")
                            raise HTTPException(status_code=500, detail=f"查询表数据失败: {str(e2)}")
                    else:
                        raise HTTPException(status_code=500, detail=f"查询表数据失败: {str(e)}")
                
                # 转换为字典列表
                data = []
                for row in rows:
                    row_dict = {}
                    for i, col in enumerate(columns):
                        try:
                            value = row[i]
                            # 处理各种特殊类型
                            if value is None:
                                row_dict[col] = None
                            elif isinstance(value, datetime):
                                row_dict[col] = value.isoformat()
                            elif hasattr(value, 'isoformat'):  # date类型
                                row_dict[col] = value.isoformat()
                            elif isinstance(value, (bytes, bytearray)):  # BLOB类型
                                # 尝试解码为字符串，如果失败则转为base64
                                try:
                                    row_dict[col] = value.decode('utf-8', errors='ignore')
                                except:
                                    import base64
                                    row_dict[col] = f"<BLOB: {len(value)} bytes>"
                            elif isinstance(value, (int, float, str, bool)):
                                row_dict[col] = value
                            elif hasattr(value, '__dict__'):  # 对象类型
                                try:
                                    import json
                                    row_dict[col] = json.loads(str(value))
                                except:
                                    row_dict[col] = str(value)
                            else:
                                # 其他类型尝试转换为字符串
                                try:
                                    row_dict[col] = str(value)
                                except:
                                    row_dict[col] = f"<无法序列化: {type(value)}>"
                        except Exception as e:
                            print(f"⚠️ 处理字段 {col} 的值时出错: {e}")
                            row_dict[col] = f"<错误: {str(e)}>"
                    data.append(row_dict)
                
                return {
                    "success": True,
                    "table_name": table_name,
                    "total": total,
                    "limit": limit,
                    "offset": offset,
                    "order_by": order_by if order_by else (order_clause if order_clause else None),
                    "data": data
                }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ 获取表 {table_name} 数据失败: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"获取表数据失败: {str(e)}")


@router.get("/stats")
async def get_database_stats():
    """
    获取数据库统计信息
    """
    try:
        with get_db_session() as db:
            total_tasks = db.query(OfflineVideoTask).count()
            
            # 统计各状态的任务数
            pending_tasks = db.query(OfflineVideoTask).filter(
                text("JSON_EXTRACT(steps, '$.download.status') = 'pending'")
            ).count()
            
            running_tasks = db.query(OfflineVideoTask).filter(
                text("JSON_EXTRACT(steps, '$.download.status') = 'running' OR JSON_EXTRACT(steps, '$.asr.status') = 'running' OR JSON_EXTRACT(steps, '$.knowledge_points.status') = 'running'")
            ).count()
            
            completed_tasks = db.query(OfflineVideoTask).filter(
                text("JSON_EXTRACT(steps, '$.knowledge_points.status') = 'success'")
            ).count()
            
            return {
                "success": True,
                "stats": {
                    "total_tasks": total_tasks,
                    "pending_tasks": pending_tasks,
                    "running_tasks": running_tasks,
                    "completed_tasks": completed_tasks
                }
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

