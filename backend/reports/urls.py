from django.urls import path
from .views import ReportListCreateAPIView

urlpatterns = [
    path('', ReportListCreateAPIView.as_view(), name="report-list-create"),
]
