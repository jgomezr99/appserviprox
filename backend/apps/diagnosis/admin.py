from django.contrib import admin

from .models import (
    DiagnosticAnswer,
    DiagnosticOption,
    DiagnosticQuestion,
    DiagnosticSession,
)


class DiagnosticOptionInline(admin.TabularInline):
    model = DiagnosticOption
    extra = 0


@admin.register(DiagnosticQuestion)
class DiagnosticQuestionAdmin(admin.ModelAdmin):
    list_display = ("text", "code", "order", "is_required", "is_active")
    list_editable = ("order", "is_active")
    inlines = [DiagnosticOptionInline]


class DiagnosticAnswerInline(admin.TabularInline):
    model = DiagnosticAnswer
    extra = 0


@admin.register(DiagnosticSession)
class DiagnosticSessionAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "suggested_category", "confidence", "status", "created_at")
    list_filter = ("status", "suggested_category")
    search_fields = ("description", "user__email")
    readonly_fields = ("ranking", "rationale", "confidence")
    inlines = [DiagnosticAnswerInline]
