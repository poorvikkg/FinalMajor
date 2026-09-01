"""Extract structured Mongo filters from a natural language query using the LLM."""

import json
from typing import Dict, Any
from src.ai.llm.groq_llm import GroqLLM


FILTER_EXTRACTION_PROMPT = """
You are a structured filter extractor for a Police Case Intelligence System.
Given the user query below, extract any MongoDB-style filter values.

Supported fields:
- state (e.g., "Karnataka", "Kerala", "Andhra Pradesh")
- district (e.g., "Bengaluru", "Thrissur")
- crime_type (e.g., "murder", "rape", "robbery", "theft", "fraud", "kidnapping")
- year (integer e.g., 2014)
- status (e.g., "open", "closed", "under_investigation")
- priority (e.g., "high", "medium", "low")

Output ONLY a valid JSON object. Use null for absent fields. Example:
{{"state": "Karnataka", "district": null, "crime_type": "murder", "year": 2014, "status": null, "priority": null}}

User query: "{query}"
"""


class QueryFilterExtractor:
    """Uses the LLM to parse natural language queries into structured Mongo filter dicts."""

    def __init__(self):
        self.llm = GroqLLM()

    async def extract(self, query: str) -> Dict[str, Any]:
        """Return a cleaned dict of non-null filters extracted from the user query."""
        prompt = FILTER_EXTRACTION_PROMPT.format(query=query)
        try:
            raw = await self.llm.generate(prompt)
            clean = raw.replace("```json", "").replace("```", "").strip()
            all_filters: Dict[str, Any] = json.loads(clean)
            
            # Map filters to MongoDB case-sensitive schema and fields
            mongo_filters = {}
            for k, v in all_filters.items():
                if v is None:
                    continue
                k_lower = k.lower()
                if k_lower == "status":
                    v_upper = str(v).upper()
                    if v_upper in ["PENDING", "OPEN", "REGISTERED"]:
                        mongo_filters["current_status"] = {"$in": ["REGISTERED", "UNDER_INVESTIGATION"]}
                    elif v_upper in ["CLOSED", "SOLVED"]:
                        mongo_filters["current_status"] = {"$in": ["CLOSED_SOLVED", "CLOSED_UNSOLVED"]}
                    else:
                        mongo_filters["current_status"] = v_upper
                elif k_lower == "priority":
                    mongo_filters["priority"] = str(v).upper()
                elif k_lower == "crime_type":
                    mongo_filters["crime_type"] = str(v).upper()
                elif k_lower == "state":
                    mongo_filters["location.state"] = v
                elif k_lower == "district":
                    mongo_filters["location.district"] = v
                elif k_lower == "year":
                    mongo_filters["registration_date"] = {"$regex": f"^{v}"}
                else:
                    mongo_filters[k] = v
            return mongo_filters
        except Exception:
            return {}
