"""
AI-Powered Goal-Based Financial Planning Service
Uses ChatGPT to provide feasibility analysis, investment suggestions,
behavioral coaching, and multi-goal prioritization.
"""
import json
from datetime import timedelta
from django.utils import timezone
from decimal import Decimal

from transactions.models import Transaction
from savings_goals.models import SavingsGoal, GoalPlanAnalysis
from ai_assistant.models import WalletTransaction, Wallet, FinancialHealthScore
from .llm_client import LLMServiceBusyError, generate_text, strip_json_fences


def _goal_plan_fallback(ctx, message: str) -> dict:
    goals_analysis = []
    for g in ctx.get('goals', []):
        goals_analysis.append({
            'goal_id': g['id'],
            'goal_title': g['title'],
            'feasibility_pct': 0,
            'feasibility_status': 'Pending AI analysis',
            'achievement_probability_pct': 0,
            'risk_adjusted_probability_pct': 0,
            'probability_explanation': message,
            'required_monthly': g.get('required_monthly', 0),
            'savings_gap': max(0, (g.get('required_monthly') or 0) - (g.get('monthly_contribution') or 0)),
            'delay_months': g.get('delay_months', 0),
            'adjusted_completion_date': None,
            'increase_needed_to_stay_on_track': max(0, (g.get('required_monthly') or 0) - (g.get('monthly_contribution') or 0)),
            'budget_suggestions': [],
            'timeline_category': 'unknown',
        })

    return {
        'goals_analysis': goals_analysis,
        'prioritization': {
            'ranked_goals': [],
            'strategy_summary': 'Detailed prioritization is temporarily unavailable.',
            'over_allocated': False,
            'total_recommended_monthly': 0,
        },
        'investment_suggestions': [],
        'income_simulation': {
            'drop_10_pct': {
                'new_disposable': max(0, ctx.get('disposable_income', 0) * 0.9),
                'goals_impacted': [],
                'delay_added_months': 0,
                'adjustment_needed': 'Retry analysis for accurate impact details.',
            },
            'drop_20_pct': {
                'new_disposable': max(0, ctx.get('disposable_income', 0) * 0.8),
                'goals_impacted': [],
                'delay_added_months': 0,
                'adjustment_needed': 'Retry analysis for accurate impact details.',
            },
            'increase_10_pct': {
                'new_disposable': max(0, ctx.get('disposable_income', 0) * 1.1),
                'time_saved_months': 0,
                'benefit': 'Retry analysis for accurate benefit details.',
            },
        },
        'coaching': {
            'messages': [message],
            'weekly_challenge': 'Track all expenses this week and review category-wise totals.',
            'automatic_transfer_suggestion': 'Set a small automatic monthly transfer toward top-priority goals.',
            'habit_tip': 'Review subscriptions and recurring payments monthly.',
        },
        'overall_summary': message,
        'degraded': True,
    }


def _gather_user_financial_context(user):
    """Gather all relevant financial data for the user."""
    thirty_days_ago = timezone.now() - timedelta(days=30)
    ninety_days_ago = timezone.now() - timedelta(days=90)

    # Transactions last 90 days for trend analysis
    txns = list(Transaction.objects.filter(user=user, date__gte=ninety_days_ago))

    total_income_90d = sum(float(t.amount or 0) for t in txns if t.type == 'income')
    total_expense_90d = sum(float(t.amount or 0) for t in txns if t.type == 'expense')
    monthly_income = round(total_income_90d / 3, 2) if total_income_90d else 0
    monthly_expense = round(total_expense_90d / 3, 2) if total_expense_90d else 0
    disposable_income = max(0, monthly_income - monthly_expense)

    # Category breakdown
    cat_spend = {}
    for t in txns:
        if t.type == 'expense':
            cat = t.category or 'Other'
            cat_spend[cat] = cat_spend.get(cat, 0) + float(t.amount or 0)

    # Wallet balance
    wallet_balance = 0
    try:
        w = Wallet.objects.get(user=user)
        wallet_balance = float(w.balance)
    except Wallet.DoesNotExist:
        pass

    # Health score
    health_score = 50
    try:
        hs = FinancialHealthScore.objects.filter(user=user).latest('calculation_date')
        health_score = hs.score
    except FinancialHealthScore.DoesNotExist:
        pass

    # Active goals
    goals = SavingsGoal.objects.filter(user=user)
    goals_data = []
    for g in goals:
        goals_data.append({
            'id': g.id,
            'title': g.title,
            'target_amount': float(g.target_amount),
            'current_amount': float(g.current_amount),
            'remaining': g.remaining_amount,
            'deadline': str(g.deadline) if g.deadline else None,
            'months_left': g.months_left,
            'required_monthly': g.required_monthly,
            'monthly_contribution': float(g.monthly_contribution),
            'priority': g.priority,
            'progress_pct': g.progress_percentage,
            'delay_months': g.delay_months,
        })

    return {
        'monthly_income': monthly_income,
        'monthly_expense': monthly_expense,
        'disposable_income': disposable_income,
        'wallet_balance': wallet_balance,
        'health_score': health_score,
        'category_spending': cat_spend,
        'goals': goals_data,
        'total_goals_contribution': sum(float(g.monthly_contribution) for g in goals),
    }


