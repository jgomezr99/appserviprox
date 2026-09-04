from django.contrib import admin

from .models import RequestCandidate, ServiceRequest


class RequestCandidateInline(admin.TabularInline):
    model = RequestCandidate
    extra = 0
    readonly_fields = ("distance_km",)


@admin.register(ServiceRequest)
class ServiceRequestAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "client",
        "suggested_category",
        "selected_category",
        "followed_suggestion",
        "status",
        "created_at",
    )
    list_filter = ("status", "urgency", "selected_category")
    search_fields = ("client__email", "description")
    inlines = [RequestCandidateInline]

    @admin.display(boolean=True, description="Siguio la sugerencia")
    def followed_suggestion(self, obj):
        return obj.followed_suggestion
