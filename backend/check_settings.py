import os
import sys
import django

# Add the project directory to sys.path
sys.path.append(os.getcwd())

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from django.conf import settings

print("-" * 20)
print(f"OPENROUTER_API_KEY Set? : {'YES' if settings.OPENROUTER_API_KEY else 'NO'}")
if settings.OPENROUTER_API_KEY:
    print(f"OPENROUTER_API_KEY Length: {len(settings.OPENROUTER_API_KEY)}")
print(f"OPENROUTER_BASE_URL: {settings.OPENROUTER_BASE_URL}")
print(f"OPENROUTER_MODEL: {settings.OPENROUTER_MODEL}")
print(f"OPENAI_DIRECT_API_KEY Set? : {'YES' if settings.OPENAI_DIRECT_API_KEY else 'NO'}")
if settings.OPENAI_DIRECT_API_KEY:
    print(f"OPENAI_DIRECT_API_KEY Length: {len(settings.OPENAI_DIRECT_API_KEY)}")
print(f"OPENAI_DIRECT_BASE_URL: {settings.OPENAI_DIRECT_BASE_URL}")
print(f"OPENAI_DIRECT_MODEL: {settings.OPENAI_DIRECT_MODEL}")
print(f"LLM_DEFAULT_ROUTE: {settings.LLM_DEFAULT_ROUTE}")
print(f"LLM_PROVIDER_ORDER: {settings.LLM_PROVIDER_ORDER}")

print(f"MONGODB_URI Set?    : {'YES' if settings.MONGODB_URI else 'NO'}")
if settings.MONGODB_URI:
    print(f"MONGODB_URI Prefix: {settings.MONGODB_URI[:15]}...")
print("-" * 20)
