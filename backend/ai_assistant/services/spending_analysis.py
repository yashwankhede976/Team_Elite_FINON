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
        
    # 2. Prompt ChatGPT
    system_prompt = """
    You are an expert financial analyst. Analyze the following user transaction history.
    Identify spending patterns, unusual anomalies, and providing actionable saving recommendations.
    
    Output MUST be valid JSON with this schema:
    {
        "patterns": ["string", "string"],
        "anomalies": ["string"],
        "recommendations": [
            { "title": "string", "description": "string", "potential_savings": "string" }
        ]
    }
    
    Keep insights concise, friendly, and non-judgmental. Focus on high-impact advice.
    """
    
    try:
        raw_output = generate_text(
            user_prompt=txn_summary,
            system_prompt=system_prompt,
            max_output_tokens=1200,
        )
        raw_output = strip_json_fences(raw_output)
            
        analysis_result = json.loads(raw_output.strip())
        
        # 3. Save to DB (Cache)
        SpendingPattern.objects.create(
            user=user,
            analysis_data=analysis_result
        )
        
        return analysis_result

    except LLMServiceBusyError:
        return {
            "patterns": ["AI analysis is temporarily unavailable due to provider load."],
            "anomalies": [],
            "recommendations": [
                {
                    "title": "Try again shortly",
                    "description": "Detailed spending insights will be available once provider load drops.",
                    "potential_savings": "Unknown",
                }
            ],
        }
    except Exception as e:
        print(f"Spending analysis failed: {e}")
        return {"error": "Failed to analyze spending patterns."}
