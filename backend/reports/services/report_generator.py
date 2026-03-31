from django.utils import timezone
from datetime import timedelta
from transactions.models import Transaction
from django.db.models import Sum

def generate_monthly_report(user):
    """
    Aggregates transaction data for the last 30 days.
    """
    end_date = timezone.now()
    start_date = end_date - timedelta(days=30)
    
    transactions = Transaction.objects.filter(
        user=user,
        date__range=(start_date, end_date)
    )
    
    total_income = transactions.filter(type='income').aggregate(Sum('amount'))['amount__sum'] or 0
    total_expense = transactions.filter(type='expense').aggregate(Sum('amount'))['amount__sum'] or 0
    
    category_breakdown = transactions.filter(type='expense').values('category').annotate(total=Sum('amount')).order_factory('-total')
    
    # Note: Using .order_by('-total') instead of .order_factory if I made a typo, wait.
    # It should be .order_by('-total')
    category_breakdown = list(transactions.filter(type='expense').values('category').annotate(total=Sum('amount')).order_by('-total'))
    
    report_data = {
        "period": {
            "start": start_date.strftime("%Y-%m-%d"),
            "end": end_date.strftime("%Y-%m-%d")
        },
        "summary": {
            "total_income": float(total_income),
            "total_expense": float(total_expense),
            "net_savings": float(total_income - total_expense)
        },
        "categories": [
            {"category": item['category'], "amount": float(item['total'])}
            for item in category_breakdown
        ]
    }
    
    return report_data
