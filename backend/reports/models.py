from django.db import models
from django.conf import settings

class FinancialReport(models.Model):
    REPORT_TYPES = (
        ('monthly', 'Monthly Summary'),
        ('weekly', 'Weekly Summary'),
        ('custom', 'Custom Range'),
    )
    
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="financial_reports")
    title = models.CharField(max_length=255)
    report_type = models.CharField(max_length=20, choices=REPORT_TYPES, default='monthly')
    data = models.JSONField()  # Stores the aggregated report data
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} ({self.report_type}) - {self.user.email}"
