from django.contrib import admin

from .models import RequestCandidate, ServiceRequest, ServiceRequestImage


class RequestCandidateInline(admin.TabularInline):
    model = RequestCandidate
    extra = 0
    readonly_fields = ("distance_km",)


class ServiceRequestImageInline(admin.TabularInline):
    model = ServiceRequestImage
    extra = 0
    readonly_fields = ("created_at",)


@admin.register(ServiceRequest)
class ServiceRequestAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "client",
        "suggested_category",
        "selected_category",
        "selected_service",
        "professional",
        "followed_suggestion",
        "status",
        "created_at",
    )
    list_filter = ("status", "urgency", "selected_category", "selected_service")
    search_fields = ("client__email", "description")
    inlines = [RequestCandidateInline, ServiceRequestImageInline]

    @admin.display(boolean=True, description="Siguio la sugerencia")
    def followed_suggestion(self, obj):
        return obj.followed_suggestion


@admin.register(ServiceRequestImage)
class ServiceRequestImageAdmin(admin.ModelAdmin):
    list_display = ("id", "service_request", "uploaded_by", "created_at")
    list_filter = ("created_at",)
    search_fields = ("service_request__client__email",)
