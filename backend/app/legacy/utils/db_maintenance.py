from datetime import datetime, timedelta
from src.models import Document
from src import SessionLocal
from src.utils.document_processor import init_milvus_connection
from pymilvus import utility
async def cleanup_expired_documents():
    """清理超过7天的文档"""
    db = SessionLocal()
    try:
        # 计算7天前的时间点
        expiry_date = datetime.utcnow() - timedelta(days=7)
        init_milvus_connection()
        # 查询并删除过期文档
        expired_docs = db.query(Document).filter(Document.created_at < expiry_date).all()
        ids = [doc.id for doc in expired_docs]
        for id in ids:
            if utility.has_collection(f"chat_{id}"):
                utility.drop_collection(f"chat_{id}")
        # 记录将要删除的文档数
        count = len(expired_docs)

        # 删除文档
        db.query(Document).filter(Document.created_at < expiry_date).delete()
        db.commit()
        
        return {"success": True, "deleted_count": count}
    except Exception as e:
        db.rollback()
        return {"success": False, "error": str(e)}
    finally:
        db.close()
