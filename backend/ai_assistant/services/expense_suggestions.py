# ai_assistant/services/expense_suggestions.py

import json
from .llm_client import LLMServiceBusyError, generate_text, strip_json_fences

def generate_saving_suggestions(expense_data: dict) -> dict:
    """
    Generate saving insights based on structured expense JSON.
    """
    system_prompt = """
    You are Finexa AI, a financial planning assistant.
    Based on the user's expense history, provide smart and practical suggestions
    to help reduce expenses and increase savings.

    Return ONLY JSON with the schema:
    {
      "suggestions": [
        "string",
        "string",
        "string"
      ]
    }

    Suggestions should be:
    - Personalized to spending categories and merchants
    - Actionable and measurable
    - Not generic like 'save money', but specific
    - Consider user's financial safety and sustainability
    """

    try:
        raw_output = generate_text(
            user_prompt=f"Expense data:\n{json.dumps(expense_data)}",
            system_prompt=system_prompt,
            max_output_tokens=900,
        )
        raw_output = strip_json_fences(raw_output)
        
        return json.loads(raw_output.strip())
    except LLMServiceBusyError:
        return {"suggestions": [], "error": "API quota exceeded"}
    
    except json.JSONDecodeError:
        return {"suggestions": [], "raw_output": raw_output}
    
    except Exception as e:
        return {"suggestions": [], "error": str(e)}
