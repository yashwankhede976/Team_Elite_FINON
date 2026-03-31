from openai import APIError, OpenAI, RateLimitError
from django.conf import settings


DEFAULT_ROUTE = settings.LLM_DEFAULT_ROUTE


class LLMServiceBusyError(Exception):
    """Raised when the upstream LLM service is temporarily unavailable."""


def _build_openrouter_client() -> OpenAI:
    api_key = settings.OPENROUTER_API_KEY
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY is not configured")

    headers = {}
    if settings.OPENROUTER_SITE_URL:
        headers["HTTP-Referer"] = settings.OPENROUTER_SITE_URL
    if settings.OPENROUTER_APP_NAME:
        headers["X-OpenRouter-Title"] = settings.OPENROUTER_APP_NAME

    return OpenAI(
        api_key=api_key,
        base_url=settings.OPENROUTER_BASE_URL,
        default_headers=headers or None,
    )


def _build_openai_client() -> OpenAI:
    api_key = settings.OPENAI_DIRECT_API_KEY
    if not api_key:
        raise RuntimeError("OPENAI_DIRECT_API_KEY is not configured")

    return OpenAI(
        api_key=api_key,
        base_url=settings.OPENAI_DIRECT_BASE_URL,
    )


def _provider_order(route: str) -> list[str]:
    normalized = (route or DEFAULT_ROUTE or "auto").strip().lower()
    if normalized == "openrouter":
        return ["openrouter"]
    if normalized == "openai":
        return ["openai"]

    configured = [p.strip().lower() for p in settings.LLM_PROVIDER_ORDER.split(",") if p.strip()]
    valid = [p for p in configured if p in {"openrouter", "openai"}]
    return valid or ["openrouter", "openai"]


def _default_model_for(provider: str) -> str:
    if provider == "openai":
        return settings.OPENAI_DIRECT_MODEL
    return settings.OPENROUTER_MODEL


def _should_try_next_provider(exc: Exception) -> bool:
    if isinstance(exc, RateLimitError):
        return True
    if isinstance(exc, APIError):
        status = getattr(exc, "status_code", None)
        return status in (402, 408, 409, 429, 500, 502, 503, 504)
    return False


def _is_busy_error(exc: Exception) -> bool:
    if isinstance(exc, RateLimitError):
        return True
    if isinstance(exc, APIError):
        return getattr(exc, "status_code", None) in (402, 429, 500, 502, 503, 504)
    return False


def _is_provider_not_configured(exc: Exception) -> bool:
    if not isinstance(exc, RuntimeError):
        return False
    message = str(exc)
    return message.endswith("is not configured")


def _extract_output_text(response) -> str:
    choices = getattr(response, "choices", None) or []
    if not choices:
        return ""

    message = getattr(choices[0], "message", None)
    if not message:
        return ""

    content = getattr(message, "content", "")
    if isinstance(content, str):
        return content.strip()

    # Some providers may return structured content blocks.
    if isinstance(content, list):
        chunks = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                chunks.append(item.get("text", ""))
        return "".join(chunks).strip()

    return ""


def generate_text(
    user_prompt: str,
    system_prompt: str | None = None,
    model: str | None = None,
    temperature: float = 0.2,
    max_output_tokens: int = 1200,
    route: str = DEFAULT_ROUTE,
) -> str:
    messages = []

    if system_prompt:
        messages.append(
            {
                "role": "system",
                "content": system_prompt,
            }
        )

    messages.append(
        {
            "role": "user",
            "content": user_prompt,
        }
    )

    order = _provider_order(route)
    last_exc: Exception | None = None
    saw_busy = False

    for provider in order:
        provider_model = model or _default_model_for(provider)
        try:
            client = _build_openrouter_client() if provider == "openrouter" else _build_openai_client()
            response = client.chat.completions.create(
                model=provider_model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_output_tokens,
            )
            text = _extract_output_text(response)
            if not text:
                raise RuntimeError(f"Empty response from {provider}")
            return text
        except (RateLimitError, APIError, RuntimeError) as exc:
            last_exc = exc
            if _is_provider_not_configured(exc):
                continue
            if _is_busy_error(exc):
                saw_busy = True
            if _should_try_next_provider(exc):
                continue
            raise

    if saw_busy:
        raise LLMServiceBusyError("AI service is currently busy. Please try again later.") from last_exc
    if last_exc:
        raise last_exc
    raise RuntimeError("No LLM providers configured")


def strip_json_fences(raw_text: str) -> str:
    cleaned = (raw_text or "").strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    if cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    return cleaned.strip()


def generate_text_final(**kwargs) -> str:
    """Force final/high-priority output through direct OpenAI."""
    kwargs["route"] = "openai"
    return generate_text(**kwargs)


def generate_text_balanced(**kwargs) -> str:
    """Use configured auto-routing and fallback order."""
    kwargs["route"] = "auto"
    return generate_text(**kwargs)
