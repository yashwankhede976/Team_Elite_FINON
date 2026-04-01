# ai_assistant/services/expense_suggestions.py

import json
from .llm_client import LLMServiceBusyError, generate_text, strip_json_fences

def generate_saving_suggestions(expense_data: dict) -> dict:
    """
    Generate saving insights based on structured expense JSON.
    """
    # Deterministic generation to avoid LLM rate-limit quota
    suggestions = []
    
    expenses_list = expense_data.get("expenses", [])
    cat_spend = {}
    
    for row in expenses_list:
        try:
            amt = float(row.get("amount", 0))
        except:
            amt = 0.0
        cat = row.get("category", "Other")
        cat_spend[cat] = cat_spend.get(cat, 0) + amt
        
    for cat, total in cat_spend.items():
        if cat in ["Food", "Dining", "Zomato", "Swiggy"] and total > 2000:
            suggestions.append(f"You spent ₹{total:,.0f} on dining. Cooking at home 2 more days a week could save you ₹{total*0.3:,.0f}/month.")
        elif cat in ["Shopping", "Amazon", "Flipkart"] and total > 3000:
            suggestions.append(f"You spent ₹{total:,.0f} on shopping. Implement a 48-hour cool-off rule before buying non-essentials.")
        elif cat in ["Entertainment", "Movies", "Netflix"] and total > 1000:
            suggestions.append(f"You spent ₹{total:,.0f} on entertainment. Consider auditing digital subscriptions you rarely use.")
            
    if not suggestions:
        if expenses_list:
            suggestions.append("Track every expense religiously to build better financial awareness.")
            suggestions.append("Apply the 50/30/20 budget framework to manage needs, wants, and savings.")
        else:
            suggestions.append("Log your expenses to get personalized saving suggestions.")
            
    # Ensure exactly 3 strong suggestions maximum
    return {"suggestions": suggestions[:3]}
