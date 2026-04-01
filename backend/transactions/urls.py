# transactions/urls.py
from django.urls import path
from .views import TransactionListCreateView, TransactionSummaryView, TransactionBulkCreateView

urlpatterns = [
    path('', TransactionListCreateView.as_view(), name="transactions"),
    path('bulk/', TransactionBulkCreateView.as_view(), name="transaction-bulk"),
    path('summary/', TransactionSummaryView.as_view(), name="transaction-summary"),
]
