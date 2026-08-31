"""CSV Document Loader & Intelligent Chunker for Crime Statistics."""

import os
from typing import List, Dict, Any, Generator
from pydantic import BaseModel, Field

class DocumentChunk(BaseModel):
    content: str
    metadata: Dict[str, Any]


class CSVIntelligentLoader:
    """Loads CSV files and intelligently chunks rows into semantic text."""

    def __init__(self, data_dir: str, chunk_size: int = 500, overlap: int = 100):
        self.data_dir = data_dir
        self.chunk_size = chunk_size
        self.overlap = overlap

    def get_csv_files(self) -> List[str]:
        """Discover all CSV files in the data directory."""
        files = []
        for root, _, filenames in os.walk(self.data_dir):
            for file in filenames:
                if file.endswith('.csv'):
                    files.append(os.path.join(root, file))
        return files

    def _row_to_text(self, row: Any, columns: List[str]) -> str:
        """Convert a pandas row to a readable text representation."""
        import pandas as pd
        parts = []
        for col in columns:
            val = row.get(col)
            if pd.notna(val) and str(val).strip() != "":
                parts.append(f"{col.replace('_', ' ')}: {val}")
        return " | ".join(parts)


    def load_and_chunk(self) -> Generator[DocumentChunk, None, None]:
        """Read CSVs, chunk intelligently, and yield DocumentChunks."""
        import pandas as pd
        csv_files = self.get_csv_files()
        
        for file_path in csv_files:
            file_name = os.path.basename(file_path)
            dataset_name = file_name.replace('.csv', '').replace('_', ' ')
            
            try:
                # Read CSV
                df = pd.read_csv(file_path)
                columns = df.columns.tolist()
                
                # Attempt to extract common spatial/temporal metadata if present
                has_state = "Area_Name" in columns or "State" in columns
                has_district = "District_Name" in columns or "District" in columns
                has_year = "Year" in columns
                
                current_chunk_text = ""
                current_chunk_metadata = {
                    "source_file": file_name,
                    "dataset_name": dataset_name,
                    "column_names": columns,
                    "row_start": 0,
                    "row_end": 0
                }
                
                word_count = 0
                
                for idx, row in df.iterrows():
                    row_text = self._row_to_text(row, columns)
                    row_word_count = len(row_text.split())
                    
                    if word_count + row_word_count > self.chunk_size and current_chunk_text:
                        # Yield the current chunk
                        current_chunk_metadata["row_end"] = idx - 1
                        yield DocumentChunk(
                            content=current_chunk_text,
                            metadata=current_chunk_metadata.copy()
                        )
                        
                        # Handle overlap by keeping the last few rows
                        # For simplicity in tabular data, we start fresh on the exact boundary 
                        # but in a real NLP chunker we'd overlap. Since this is tabular, overlapping 
                        # rows can cause duplicate statistical entries in retrieval. 
                        # We will start a clean new chunk.
                        current_chunk_text = row_text + "\n"
                        word_count = row_word_count
                        current_chunk_metadata["row_start"] = idx
                        
                        # Extract row specific metadata for the new chunk
                        state = row.get("Area_Name") or row.get("State") if has_state else "Unknown"
                        district = row.get("District_Name") or row.get("District") if has_district else "Unknown"
                        year = row.get("Year") if has_year else "Unknown"
                        
                        current_chunk_metadata["state"] = str(state)
                        current_chunk_metadata["district"] = str(district)
                        current_chunk_metadata["year"] = str(year)
                        
                    else:
                        current_chunk_text += row_text + "\n"
                        word_count += row_word_count
                        
                        # Update metadata on first row of chunk
                        if word_count == row_word_count:
                            state = row.get("Area_Name") or row.get("State") if has_state else "Unknown"
                            district = row.get("District_Name") or row.get("District") if has_district else "Unknown"
                            year = row.get("Year") if has_year else "Unknown"
                            
                            current_chunk_metadata["state"] = str(state)
                            current_chunk_metadata["district"] = str(district)
                            current_chunk_metadata["year"] = str(year)
                
                # Yield remainder
                if current_chunk_text:
                    current_chunk_metadata["row_end"] = len(df) - 1
                    yield DocumentChunk(
                        content=current_chunk_text,
                        metadata=current_chunk_metadata
                    )
            except Exception as e:
                print(f"Error processing {file_path}: {e}")