def analyze_goal_plan(user, refresh=False):
    """
    Full AI-powered goal planning analysis.
    Returns feasibility, probability, investment suggestions, prioritization, coaching.
    Cached for 12 hours.
    """
    # Check cache
    if not refresh:
        cached = GoalPlanAnalysis.objects.filter(
            user=user,
            created_at__gte=timezone.now() - timedelta(hours=12)
        ).first()
        if cached:
            return cached.analysis_data

    ctx = _gather_user_financial_context(user)

    if not ctx['goals']:
        return {
            'goals_analysis': [],
            'prioritization': {},
            'investment_suggestions': [],
            'coaching': {'messages': ['Create your first financial goal to get personalized AI planning advice!']},
            'overall_summary': 'No goals found. Start by creating a financial goal.',
        }

    prompt = f"""You are an expert financial planner AI. Analyze the user's financial situation and goals.

USER FINANCIAL CONTEXT:
- Monthly Income: ₹{ctx['monthly_income']:,.0f}
- Monthly Expenses: ₹{ctx['monthly_expense']:,.0f}
- Disposable Income: ₹{ctx['disposable_income']:,.0f}
- Wallet Balance: ₹{ctx['wallet_balance']:,.0f}
- Financial Health Score: {ctx['health_score']}/100
- Monthly spending by category: {json.dumps(ctx['category_spending'])}
- Total committed to goals: ₹{ctx['total_goals_contribution']:,.0f}/month

USER'S GOALS:
{json.dumps(ctx['goals'], indent=2)}

Analyze each goal and provide a COMPREHENSIVE financial plan. Output MUST be valid JSON with this schema:
{{
    "goals_analysis": [
        {{
            "goal_id": <int>,
            "goal_title": "<string>",
            "feasibility_pct": <int 0-100>,
            "feasibility_status": "<Highly Feasible|Moderately Feasible|Difficult Under Current Conditions>",
            "achievement_probability_pct": <int 0-100>,
            "risk_adjusted_probability_pct": <int 0-100>,
            "probability_explanation": "<string explaining why>",
            "required_monthly": <number>,
            "savings_gap": <number, 0 if on track>,
            "delay_months": <int>,
            "adjusted_completion_date": "<YYYY-MM-DD>",
            "increase_needed_to_stay_on_track": <number per month>,
            "budget_suggestions": [
                "<specific actionable budget cut suggestion with amount>"
            ],
            "timeline_category": "<short-term|medium-term|long-term>"
        }}
    ],
    "prioritization": {{
        "ranked_goals": [
            {{
                "goal_id": <int>,
                "rank": <int>,
                "recommended_monthly_allocation": <number>,
                "reason": "<string>"
            }}
        ],
        "strategy_summary": "<string explaining overall strategy>",
        "over_allocated": <boolean>,
        "total_recommended_monthly": <number>
    }},
    "investment_suggestions": [
        {{
            "goal_id": <int>,
            "goal_title": "<string>",
            "suggestions": [
                {{
                    "type": "<e.g. SIP, Recurring Deposit, Debt Fund, Index Fund>",
                    "why_it_fits": "<string>",
                    "risk_level": "<Low|Moderate|Moderate-High>",
                    "expected_return_range": "<e.g. 6-8% p.a.>",
                    "liquidity": "<string>",
                    "timeline_fit": "<string>"
                }}
            ]
        }}
    ],
    "income_simulation": {{
        "drop_10_pct": {{
            "new_disposable": <number>,
            "goals_impacted": ["<goal title>"],
            "delay_added_months": <int>,
            "adjustment_needed": "<string>"
        }},
        "drop_20_pct": {{
            "new_disposable": <number>,
            "goals_impacted": ["<goal title>"],
            "delay_added_months": <int>,
            "adjustment_needed": "<string>"
        }},
        "increase_10_pct": {{
            "new_disposable": <number>,
            "time_saved_months": <int>,
            "benefit": "<string>"
        }}
    }},
    "coaching": {{
        "messages": ["<motivational or practical coaching message>"],
        "weekly_challenge": "<specific weekly savings challenge>",
        "automatic_transfer_suggestion": "<string>",
        "habit_tip": "<string>"
    }},
    "overall_summary": "<2-3 sentence overall assessment>"
}}

RULES:
- Do NOT suggest specific stocks or buy/sell signals
- Keep investment suggestions general, risk-aware, and educational
- Include disclaimers where appropriate
- Be encouraging but realistic
- All monetary values in INR
- For short-term goals (0-2yr): suggest RD, high-interest savings, short-term debt funds
- For medium-term (2-5yr): suggest balanced funds, conservative hybrid, SIP in diversified funds
- For long-term (5+yr): suggest SIP in equity mutual funds, index funds, hybrid growth funds
"""

    try:
        raw = generate_text(
            user_prompt=prompt,
            max_output_tokens=1400,
        )
        raw = strip_json_fences(raw)

        result = json.loads(raw.strip())

        # Cache result
        GoalPlanAnalysis.objects.create(user=user, analysis_data=result)

        return result

    except LLMServiceBusyError:
        return _goal_plan_fallback(
            ctx,
            "AI analysis is temporarily busy. Showing a safe fallback plan. Please try again shortly.",
        )
    except Exception as e:
        print(f"Goal planning analysis failed: {e}")
        return _goal_plan_fallback(
            ctx,
            "Goal planning analysis is temporarily unavailable. Showing a safe fallback plan.",
        )


