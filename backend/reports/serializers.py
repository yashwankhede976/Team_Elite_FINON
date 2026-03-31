from rest_framework import serializers
from .models import FinancialReport

class FinancialReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = FinancialReport
        fields = ['id', 'title', 'report_type', 'data', 'created_at']
        read_only_fields = ['id', 'data', 'created_at']
