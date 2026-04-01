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
    
    # 1. Gather Data (recent window first, all-time fallback)
    thirty_days_ago = timezone.now() - timedelta(days=30)

    # Fetch recent manual transactions and wallet transactions.
    recent_manual_txns = list(Transaction.objects.filter(
        user=user,
        date__gte=thirty_days_ago
    ))
    recent_wallet_txns = list(WalletTransaction.objects.filter(
        wallet__user=user,
        timestamp__gte=thirty_days_ago
    ))

    # If statements were uploaded with older dates, include all history
    # so Spending Insights does not miss imported data.
    if recent_manual_txns or recent_wallet_txns:
        manual_txns = recent_manual_txns
        wallet_txns = recent_wallet_txns
        period_label = "Last 30 Days"
    else:
        manual_txns = list(Transaction.objects.filter(user=user))
        wallet_txns = list(WalletTransaction.objects.filter(wallet__user=user))
        period_label = "All Time"
    
    # Format for LLM
    txn_summary = f"Transactions ({period_label}):\n"
    
    if not manual_txns and not wallet_txns:
        return {
            "patterns": ["No activity detected yet."],
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
            "patterns": [f"No significant spending detected in {period_label.lower()}."],
            "anomalies": [],
            "recommendations": [{"title": "Track Expenses", "description": "Log more transactions to get insights.", "potential_savings": "₹0"}]
        }
        
    top_categories = sorted(cat_totals.items(), key=lambda x: x[1], reverse=True)
    top_cat = top_categories[0][0] if top_categories else "General"
    top_amt = top_categories[0][1] if top_categories else 0
    
    patterns = [
        f"You made {total_txns} transactions in {period_label.lower()} totaling ₹{total_spent:,.0f}.",
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
