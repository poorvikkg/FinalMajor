"""LangGraph Workflow definition — full intent-based routing."""

import os
from langgraph.graph import StateGraph, END
from .state import RAGState
from rag.planner import QueryPlanner
from rag.retrievers.hybrid_retriever import HybridRetriever
from rag.context_builder import ContextBuilder
from rag.llm.groq_llm import GroqLLM
from rag.utils.query_filter_extractor import QueryFilterExtractor

# Map intent → prompt file
INTENT_PROMPT_MAP = {
    "STATISTICS": "statistics_prompt.txt",
    "SUMMARY":    "summary_prompt.txt",
    "COMPARE":    "compare_prompt.txt",
    "TIMELINE":   "timeline_prompt.txt",
    "LOOKUP":     "general_prompt.txt",
    "FILTER":     "general_prompt.txt",
    "SIMILARITY": "general_prompt.txt",
    "GENERAL":    "general_prompt.txt",
}

PROMPTS_DIR = os.path.join(os.path.dirname(__file__), "..", "prompts")


def _load_prompt(filename: str) -> str:
    """Load a prompt template from the prompts directory."""
    path = os.path.join(PROMPTS_DIR, filename)
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return "Context:\n{context}\n\nQuery:\n{query}"


def _load_system_prompt() -> str:
    return _load_prompt("system_prompt.txt")


class PCISWorkflow:
    """Orchestrates the entire AI RAG pipeline using LangGraph."""

    def __init__(self):
        self.planner = QueryPlanner()
        self.retriever = HybridRetriever()
        self.filter_extractor = QueryFilterExtractor()
        self.llm = GroqLLM()
        self.graph = self._build_graph()

    # ── Nodes ─────────────────────────────────────────────────────────

    async def _plan_node(self, state: RAGState) -> RAGState:
        """Classify the user intent and decide routing source."""
        plan = await self.planner.plan(state["query"])
        state["intent"] = plan.get("intent", "GENERAL")
        state["source_route"] = plan.get("source", "hybrid")
        return state

    async def _condense_query(self, query_with_history: str) -> str:
        """Condense chat history and follow-up query into a standalone query."""
        if "User:" not in query_with_history or "Assistant:" not in query_with_history:
            return query_with_history

        parts = query_with_history.split("User:")
        latest_query = parts[-1].strip()
        history = "User:".join(parts[:-1]).strip()

        prompt = (
            "Given the following conversation history and follow-up query, "
            "rewrite it into a single, standalone query that can be used to search a police database.\n"
            "Do NOT answer the question. Output ONLY the rewritten standalone query.\n\n"
            f"History:\n{history}\n\n"
            f"Follow-up Query: {latest_query}\n\n"
            "Standalone Query:"
        )
        try:
            condensed = await self.llm.generate(prompt)
            return condensed.strip()
        except Exception:
            return latest_query

    async def _retrieve_node(self, state: RAGState) -> RAGState:
        """Retrieve from Mongo + FAISS based on intent routing and extracted filters."""
        query = state["query"]
        route = state["source_route"]

        # Condense query if it contains history
        retrieval_query = await self._condense_query(query)

        # Extract structured filters from the condensed query for smarter Mongo queries
        extracted_filters = await self.filter_extractor.extract(retrieval_query)
        mongo_filters = extracted_filters

        m_res, v_res = await self.retriever.retrieve(
            query=retrieval_query,
            mongo_filters=mongo_filters,
            mongo_collection="all",
            vector_filters=None,
            top_k=int(os.getenv("TOP_K", "5")),
        )

        state["mongo_records"] = m_res
        state["vector_docs"] = v_res
        return state

    async def _context_node(self, state: RAGState) -> RAGState:
        """Build a structured Markdown context block from retrieved records."""
        context = ContextBuilder.build(state["mongo_records"], state["vector_docs"])
        state["context"] = context
        return state

    async def _generate_node(self, state: RAGState) -> RAGState:
        """Generate the final answer using the intent-specific prompt template."""
        intent = state.get("intent", "GENERAL")
        prompt_file = INTENT_PROMPT_MAP.get(intent, "general_prompt.txt")
        prompt_template = _load_prompt(prompt_file)
        system_prompt = _load_system_prompt()

        final_prompt = prompt_template.format(
            system_prompt=system_prompt,
            context=state["context"],
            query=state["query"],
        )

        response = await self.llm.generate(final_prompt)
        state["response"] = response
        return state

    # ── Graph ─────────────────────────────────────────────────────────

    def _build_graph(self):
        workflow = StateGraph(RAGState)

        workflow.add_node("planner",         self._plan_node)
        workflow.add_node("retriever",        self._retrieve_node)
        workflow.add_node("context_builder",  self._context_node)
        workflow.add_node("generator",        self._generate_node)

        workflow.set_entry_point("planner")
        workflow.add_edge("planner",         "retriever")
        workflow.add_edge("retriever",        "context_builder")
        workflow.add_edge("context_builder",  "generator")
        workflow.add_edge("generator",        END)

        return workflow.compile()

    async def run(self, query: str) -> dict:
        """Run the compiled LangGraph workflow for a user query."""
        initial_state = RAGState(
            query=query,
            intent="",
            source_route="",
            mongo_records=[],
            vector_docs=[],
            context="",
            response="",
        )
        return await self.graph.ainvoke(initial_state)
