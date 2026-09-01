"""Script to trigger the embedding of all CSV datasets into the FAISS vectorstore."""

import os
import sys

# Ensure src is in the python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from langchain_core.documents import Document
from src.ai.embeddings import CSVIntelligentLoader
from src.ai.vectorstore import PCISVectorStore

def main():
    print("Starting RAG Embedding Pipeline...")
    
    data_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data', 'crime_statistics'))
    
    if not os.path.exists(data_dir):
        print(f"Error: Data directory not found at {data_dir}")
        return

    loader = CSVIntelligentLoader(data_dir=data_dir, chunk_size=500, overlap=100)
    store = PCISVectorStore()
    
    # Initialize store
    store.load_or_create()
    
    batch_size = 100
    current_batch = []
    total_chunks = 0
    
    print(f"Scanning CSVs in {data_dir}...")
    
    for chunk in loader.load_and_chunk():
        doc = Document(
            page_content=chunk.content,
            metadata=chunk.metadata
        )
        current_batch.append(doc)
        
        if len(current_batch) >= batch_size:
            store.add_documents(current_batch)
            total_chunks += len(current_batch)
            print(f"Indexed {total_chunks} chunks...")
            current_batch = []
            
    # Add remaining
    if current_batch:
        store.add_documents(current_batch)
        total_chunks += len(current_batch)
        
    print(f"Embedding complete! Successfully indexed {total_chunks} chunks into FAISS.")

if __name__ == "__main__":
    main()
