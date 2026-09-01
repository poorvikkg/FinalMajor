"""Groq LLM Implementation — uses llama-3.1-8b-instant for speed."""

import os
from typing import AsyncGenerator
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage
from .base_llm import BaseLLM


# ── Model selection ──────────────────────────────────────────────────────────
# openai/gpt-oss-20b → fast, low latency, available on this account
_DEFAULT_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")


class GroqLLM(BaseLLM):
    """Groq-backed LLM using llama-3.1-8b-instant (fast, supported)."""

    def __init__(self, model_name: str = _DEFAULT_MODEL):
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY environment variable is missing.")

        self.llm = ChatGroq(
            temperature=0.0,
            groq_api_key=api_key,
            model_name=model_name,
            max_tokens=1024,          # cap tokens → faster responses
            request_timeout=30,       # fail fast instead of hanging
        )

    async def generate(self, prompt: str, **kwargs) -> str:
        """Generate a response via Groq."""
        message = HumanMessage(content=prompt)
        response = await self.llm.ainvoke([message])
        return response.content

    async def stream(self, prompt: str, **kwargs) -> AsyncGenerator[str, None]:
        """Stream response token-by-token via Groq."""
        message = HumanMessage(content=prompt)
        async for chunk in self.llm.astream([message]):
            if chunk.content:
                yield chunk.content
