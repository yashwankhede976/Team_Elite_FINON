import json
from datetime import timedelta
from django.utils import timezone
from transactions.models import Transaction
from ai_assistant.models import WalletTransaction, SpendingPattern
from .llm_client import LLMServiceBusyError, generate_text, strip_json_fences

def analyze_user_spending(user):
    """
    Analyzes user's transaction history (Wallet + Manual Transactions)
    using ChatGPT to identify patterns and generate recommendations.
    
    Returns:
        dict: The structured analysis result.
    """
    
    # 1. Gather Data (Last 30 Days)
    thirty_days_ago = timezone.now() - timedelta(days=30)
    
    # Fetch Manual Transactions (Income/Expense)
    manual_txns = list(Transaction.objects.filter(
        user=user, 
        date__gte=thirty_days_ago
    ))
    
    # Fetch Wallet Transactions
    wallet_txns = list(WalletTransaction.objects.filter(
        wallet__user=user,
        timestamp__gte=thirty_days_ago
    ))
    
    # Format for LLM
    txn_summary = "Recent Transactions (Last 30 Days):\n"
    
    if not manual_txns and not wallet_txns:
        return {
            "patterns": ["No recent activity detected."],
            "anomalies": [],
            "recommendations": ["Start tracking your expenses to get personalized insights."]
        }

    for t in manual_txns:
        txn_summary += f"- {t.date.strftime('%Y-%m-%d')}: {t.type.upper()} ({t.category}) ₹{t.amount}\n"
        
    for t in wallet_txns:
        t_type = t.transaction_type
        desc = t.description or "Wallet txn"
        txn_summary += f"- {t.timestamp.strftime('%Y-%m-%d')}: WALLET {t_type} - {desc} ₹{t.amount}\n"
        
    # Collect category sums
    cat_totals = {}
    total_spent = 0
    total_txns = 0
    
    for t in manual_txns:
        if t.type == 'expense':
            cat = t.category or "Other"
            amt = float(t.amount or 0)
            cat_totals[cat] = cat_totals.get(cat, 0) + amt
            total_spent += amt
            total_txns += 1
            
    for t in wallet_txns:
        if t.transaction_type == 'DEBIT':
            cat = "Wallet Payment"
            amt = float(t.amount or 0)
            cat_totals[cat] = cat_totals.get(cat, 0) + amt
            total_spent += amt
            total_txns += 1
            
    if not total_spent:
        return {
            "patterns": ["No significant spending detected in the last 30 days."],
            "anomalies": [],
            "recommendations": [{"title": "Track Expenses", "description": "Log more transactions to get insights.", "potential_savings": "₹0"}]
        }
        
    top_categories = sorted(cat_totals.items(), key=lambda x: x[1], reverse=True)
    top_cat = top_categories[0][0] if top_categories else "General"
    top_amt = top_categories[0][1] if top_categories else 0
    
    patterns = [
        f"You made {total_txns} transactions in the last 30 days totaling ₹{total_spent:,.0f}.",
        f"Your highest spending category is {top_cat} (₹{top_amt:,.0f}), accounting for {round((top_amt/total_spent)*100)}% of your expenses."
    ]
    
    anomalies = []
    if top_amt > (total_spent * 0.6):
        anomalies.append(f"Unusually high concentration of spending in {top_cat}.")
        
    recommendations = []
    
    if top_cat in ["Food", "Dining", "Entertainment", "Shopping"]:
        savings = top_amt * 0.20
        recommendations.append({
            "title": f"Reduce {top_cat} Spend",
            "description": f"Cutting your {top_cat} expenses by 20% would save you significantly.",
            "potential_savings": f"₹{savings:,.0f}"
        })
    else:
        savings = total_spent * 0.10
        recommendations.append({
            "title": "General Spend Reduction",
            "description": "Try to reduce overall discretionary spending by 10%.",
            "potential_savings": f"₹{savings:,.0f}"
        })

    analysis_result = {
        "patterns": patterns,
        "anomalies": anomalies,
        "recommendations": recommendations
    }
    
    # 3. Save to DB (Cache)
    SpendingPattern.objects.create(
        user=user,
        analysis_data=analysis_result
    )
    
    return analysis_result
