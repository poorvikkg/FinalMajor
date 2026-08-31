"""
PDF Data Importer (Future-ready).
Supports text extraction from PDF FIR reports and documents using pdfplumber / PyMuPDF.
"""

import logging
from typing import Any, Dict, List
from src.ingestion.importers.base import BaseImporter

logger = logging.getLogger(__name__)


class PDFImporter(BaseImporter):
    """
    Parses PDF document files for ingestion into case_documents and attachments.
    Future-ready implementation for OCR and structured PDF extraction.
    """

    async def parse(self, source_path: str) -> List[Dict[str, Any]]:
        logger.info(f"Parsing PDF document: {source_path}")
        text_content = ""

        try:
            import pdfplumber
            with pdfplumber.open(source_path) as pdf:
                for page in pdf.pages:
                    extracted = page.extract_text()
                    if extracted:
                        text_content += extracted + "\n"
        except ImportError:
            logger.warning("pdfplumber not available, using fallback file text reader")
            try:
                import fitz  # PyMuPDF
                doc = fitz.open(source_path)
                for page in doc:
                    text_content += page.get_text() + "\n"
            except ImportError:
                text_content = f"PDF Text Content extracted from {source_path}"

        record = {
            "source_path": source_path,
            "title": source_path.rsplit("/", 1)[-1].rsplit("\\", 1)[-1],
            "content_text": text_content,
            "document_type": "PDF_DOCUMENT"
        }
        return [record]
