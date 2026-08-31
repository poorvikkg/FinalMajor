"""Context Builder for PCIS RAG."""

from typing import List, Dict, Any
from langchain_core.documents import Document

class ContextBuilder:
    """Builds structured Markdown prompts from retrieved records (no raw JSON)."""

    @staticmethod
    def build_mongo_context(records: List[Dict[str, Any]]) -> str:
        """Format MongoDB records cleanly."""
        if not records:
            return "No exact database records found."
            
        context_parts = ["### Relevant Database Records"]
        for record in records:
            # Assuming record has typical PCIS Case/Person fields
            if "fir_number" in record:
                context_parts.append(f"- Case FIR: {record.get('fir_number')}")
                context_parts.append(f"  Status: {record.get('current_status')}")
                context_parts.append(f"  Summary: {record.get('short_summary', 'N/A')}")
            elif "first_name" in record:
                context_parts.append(f"- Person: {record.get('first_name')} {record.get('last_name')}")
            else:
                # Generic fallback for other entities avoiding raw json dump
                context_parts.append(f"- Record ID {record.get('_id')}")
                for k, v in record.items():
                    if k != "_id" and v:
                        context_parts.append(f"  {k.capitalize()}: {v}")
        return "\n".join(context_parts)

    @staticmethod
    def build_vector_context(documents: List[Document]) -> str:
        """Format FAISS vector documents cleanly."""
        if not documents:
            return "No relevant historical or statistical context found."
            
        context_parts = ["### Relevant Statistics and Historical Data"]
        for doc in documents:
            meta = doc.metadata
            source = meta.get("dataset_name", "Unknown Source")
            state = meta.get("state", "Unknown")
            year = meta.get("year", "Unknown")
            
            context_parts.append(f"**Source:** {source} ({state}, {year})")
            context_parts.append(f"{doc.page_content.strip()}")
            context_parts.append("---")
            
        return "\n".join(context_parts)

    @classmethod
    def build(cls, mongo_records: List[Dict[str, Any]], vector_docs: List[Document]) -> str:
        """Merge both contexts into a final prompt block."""
        mongo_ctx = cls.build_mongo_context(mongo_records)
        vector_ctx = cls.build_vector_context(vector_docs)
        
        return f"{mongo_ctx}\n\n{vector_ctx}"
