from django.contrib import admin

from .models import AvailabilitySlot, PortfolioItem, ProfessionalProfile, ProfessionalService


class ProfessionalServiceInline(admin.TabularInline):
    model = ProfessionalService
    extra = 0


class AvailabilityInline(admin.TabularInline):
    model = AvailabilitySlot
    extra = 0


class PortfolioInline(admin.TabularInline):
    model = PortfolioItem
    extra = 0


@admin.register(ProfessionalProfile)
class ProfessionalProfileAdmin(admin.ModelAdmin):
    list_display = (
        "display_name",
        "neighborhood",
        "city",
        "rating_avg",
        "jobs_completed",
        "is_verified",
        "is_active",
    )
    list_filter = ("city", "is_verified", "is_active", "accepts_urgent")
    search_fields = ("display_name", "headline", "user__email")
    inlines = [ProfessionalServiceInline, AvailabilityInline, PortfolioInline]
