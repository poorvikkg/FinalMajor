from abc import ABC, abstractmethod
from typing import Any, AsyncGenerator

class BaseLLM(ABC):
    """Abstract interface for LLM providers."""

    @abstractmethod
    async def generate(self, prompt: str, **kwargs) -> str:
        """Generate a complete response."""
        pass

    @abstractmethod
    async def stream(self, prompt: str, **kwargs) -> AsyncGenerator[str, None]:
        """Stream a response back."""
        pass
