"""Groq LLM Implementation — uses llama-3.1-8b-instant for speed."""

import os
from typing import AsyncGenerator
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage
from .base_llm import BaseLLM


from config.settings import settings

# ── Model selection ──────────────────────────────────────────────────────────
_FALLBACK_MODELS = ["openai/gpt-oss-20b", "qwen/qwen3.6-27b", "openai/gpt-oss-120b"]
_DEFAULT_MODEL = os.getenv("GROQ_MODEL") or settings.GROQ_MODEL or "openai/gpt-oss-20b"


class GroqLLM(BaseLLM):
    """Groq-backed LLM with lazy initialization, error recovery, and model fallback."""

    def __init__(self, model_name: str = _DEFAULT_MODEL):
        self.model_name = model_name
        self._llm = None

    def _get_client(self, model: str = None):
        target_model = model or self.model_name
        api_key = os.getenv("GROQ_API_KEY") or settings.GROQ_API_KEY
        if not api_key:
            raise ValueError("GROQ_API_KEY environment variable is not set. Please add GROQ_API_KEY to your environment or .env file.")
        return ChatGroq(
            temperature=0.0,
            groq_api_key=api_key,
            model_name=target_model,
            max_tokens=1024,
            request_timeout=30,
        )

    async def generate(self, prompt: str, **kwargs) -> str:
        """Generate a response via Groq with fallback support."""
        models_to_try = [self.model_name] + [m for m in _FALLBACK_MODELS if m != self.model_name]
        last_err = None
        for model in models_to_try:
            try:
                client = self._get_client(model)
                message = HumanMessage(content=prompt)
                response = await client.ainvoke([message])
                return response.content
            except Exception as e:
                last_err = e
                # If model not found or bad model request, try next model
                if "model" in str(e).lower() or "404" in str(e) or "not found" in str(e).lower():
                    continue
                raise
        raise last_err

    async def stream(self, prompt: str, **kwargs) -> AsyncGenerator[str, None]:
        """Stream response token-by-token via Groq."""
        models_to_try = [self.model_name] + [m for m in _FALLBACK_MODELS if m != self.model_name]
        for model in models_to_try:
            try:
                client = self._get_client(model)
                message = HumanMessage(content=prompt)
                async for chunk in client.astream([message]):
                    if chunk.content:
                        yield chunk.content
                return
            except Exception as e:
                if "model" in str(e).lower() or "404" in str(e) or "not found" in str(e).lower():
                    continue
                raise
