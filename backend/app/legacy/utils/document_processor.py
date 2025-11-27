import os
import json
import uuid
import asyncio
import gc  # 添加垃圾回收模块
from typing import List, Dict, Any, Optional
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_milvus import Milvus
from langchain_community.embeddings import OpenAIEmbeddings
from langchain_community.document_loaders import PyPDFLoader, TextLoader, WebBaseLoader
import bs4
from sqlalchemy.orm import Session
from src.models import Document
from src.utils.summary import summarize_document
import tempfile
from pymilvus import connections, utility
import logging
from log import logger
# from dotenv import load_dotenv
# from apollo import get_openai_api_key,get_openai_base_url
# load_dotenv()
# Configuration constants
MILVUS_URI = os.getenv("MILVUS_URI", "./milvus_example.db")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "BAAI/bge-m3")
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "64"))

# Initialize the OpenAI embeddings model
embeddings = OpenAIEmbeddings(model=EMBEDDING_MODEL, chunk_size=CHUNK_SIZE, api_key=os.getenv("OPENAI_API_KEY"), base_url=os.getenv("OPENAI_BASE_URL"))
# Connect to Milvus
def init_milvus_connection():
    """Initialize connection to Milvus"""
    try:
        connections.connect(alias="default", uri=MILVUS_URI)
        logger.info("Connected to Milvus successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to connect to Milvus: {str(e)}", exc_info=True)
        return False
#TODO:添加网页loader,读取网页内容。
def load_document(file_path: str, file_extension: str) -> List[Any]:
    """Load a document based on its extension or URL"""
    try:
        # Check if file_path is a URL
        if file_path.startswith(('http://', 'https://')):
            loader = WebBaseLoader(
                web_paths=[file_path],
                bs_kwargs=dict(
                    parse_only=bs4.SoupStrainer(
                        class_=("content", "post-content", "article", "post", "entry", "main")
                    )
                )
            )
        elif file_extension.lower() == '.pdf':
            loader = PyPDFLoader(file_path)
        elif file_extension.lower() in ['.txt', '.md', '.html']:
            loader = TextLoader(file_path)
        else:
            raise ValueError(f"Unsupported file extension: {file_extension}")
        
        return loader.load()
    except Exception as e:
        logger.error(f"Error loading document: {str(e)}", exc_info=True)
        raise

def split_by_paragraph(document_content: str) -> List[str]:
    """Split document content into appropriate sized paragraphs using RecursiveCharacterTextSplitter"""
    length=len(document_content)
    text_splitter = RecursiveCharacterTextSplitter(
        separators=["\n\n", "\n", ". ", "! ", "? "],
        chunk_size=int(length/10),
        # chunk_size=1000,
        chunk_overlap=0,  # 段落之间有50字符重叠，保持上下文连贯性
        length_function=len
    )
    return text_splitter.split_text(document_content)

def split_by_sentence(paragraph: str) -> List[str]:
    """Split paragraph into sentences"""
    length=len(paragraph)
    if int(length/4)==0:
        chunk_size=10
    else:
        chunk_size=int(length/4)
    text_splitter = RecursiveCharacterTextSplitter(
        separators=["。", "！", "？", ". ", "! ", "? ", "\n"],
        chunk_size=chunk_size,
        chunk_overlap=0,
        length_function=len
    )
    return text_splitter.split_text(paragraph)

async def _process_and_store_content(content: str, source: str, chat_id: str, db_session: Session, commit: bool = True) -> Dict:
    """Private core function to process content and store it."""
    # Split by paragraphs (parent documents)
    paragraphs = split_by_paragraph(content)
    
    # Create Milvus collection if it doesn't exist
    collection_name = f"chat_{chat_id}"
    init_milvus_connection()
    
    # Summarize paragraphs in parallel
    summary_tasks = [summarize_document(paragraph) for paragraph in paragraphs if paragraph.strip()]
    summaries = await asyncio.gather(*summary_tasks) if summary_tasks else []
    logger.info(f"Summaries task done, {len(summaries)} summaries generated")
    child_docs = []
    parent_docs_map = {}
    
    # Process each paragraph with its summary
    for i, paragraph in enumerate([p for p in paragraphs if p.strip()]):
        # Get the corresponding summary
        summary = summaries[i] if i < len(summaries) else ""
        
        # Create metadata with summary
        metadata = {
            "source": source,
            "summary": summary
        }
        
        # Create parent document in the database
        doc = Document(
            chat_id=chat_id,
            content=paragraph,
            doc_metadata=json.dumps(metadata, ensure_ascii=False)
        )
        db_session.add(doc)
        db_session.flush()
        parent_doc_id = doc.id
        parent_docs_map[parent_doc_id] = paragraph
        
        # Split paragraph into sentences
        sentences = split_by_sentence(paragraph)
        
        # Add metadata to each sentence
        for sentence in sentences:
            child_docs.append({
                "text": sentence,
                "metadata": {"parent_doc_id": parent_doc_id, "chat_id": chat_id, "summary": summary}
            })
    
    # Commit parent documents to database
    if commit:
        db_session.commit()
    
    # Store child documents in Milvus
    if child_docs:
        texts = [doc["text"] for doc in child_docs]
        metadatas = [doc["metadata"] for doc in child_docs]
        try:
            # Use async version of from_texts
            await Milvus.afrom_texts(
                texts=texts,
                embedding=embeddings,
                metadatas=metadatas,
                collection_name=collection_name,
                connection_args={"uri": MILVUS_URI}
            )
            logger.info(f"Successfully stored {len(texts)} documents in Milvus collection {collection_name}")
            # 主动触发垃圾回收，释放内存
            gc.collect()
        except Exception as e:
            logger.error(f"Failed to store documents in Milvus: {str(e)}", exc_info=True)
            raise
    
    # 处理完成后，主动触发一次垃圾回收
    gc.collect()
    
    return {
        "chat_id": chat_id,
        "parent_docs_count": len(parent_docs_map),
        "child_docs_count": len(child_docs),
        "summarized": True
    }

