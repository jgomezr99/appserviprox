from django.contrib import admin

from .models import Household


@admin.register(Household)
class HouseholdAdmin(admin.ModelAdmin):
    list_display = ("label", "owner", "neighborhood", "city", "is_default")
    list_filter = ("city", "property_type", "is_default")
    search_fields = ("label", "address_line", "neighborhood", "owner__email")
