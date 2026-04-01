# ai_assistant/services/expense_summary.py

import json
from .llm_client import LLMServiceBusyError, generate_text, strip_json_fences

def summarize_expenses_from_data(data: dict) -> dict:
    """
    Given structured expense JSON from Mongo,
    generate a financial summary via LLM call.
    """

    # Deterministic generation to avoid LLM rate-limit quota and improve speed
    expenses_list = data.get("expenses", [])
    
    total_amount = 0.0
    record_count = len(expenses_list)
    cat_spend = {}
    merchant_spend = {}
    
    for row in expenses_list:
        try:
            amt = float(row.get("amount", 0))
        except (ValueError, TypeError):
            amt = 0.0
            
        cat = row.get("category", "General")
        merchant = row.get("merchant", "Unknown")
        
        total_amount += amt
        cat_spend[cat] = cat_spend.get(cat, 0) + amt
        merchant_spend[merchant] = merchant_spend.get(merchant, 0) + amt
        
    biggest_category = max(cat_spend.keys(), key=lambda k: cat_spend[k]) if cat_spend else "None"
    
    top_merchants_list = sorted(merchant_spend.items(), key=lambda x: x[1], reverse=True)
    top_merchants = [m[0] for m in top_merchants_list[:3]] if top_merchants_list else []
    
    suggestions = []
    if biggest_category != "None":
        suggestions.append(f"Most of your spending went to {biggest_category}. Consider setting a budget limit here.")
    if total_amount > 0:
        suggestions.append("Tracking these expenses regularly will help maintain your financial health.")
        
    return {
        "total_amount": round(total_amount, 2),
        "record_count": record_count,
        "biggest_category": biggest_category,
        "currency": data.get("currency", "INR"),
        "top_merchants": top_merchants,
        "suggestions": suggestions
    }
