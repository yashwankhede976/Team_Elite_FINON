import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from transactions.models import Transaction
from django.contrib.auth import get_user_model
import json

User = get_user_model()
user = User.objects.first()

txs = Transaction.objects.filter(user=user).order_by('-date')[:5]
print(f"Total Transactions: {Transaction.objects.filter(user=user).count()}")
for tx in txs:
    print(f"[{tx.date}] {tx.source} - {tx.amount} - {tx.description[:20]}")
