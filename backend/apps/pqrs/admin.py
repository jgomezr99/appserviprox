from django.contrib import admin
from .models import PQRReport, PQRMessage, AppProblemReport


class PQRMessageInline(admin.TabularInline):
    model = PQRMessage
    extra = 1


@admin.register(PQRReport)
class PQRReportAdmin(admin.ModelAdmin):
    list_display = (
        "radicado_number",
        "contractor_company",
        "pqr_type",
        "status",
        "client_name",
        "client_document_id",
        "client_phone",
        "client_address",
        "incident_date",
        "created_at",
    )
    list_filter = ("status", "pqr_type", "incident_date")
    search_fields = (
        "radicado_number",
        "contractor_company",
        "client_name",
        "client_document_id",
        "description",
    )
    inlines = [PQRMessageInline]


@admin.register(AppProblemReport)
class AppProblemReportAdmin(admin.ModelAdmin):
    list_display = ("ticket_number", "category_label", "status", "reported_by", "created_at")
    list_filter = ("status", "category")
    search_fields = ("ticket_number", "description", "reported_by")

