"""Approximate token counter for prompt and completion tracking."""


def count_tokens(text: str) -> int:
    """
    Approximate token count using word/character heuristics.
    OpenAI / Groq tokenizers produce ~1 token per 4 characters on average.
    For production, swap this with tiktoken or the Groq token usage from the response object.
    """
    if not text:
        return 0
    return max(1, len(text) // 4)


def count_prompt_tokens(system: str, context: str, query: str) -> int:
    """Estimate total prompt tokens from all segments."""
    return count_tokens(system) + count_tokens(context) + count_tokens(query)
