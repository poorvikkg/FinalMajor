"""Query Planner and Intent Detector."""

import json
from typing import Dict, Any
from rag.llm.groq_llm import GroqLLM

class QueryPlanner:
    """Classifies user intent and formulates retrieval strategy."""

    def __init__(self):
        self.llm = GroqLLM()
        self.prompt = (
            "You are a query classifier for a Police Case Intelligence System.\n"
            "Classify the following user query into exactly one of these intents:\n"
            "[LOOKUP, SUMMARY, STATISTICS, FILTER, COMPARE, SIMILARITY, TIMELINE, GENERAL]\n"
            "\n"
            "Also decide the retrieval source needed: 'mongo' (for specific case/person lookups), "
            "'vector' (for broad historical statistics), or 'hybrid' (for both).\n\n"
            "Output ONLY a valid JSON object in this exact format:\n"
            '{{"intent": "STATISTICS", "source": "vector"}}\n\n'
            "Query: '{query}'"
        )

    async def plan(self, query: str) -> Dict[str, str]:
        """Classify query intent and determine routing source."""
        # Extract latest query if history is present
        latest_query = query
        if "User:" in query and "Assistant:" in query:
            parts = query.split("User:")
            latest_query = parts[-1].strip()

        formatted_prompt = self.prompt.format(query=latest_query)
        try:
            response = await self.llm.generate(formatted_prompt)
            # Clean possible markdown wrapping from LLM
            clean_json = response.replace("```json", "").replace("```", "").strip()
            plan = json.loads(clean_json)
        except Exception as e:
            print(f"Planner failed: {e}. Defaulting to Hybrid GENERAL.")
            plan = {"intent": "GENERAL", "source": "hybrid"}

        # Safeguard: if query asks about database entities, ensure we route to hybrid/mongo
        source = plan.get("source", "hybrid")
        if source == "vector":
            query_lower = latest_query.lower()
            db_keywords = ["case", "pending", "officer", "station", "person", "complaint", "fir", "registered", "under_investigation"]
            if any(kw in query_lower for kw in db_keywords):
                plan["source"] = "hybrid"

        return plan
