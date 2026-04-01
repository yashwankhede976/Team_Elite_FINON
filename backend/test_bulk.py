import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from transactions.models import Transaction
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()
user = User.objects.first()

data = [
    {
        "amount": 10.50,
        "type": "expense",
        "category": "Food",
        "description": "Test Data",
        "date": "2026-03-31",
        "source": "pdf"
    }
]

tx_list = []
for item in data:
    tx = Transaction(
        user=user,
        amount=item.get("amount", 0),
        type=item.get("type", "expense"),
        category=item.get("category", "Other"),
        description=item.get("description", "Uploaded Document"),
        date=item.get("date", timezone.now().date()),
        source=item.get("source", "pdf"),
    )
    tx_list.append(tx)

try:
    Transaction.objects.bulk_create(tx_list)
    print("SUCCESS: Transactions bulk created!")
    
    # Let's verify what happens to the date
    db_tx = Transaction.objects.filter(description="Test Data").last()
    print(f"Stored date: {db_tx.date}")
    db_tx.delete()
except Exception as e:
    import traceback
    traceback.print_exc()