async def process_document(file_path: str, chat_id: str, db_session: Session, commit: bool = True) -> Dict:
    """Process a document from a file path, splitting it and storing it."""
    # Get file extension
    _, file_extension = os.path.splitext(file_path)
    
    # Load document
    raw_docs = load_document(file_path, file_extension)
    document_content = " ".join([doc.page_content for doc in raw_docs])
    
    return await _process_and_store_content(document_content, file_path, chat_id, db_session, commit=commit)

async def process_content(content: str, chat_id: str, db_session: Session, url: str, commit: bool = True) -> Dict:
    """Process document content, splitting it and storing in DB and vector store"""
    return await _process_and_store_content(content, url, chat_id, db_session, commit=commit)

async def search_documents(query: str, chat_id: str, top_k: int = 3, db_session: Session = None) -> List[Dict]:
    """Search for documents using vector similarity"""
    collection_name = f"chat_{chat_id}"
    init_milvus_connection()
    
    # Check if collection exists
    if not utility.has_collection(collection_name):
        logger.warning(f"Collection {collection_name} does not exist")
        return []
    
    try:
        # Search in Milvus
        vector_db = Milvus(
            embedding_function=embeddings,
            collection_name=collection_name,
            connection_args={"uri": MILVUS_URI}
        )
        
        # Use async version of similarity_search_with_score
        results = await vector_db.asimilarity_search_with_score(query, k=top_k)
        
        # 搜索后主动触发垃圾回收，释放内存
        gc.collect()
        
        # If no results or no session, return empty list
        if not results or not db_session:
            return []
            
        # Extract parent document IDs
        parent_doc_ids = [doc.metadata.get("parent_doc_id") for doc, score in results]
        
        # Retrieve parent documents from database
        parent_docs = db_session.query(Document).filter(Document.id.in_(parent_doc_ids)).all()
        
        # Create a mapping of parent doc ID to full content and metadata
        parent_content_map = {doc.id: doc.content for doc in parent_docs}
        parent_metadata_map = {doc.id: json.loads(doc.doc_metadata) if doc.doc_metadata else {} for doc in parent_docs}
        
        # Build result with parent document content and summary
        return [
            {
                "score": score,
                "parent_doc_id": doc.metadata.get("parent_doc_id"),
                "child_content": doc.page_content,
                "parent_content": parent_content_map.get(doc.metadata.get("parent_doc_id"), ""),
                "summary": parent_metadata_map.get(doc.metadata.get("parent_doc_id"), {}).get("summary", ""),
                "metadata": parent_metadata_map.get(doc.metadata.get("parent_doc_id"), {})
            }
            for doc, score in results
            if doc.metadata.get("parent_doc_id") in parent_content_map
        ]
    except Exception as e:
        logger.error(f"Error searching documents: {str(e)}", exc_info=True)
        return [] 

def get_parent_docs_content(parent_doc_ids: List[int], db_session: Session) -> Dict:
    """Get parent document content from database"""
    parent_docs = db_session.query(Document).filter(Document.id.in_(parent_doc_ids)).all()
    result = {}
    for doc in parent_docs:
        metadata = json.loads(doc.doc_metadata) if doc.doc_metadata else {}
        result[doc.id] = {
            "content": doc.content,
            "summary": metadata.get("summary", "")
        }
    return result

async def get_all_document_summaries_by_chat_id(chat_id: str, db_session: Session) -> List[Dict]:
    """Get all document summaries for a specific chat_id"""
    try:
        # Query all documents for this chat_id
        docs = db_session.query(Document).filter(Document.chat_id == chat_id).all()
        
        if not docs:
            return []
        
        result = []
        for doc in docs:
            metadata = json.loads(doc.doc_metadata) if doc.doc_metadata else {}
            summary = metadata.get("summary", "")
            
            # Only include documents that have summaries
            if summary:
                result.append({
                    "doc_id": doc.id,
                    "summary": summary,
                    # Include a small preview of the content for context
                    "preview": doc.content[:200] + "..." if len(doc.content) > 100 else doc.content
                })
        
        # 获取完所有文档摘要后主动触发垃圾回收
        gc.collect()
        return result
    except Exception as e:
        logger.error(f"Error getting document summaries: {str(e)}", exc_info=True)
        return []

if __name__ == "__main__":
    print(load_document("https://www.anthropic.com/claude-code#get-started",None))