def simulate_income_change(user, change_pct):
    """
    Simulate income change impact on all goals.
    change_pct: positive for increase, negative for decrease.
    """
    ctx = _gather_user_financial_context(user)

    new_income = ctx['monthly_income'] * (1 + change_pct / 100)
    new_disposable = max(0, new_income - ctx['monthly_expense'])

    results = {
        'original_income': ctx['monthly_income'],
        'new_income': round(new_income, 2),
        'change_pct': change_pct,
        'original_disposable': ctx['disposable_income'],
        'new_disposable': round(new_disposable, 2),
        'goals_impact': [],
    }

    for g in ctx['goals']:
        remaining = g['remaining']
        ml = g['months_left']
        req_monthly = g['required_monthly']
        contribution = g['monthly_contribution']

        # If disposable drops below total commitments, scale down
        total_committed = ctx['total_goals_contribution']
        if total_committed > 0 and new_disposable < total_committed:
            scale = new_disposable / total_committed
            adj_contribution = contribution * scale
        else:
            adj_contribution = contribution

        if adj_contribution > 0:
            new_months_needed = remaining / adj_contribution if adj_contribution > 0 else 999
        else:
            new_months_needed = 999

        original_months = remaining / contribution if contribution > 0 else 999
        delay = max(0, round(new_months_needed - original_months))

        results['goals_impact'].append({
            'goal_id': g['id'],
            'title': g['title'],
            'original_contribution': contribution,
            'adjusted_contribution': round(adj_contribution, 2),
            'delay_months': delay,
            'needs_adjustment': adj_contribution < req_monthly,
        })

    return results
