"""Extract structured database query filters and search terms from a natural language query."""

import json
import re
from typing import Dict, Any, List
from rag.llm.groq_llm import GroqLLM

FILTER_EXTRACTION_PROMPT = """
You are a database query filter parser for a Police Surveillance and Case Management System.
Given the user query below, extract structured search parameters to query MongoDB collections (complaints, suspectalerts, sightings, unknownpersons, cameras).

Extract the following fields if mentioned or implied (use null if not mentioned):
- person_name: name of missing person, suspect, subject, or filer (e.g., "poorvik", "Rajesh")
- complaint_id: complaint/case ID or FIR number (e.g., "MP-20260707-0001", "6a4d45e77a7de1e52eee766f", "FIR-102")
- location: location or landmark (e.g., "mai gate", "gate 1", "Bengaluru", "north block")
- incident_type: type of incident or crime (e.g., "unauthorized_access", "missing_person", "theft", "harassment", "assault")
- status: case or alert status (e.g., "active", "open", "registered", "closed", "resolved", "investigating")
- priority: priority level (e.g., "high", "medium", "low")
- entity_type: target entity type: "complaint", "alert", "sighting", "unknown_person", "camera", or "all"
- search_terms: array of 1-3 primary keywords or names to search

Output ONLY a valid JSON object. No explanation or code fences.
Example:
{{"person_name": "poorvik", "complaint_id": null, "location": "mai gate", "incident_type": "unauthorized_access", "status": null, "priority": null, "entity_type": "complaint", "search_terms": ["poorvik", "mai gate"]}}

User query: "{query}"
"""


class QueryFilterExtractor:
    """Uses LLM to parse natural language queries into clean structured search filters."""

    def __init__(self):
        self.llm = GroqLLM()

    async def extract(self, query: str) -> Dict[str, Any]:
        """Return a structured dict of extracted filters and search terms."""
        # Fast rule-based extraction for common ID patterns (e.g. MongoDB ObjectId or MP-xxx)
        object_id_match = re.search(r'\b[0-9a-fA-F]{24}\b', query)
        case_id_match = re.search(r'\b(?:MP|ALERT|FIR)-[A-Za-z0-9-]+\b', query, re.IGNORECASE)

        prompt = FILTER_EXTRACTION_PROMPT.format(query=query)
        try:
            raw = await self.llm.generate(prompt)
            clean = raw.replace("```json", "").replace("```", "").strip()
            # Find the JSON object bounds if there is extra text
            start = clean.find("{")
            end = clean.rfind("}")
            if start != -1 and end != -1:
                clean = clean[start:end+1]

            extracted: Dict[str, Any] = json.loads(clean)
            
            # If regex found an explicit ID, inject it
            if object_id_match and not extracted.get("complaint_id"):
                extracted["complaint_id"] = object_id_match.group(0)
            if case_id_match and not extracted.get("complaint_id"):
                extracted["complaint_id"] = case_id_match.group(0)

            return extracted
        except Exception as e:
            print(f"Filter extraction fallback due to error: {e}")
            # Fallback simple extraction
            terms = [w for w in re.findall(r'\w+', query) if len(w) > 3 and w.lower() not in {"what", "where", "tell", "show", "find", "have", "with", "from", "about", "there", "list"}]
            return {
                "person_name": None,
                "complaint_id": object_id_match.group(0) if object_id_match else (case_id_match.group(0) if case_id_match else None),
                "location": None,
                "incident_type": None,
                "status": None,
                "priority": None,
                "entity_type": "all",
                "search_terms": terms[:3]
            }
