# ai_assistant/services/expense_summary.py

import json
from .llm_client import LLMServiceBusyError, generate_text, strip_json_fences

def summarize_expenses_from_data(data: dict) -> dict:
    """
    Given structured expense JSON from Mongo,
    generate a financial summary via LLM call.
    """

    system_prompt = """
    You are Finexa AI, an expert financial analysis model.

    Given the structured expenses and metadata JSON,
    produce insights in the following JSON format only:

    {
      "total_amount": number,
      "record_count": number,
      "biggest_category": "string",
      "currency": "INR",
      "top_merchants": ["string"],
      "suggestions": ["string"]
    }
    """

    try:
        raw = generate_text(
            user_prompt=f"Expense data:\n{json.dumps(data)}",
            system_prompt=system_prompt,
            max_output_tokens=800,
        )
        raw = strip_json_fences(raw)

        return json.loads(raw.strip())
    except LLMServiceBusyError:
        return {"error": "AI provider is currently busy"}
    
    except json.JSONDecodeError:
        return {"error": "Invalid output from LLM", "raw_response": raw}
    
    except Exception as e:
        return {"error": f"Failed to summarize: {str(e)}"}
